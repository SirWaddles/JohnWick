const fs = require('fs');
const ipc = require('node-ipc');
const Fortnite = require('./fortnite');
const FortniteAPI = require('./api');
const { GetStoreImages } = require('./images');

ipc.config.id = 'wick';
ipc.config.retry = 5000;
ipc.config.networkHost = 'localhost';
ipc.config.networkPort = 27020;
ipc.config.silent = true;

let MessageHooks = [];

ipc.serveNet(() => {
    ipc.server.on('app.send_message', (data, socket) => {
        let hooks = MessageHooks.filter(v => v.type == data.type);
        Promise.all(hooks.map(v => Promise.resolve(v.callback(data.data)))).then(response => {
            let response_data = response;
            if (response.length === 1) {
                response_data = response[0];
            }
            ipc.server.emit(socket, 'app.receive_message', {
                data: response_data,
                request_id: data.request_id,
            });
        });
    });
});
ipc.server.start();

function BroadcastMessage(type, data) {
    ipc.server.broadcast('app.broadcast', {
        type: type,
        data: data,
    });
}

function AddMessageHook(type, callback) {
    MessageHooks.push({
        type: type,
        callback: callback,
    });
}

function GetFileName(extra) {
    var now = new Date();
    let dateStr = now.getFullYear() + '_' + now.getMonth() + '_' + now.getDate();
    if (typeof extra !== 'undefined' && extra === true) {
        dateStr += "_" + now.getHours() + "_" + now.getMinutes();
    }
    var fileName = dateStr + '.png';
    return fileName;
}

let lastShopId = null;

async function PostShopMessage(storeData) {
    let newShopId = Fortnite.MakeShopIdentifier(storeData);
    if (lastShopId === newShopId) {
        return;
    }
    lastShopId = newShopId;

    Fortnite.StampedLog("Posting shop image");
    let image = await GetStoreImages(true, storeData);
    let fileName = GetFileName();
    if (fs.existsSync('./store_images/' + fileName)) {
        fileName = GetFileName(true);
    }
    fs.writeFileSync('./store_images/' + fileName, image);
    BroadcastMessage('image', fileName);
    Fortnite.StampedLog("Sent shop image to subs");
}

let EventQueue = [];

function AddEventToQueue(evt, time) {
    EventQueue.push({
        evt, time,
    });
}

function WaitUntil(time) {
    return new Promise((resolve, reject) => {
        AddEventToQueue(resolve, time);
    });
}

/**
 * Using event loop like this because setTimeout seems to have some jitter sometimes.
 * This may not be as accurate, but something should never occur **before** the designated timestamp.
 * Which in this case is more important.
 */
setInterval(() => {
    const now = new Date();
    for (let evt of EventQueue) {
        if (now < evt.time) continue;
        evt.evt();
    }

    EventQueue = EventQueue.filter(v => now < v.time);
}, 300);

function UpdateLocale() {
    let now = new Date();
    if (now.getUTCHours() !== 23) {
        return;
    }
    Fortnite.UpdateLocaleInformation();
}

async function QueueShopLoop() {
    let storeData = await Fortnite.GetStoreData();
    lastShopId = Fortnite.MakeShopIdentifier(storeData);

    while (true) {
        if (!storeData.hasOwnProperty('expiration')) {
            throw new Error("invalid expiration");
        }
        let expiration = new Date(storeData.expiration);

        // Update locale - 60 seconds before shop
        AddEventToQueue(() => {
            UpdateLocale();
        }, new Date(expiration.getTime() - 60000));

        // Refresh login token - 10 seconds before shop
        AddEventToQueue(() => {
            FortniteAPI.refreshLoginToken()
        }, new Date(expiration.getTime() - 10000));

        // Loop waits until shop expires (typically every hour)
        await WaitUntil(expiration);
        storeData = await Fortnite.GetStoreData();
        await PostShopMessage(storeData);
    }
}

AddMessageHook('request_image', data => {
    return "https://wickshopbot.com/" + GetFileName();
});

AddMessageHook('request_refresh', async data => {
    Fortnite.StampedLog("Received request for image");
    let storeData = await Fortnite.GetStoreData();
    let image = await GetStoreImages(false, storeData);
    let fileName = GetFileName(true);
    fs.writeFileSync("./store_images/v2/" + fileName, image);
    Fortnite.StampedLog("Finished Image Generation");
    return "https://wickshopbot.com/v2/" + fileName;
});

AddMessageHook('request_broadcast', data => {
    BroadcastMessage('message_broadcast', data);
});

QueueShopLoop();

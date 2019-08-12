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

function GetFileName() {
    var now = new Date();
    var fileName = now.getFullYear() + '_' + now.getMonth() + '_' + now.getDate() + '.png';
    return fileName;
}

async function PostShopMessage() {
    Fortnite.StampedLog("Posting shop image");
    let image = await GetStoreImages(true);
    let fileName = GetFileName();
    fs.writeFileSync('./store_images/' + fileName, image);
    BroadcastMessage('image', fileName);
    Fortnite.StampedLog("Sent shop image to subs");
}

function PostNextMessage() {
    let now = new Date();
    if (now.getUTCHours() !== 0) {
        QueueNextMessage();
        return;
    }
    PostShopMessage().then(() => {
        QueueNextMessage();
    }).catch(e => {
        console.error(e);
    });
}

function QueueNextMessage() {
    Fortnite.GetStoreData().then(data => {
        if (!data.hasOwnProperty('expiration')) {
            console.error(data);
            throw "Invalid data, cannot queue";
        }
        let targetTime = new Date(data.expiration);
        let timeUntil = targetTime.getTime() - Date.now();
        setTimeout(PostNextMessage, timeUntil + 2000);
        setTimeout(() => FortniteAPI.refreshLoginToken(), timeUntil - 8000);
    });
}

AddMessageHook('request_image', data => {
    Fortnite.StampedLog("Received request for image");
    return GetStoreImages(false).then(image => image.toString('base64'));
});

AddMessageHook('request_broadcast', data => {
    BroadcastMessage('message_broadcast', data);
});

QueueNextMessage();

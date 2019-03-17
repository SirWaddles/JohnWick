const fs = require('fs');
const ipc = require('node-ipc');
const Fortnite = require('./fortnite');
const { GetStoreImages } = require('./images');

ipc.config.id = 'wick';
ipc.config.retry = 5000;

ipc.serve(() => {
    ipc.server.on('app.get_image', (data, socket) => {
        GetStoreImages(false).then(image => {
            ipc.server.emit(socket, 'app.receive_image', {
                image: image.toString('base64'),
                request_id: data.request_id,
            });
        });
    });
});
ipc.server.start();

function GetFileName() {
    var now = new Date();
    var fileName = now.getFullYear() + '_' + now.getMonth() + '_' + now.getDate() + '.png';
    return fileName;
}

async function PostShopMessage() {
    let image = await GetStoreImages(true);
    let fileName = GetFileName();
    fs.writeFileSync('./store_images/' + fileName, image);
    ipc.server.broadcast('app.image', {path: fileName});
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
    });
}

QueueNextMessage();

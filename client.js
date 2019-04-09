const ipc = require('node-ipc');

ipc.config.id = 'wick';
ipc.config.retry = 5000;
ipc.config.networkHost = 'localhost';
ipc.config.networkPort = 27020;

let ImageHooks = [];
let ImageReceives = [];
let ImageRequestID = 0;

ipc.connectToNet('wick', () => {
    ipc.of.wick.on('app.image', (data) => {
        ImageHooks.forEach(v => v(data.path));
    });
    ipc.of.wick.on('app.receive_image', data => {
        let request = ImageReceives.filter(v => v.request_id == data.request_id).pop();
        if (!request) return;
        let image_buffer = Buffer.from(data.image, 'base64');
        request.resolve(image_buffer);
        ImageReceives = ImageReceives.filter(v => v.request_id != data.request_id);
    });
});

function AddImageHook(hook) {
    ImageHooks.push(hook);
}

function GetImage() {
    return new Promise((resolve, reject) => {
        ImageRequestID++;
        let image_request = {
            request_id: ImageRequestID,
            resolve: resolve,
            reject: reject,
        };
        ipc.of.wick.emit('app.get_image', {
            request_id: ImageRequestID,
        });
        ImageReceives.push(image_request);
    });
}

exports.AddImageHook = AddImageHook;
exports.GetImage = GetImage;

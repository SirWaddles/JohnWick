const ipc = require('node-ipc');

ipc.config.id = 'wick';
ipc.config.retry = 5000;
ipc.config.networkHost = 'localhost';
ipc.config.networkPort = 27020;
ipc.config.silent = true;

let BroadcastHooks = [];
let MessageReceives = [];
let MessageRequestID = 0;

ipc.connectToNet('wick', () => {
    ipc.of.wick.on('app.broadcast', data => {
        BroadcastHooks.filter(v => v.type == data.type).forEach(v => v.hook(data.data));
    });
    ipc.of.wick.on('app.receive_message', data => {
        let request = MessageReceives.filter(v => v.request_id == data.request_id).pop();
        if (!request) return;
        request.resolve(data.data);
        MessageReceives = MessageReceives.filter(v => v.request_id !== data.request_id);
    });
    console.log('Client Connected');
});

function AddBroadcastHook(type, hook) {
    BroadcastHooks.push({
        hook: hook,
        type: type,
    });
}

function SendMessage(type, data) {
    return new Promise((resolve, reject) => {
        MessageRequestID++;
        let message_request = {
            request_id: MessageRequestID,
            resolve: resolve,
            reject: reject,
        };
        ipc.of.wick.emit('app.send_message', {
            request_id: MessageRequestID,
            type: type,
            data: data,
        });
        MessageReceives.push(message_request);
    });
}

exports.AddBroadcastHook = AddBroadcastHook;
exports.SendMessage = SendMessage;

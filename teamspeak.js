const net = require('net');

function ResolveConnection(sock) {
    return new Promise((resolve, reject) => {
        sock.on('error', reject);
        sock.on('ready', resolve);
    });
}

function ts_unescape(str) {
    return String(str).replace(/\\\\/g, '\\')
        .replace(/\\\//g, '/')
        .replace(/\\p/g, '|')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\v/g, '\v')
        .replace(/\\f/g, '\f')
        .replace(/\\s/g, ' ');
}

function ts_escape(str) {
    return String(str).replace(/\\/g, '\\\\')
        .replace(/\//g, '\\/')
        .replace(/\|/g, '\\p')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\v/g, '\\v')
        .replace(/\f/g, '\\f')
        .replace(/ /g, '\\s');
}

function ts_parseobj(str) {
    if (str.length <= 0) return null;
    return str.split(' ').reduce((acc, v) => {
        if (!v.includes('=')) {
            acc[v] = true;
            return acc;
        }
        let param = v.split('=');
        acc[param[0]] = ts_unescape(param[1]);
        return acc;
    }, {});
}

function ts_parseline(str) {
    return str.split('|').map(ts_parseobj);
}

function ts_parselist(str) {
    let lines = str.split("\n\r").map(ts_parseline).filter(v => v);
    if (lines[0][0].hasOwnProperty('error')) {
        return {
            val: null,
            response: lines[0],
        };
    }
    return {
        val: lines[0],
        response: lines[1],
    };
}

class TSConnection {
    constructor() {
        this.sock = null;
        this.dataHandlers = [];
        this.timeoutCheck = setInterval(() => this.checkTimeouts(), 2000);
        this.serverList = [];
    }

    cleanup() {
        clearInterval(this.timeoutCheck);
        if (this.sock) this.sock.end();
    }

    onData(data) {
        if (this.dataHandlers.length <= 0) return;
        let handle = this.dataHandlers.shift();
        if (handle.parse) {
            let parseData = ts_parselist(data);
            if (parseData.response[0].id == '0') {
                return handle.handle(parseData);
            }
            return handle.error(parseData.response[0].msg);
        }
        return handle.handle(data);
    }

    checkTimeouts() {
        this.dataHandlers.forEach((v, idx) => {
            if (v.expires > Date.now()) {
                v.error('Timed out');
                this.dataHandlers.splice(idx, 1);
            }
        });
    }

    addReceiveHandler(message, ignoreParse) {
        return new Promise((resolve, reject) => {
            this.dataHandlers.push({
                handle: resolve,
                error: reject,
                expires: Date.now() + 2000,
                parse: (typeof ignoreParse == 'undefined') ? true : false,
            });
            message();
        });
    }

    async connect(host, port) {
        this.sock = new net.Socket();
        try {
            this.sock.on('data', (data) => this.onData(data));
            this.sock.setEncoding('utf8');
            this.addReceiveHandler(() => false, true);
            this.sock.connect({
                host: host,
                port: port,
            });
            let status = await ResolveConnection(this.sock);
        } catch (error) {
            throw 'Could not connect: ' + error.code;
        }
    }

    login(username, password) {
        return this.addReceiveHandler(() => {
            this.sock.write('login ' + username + ' ' + password + "\n");
        });
    }

    getServerList() {
        return this.addReceiveHandler(() => {
            this.sock.write("serverlist\n");
        }).then(serverList => {
            this.serverList = serverList.val;
            return serverList.val;
        });
    }

    useServer(server) {
        return this.addReceiveHandler(() => {
            this.sock.write('use ' + server + '\n');
        });
    }

    getChannelList() {
        return this.addReceiveHandler(() => {
            this.sock.write('channellist\n');
        });
    }

    setChannelDescription(cid, description) {
        return this.addReceiveHandler(() => {
            this.sock.write("channeledit cid=" + cid + " channel_description=" + ts_escape(description) + "\n");
        });
    }
}

let authStates = [];

function GetAuthState(msg) {
    return authStates.filter(v => v.aid == msg.author.id).shift();
}

async function TSMessageHandle(msg, parts) {
    if (parts[1] == 'subscribe') {
        authStates = authStates.filter(v => v.aid !== msg.author.id).concat([{
            aid: msg.author.id,
            state: 'start',
        }]);
        msg.author.send("I'll need some details to set this up. Type `!ts connect <host> <port>` so I can try connect to the ServerQuery interface");
        return;
    }
    let authState = GetAuthState(msg);
    if (!authState) {
        msg.author.send("Sorry, I'm not aware of any connections at the moment.");
        return;
    }
    if (parts[1] == 'connect' && authState.state == 'start') {
        if (parts.length < 4) return msg.author.send('You will need to specify both a hostname and a port to connect to.');
        try {
            authState.connection = new TSConnection();
            await authState.connection.connect(parts[2], parts[3]);
            authState.state = 'connected';
            authState.host = parts[2];
            authState.port = parts[3];
            msg.author.send("Great, now I'll need some login details. Use `!ts authenticate <username> <password>` to try and login");
            return;
        } catch (error) {
            msg.author.send("Sorry, I couldn't connect to that address. Are you sure it's correct?\n" + error.toString());
            return;
        }
    }

    if (parts[1] == 'authenticate' && authState.state == 'connected') {
        try {
            await authState.connection.login(parts[2], parts[3]);
            authState.username = parts[2];
            authState.password = parts[3];
            msg.author.send("Use `!ts select <server_id>` to choose which server to subscribe to");
            let serverList = await authState.connection.getServerList();
            msg.author.send(serverList.map(v => v.virtualserver_id + ': ' + v.virtualserver_name).join("\n"));
            authState.state = 'server_selection';
        } catch (error) {
            msg.author.send("The login didn't seem to go through. Are you sure it's correct\n" + error.toString());
            return;
        }
    }

    if (parts[1] == 'select' && authState.state == 'server_selection') {
        try {
            authState.serverId = parts[2];
            await authState.connection.useServer(authState.serverId);
            let channelList = await authState.connection.getChannelList();
            msg.author.send("Use `!ts select <channel_id>` to choose which channel to subscribe to");
            msg.author.send(channelList.val.map(v => v.cid + ": " + v.channel_name).join("\n"));
            authState.state = 'channel_selection';
        } catch (error) {
            msg.author.send("I wasn't able to select that server\n" + error.toString());
            return;
        }
    }

    if (parts[1] == 'select' && authState.state == 'channel_selection') {
        try {
            authState.channelId = parts[2];
            await authState.connection.setChannelDescription(authState.channelId, "Hey, JohnWick has set this.");
            msg.author.send("Great! I'll post the shop image there when it updates.");
            authState.connection.cleanup();
            authStates = authStates.filter(v => v.aid != authState.aid);
            return {
                type: 'teamspeak',
                aid: authState.aid,
                serverId: authState.serverId,
                channelId: authState.channelId,
                host: authState.host,
                port: authState.port,
                username: authState.username,
                password: authState.password,
            };
        } catch (error) {
            msg.author.send("That doesn't seem to have worked. Are you sure you have permission to do that?\n" + error.toString());
            return;
        }
    }
}

module.exports = TSMessageHandle;

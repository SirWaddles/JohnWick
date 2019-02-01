const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
const Fortnite = require('./fortnite');
const { GetStoreImages } = require('./images');
const { DiscordToken } = require('./tokens');
const { TSMessageHandle, SendServerImage } = require('./teamspeak');
const { submitRedditShop } = require('./reddit');

var subbedChannels = [];
var logStream = fs.createWriteStream('errors.txt', {flags: 'a'});

function LogToFile(text) {
    logStream.write(text + "\n");
}

if (fs.existsSync('channels.json')) {
    subbedChannels = JSON.parse(fs.readFileSync('channels.json'));
    console.log(subbedChannels.length);
}

function SaveChannelFile() {
    fs.writeFileSync('channels.json', JSON.stringify(subbedChannels));
}

function BroadcastReminderMessage(msg) {
    let channelIds = subbedChannels.map(v => v.channel);
    let servers = client.guilds.filter(guild => guild.channels.filter(ch => channelIds.includes(ch.id)).size <= 0);

    let replyString = msg.content.split(' ').slice(2);
    servers.forEach(server => {
        server.owner.send(replyString.map(v => v == '[[servername]]' ? server.name : v).join(' '));
    });
}

client.on('ready', () => {
    client.user.setActivity('Type !help', {type: 'PLAYING'});
});

const HELP_MESSAGE = `\`\`\`
JohnWick is a bot that posts the contents of the Fortnite shop each day, usually around 00:00 GMT.

* Use !subscribe in a channel to receive the shop notificaitons in that channel. The bot will need appropriate permissions. !unsubscribe will remove that channel.
* !subscribe accepts a second argument, 'text', which will make it so that the notifications are text-only, instead of the shop image.

You can see my source code at https://github.com/SirWaddles/JohnWick, so feel free to lodge an issue if you have any problems or a feature request.
\`\`\``;

client.on('message', msg => {
    if (msg.author.bot) return;
    if (msg.content.substring(0, 1) != '!') return;
    var parts = msg.content.split(' ');
    if (parts[0] == '!help') {
        msg.channel.send(HELP_MESSAGE);
        return;
    }
    if (parts[0] == '!ts') {
        return TSMessageHandle(msg, parts).then(data => {
            if (data && data.hasOwnProperty('aid')) {
                subbedChannels.push(data);
                SaveChannelFile();
            }
        });
    }
    if (parts[0] == '!subscribe') {
        msg.channel.send("Sure thing! I'll tell you when the shop updates.").then(message => {
            subbedChannels.push({
                channel: msg.channel.id.toString(),
                type: (parts.length > 1 && parts[1] == 'text') ? 'text' : 'image',
            });
            SaveChannelFile();
        }).catch(e => {
            LogToFile('attempted to subscribe to ' + msg.channel.id);
        });
    }
    if (parts[0] == '!unsubscribe') {
        subbedChannels = subbedChannels.filter(v => v.channel != msg.channel.id);
        msg.channel.send("Not a problem, I'll stop sending stuff here.");
        SaveChannelFile();
    }
    if (parts[0] == '!servers' && msg.author.id == '229419335930609664') {
        msg.reply("Currently connected to **" + client.guilds.size + "** servers");
        return;
    }
    if (parts[0] == '!serverlist' && msg.author.id == '229419335930609664') {
        let listFile = client.guilds.sort((a, b) => {
            return (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : -1;
        }).map(v => {
            let channelList = v.channels.filter(gc => subbedChannels.map(ch => ch.channel).includes(gc.id));
            return v.name + "\n" + channelList.map(gc => "-" + gc.name).join("\n");
        }).join("\n");
        let fileBuffer = Buffer.from(listFile, 'utf8');
        let attach = new Discord.Attachment(fileBuffer, 'list.txt');
        msg.channel.send(attach);
        return;
    }
    if (parts[0] == '!shop') {
        GetStoreImages(false).then(data => {
            var attach = new Discord.Attachment(data, 'shop.png');
            msg.channel.send(attach);
        }).catch(e => LogToFile(e));
    }
    if (parts[0] == '!broadcast' && msg.author.id == '229419335930609664') {
        if (parts[1] == 'ts') {
            let tsList = subbedChannels.filter(v => v.type == 'teamspeak');
            SendServerImage(tsList, parts.slice(2).join(" "));
            return;
        }
        if (parts[1] == 'shop') {
            PostShopMessage();
            return;
        }
        if (parts[1] == 'empty_servers') {
            BroadcastReminderMessage(msg);
            return;
        }
        var channelList = subbedChannels.map(v => v.channel);
        parts.shift();
        var broadcastMessage = parts.join(" ");
        client.channels.forEach(channel => {
            if (channelList.includes(channel.id)) {
                channel.send(broadcastMessage);
            }
        });
    }
});

function GetFileName() {
    var now = new Date();
    var fileName = now.getFullYear() + '_' + now.getMonth() + '_' + now.getDate() + '.png';
    let nonce = 1;
    while (fs.existsSync('./store_images/' + fileName)) {
        fileName = now.getFullYear() + '_' + now.getMonth() + '_' + now.getDate() + '_' + nonce + '.png';
        nonce++;
    }
    return fileName;
}

function PostShopMessage() {
    return GetStoreImages(true).then(data => {
        let fileName = GetFileName();
        fs.writeFileSync('./store_images/' + fileName, data);
        submitRedditShop("https://johnwickbot.shop/" + fileName);
        var channelList = subbedChannels.filter(v => v.type == 'image').map(v => v.channel);
        client.channels.forEach(channel => {
            if (channelList.includes(channel.id)) {
                channel.send("https://johnwickbot.shop/" + fileName).catch(error => {
                    LogToFile(error);
                    LogToFile(channel.id);
                });
            }
        });
    });
}

function PostNextMessage() {
    PostShopMessage().then(() => {
        QueueNextMessage();
    }).catch(e => {
        LogToFile(e);
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
        setTimeout(PostNextMessage, timeUntil + 5000);
    });
}

QueueNextMessage();

client.login(DiscordToken);

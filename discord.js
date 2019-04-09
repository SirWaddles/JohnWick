const fs = require('fs');
const Discord = require('discord.js');
const IPCClient = require('./client');
const { DiscordToken } = require('./tokens');

const client = new Discord.Client({
    messageCacheLifetime: 60,
    messageSweepInterval: 60,
    disabledEvents: ["TYPING_START"],
});

client.on('error', error => {
    console.error(error);
});

var subbedChannels = [];
var logStream = null;

function LogToFile(text) {
    logStream.write(text + "\n");
}

if (fs.existsSync('channels.json')) {
    LoadChannelFile();
}

function LoadChannelFile() {
    subbedChannels = JSON.parse(fs.readFileSync('channels.json'));
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
    logStream = fs.createWriteStream('errors' + client.shard.id + '.txt', {flags: 'a'});
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
    if (parts[0] == '!subscribe') {
        msg.channel.send("Sure thing! I'll tell you when the shop updates.").then(message => {
            LoadChannelFile();
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
        LoadChannelFile();
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
    if (parts[0] == '!shop' && msg.author.id == '229419335930609664') {
        IPCClient.GetImage().then(data => {
            var attach = new Discord.Attachment(data, 'shop.png');
            msg.channel.send(attach);
        });
    }
    if (parts[0] == '!broadcast' && msg.author.id == '229419335930609664') {
        if (parts[1] == 'shop') {
            PostShopMessage(GetFileName());
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
    return fileName;
}

function PostShopMessage(fileName) {
    LoadChannelFile();
    var channelList = subbedChannels.filter(v => v.type == 'image').map(v => v.channel);
    client.channels.forEach(channel => {
        if (channelList.includes(channel.id)) {
            channel.send("https://johnwickbot.shop/" + fileName).catch(error => {
                LogToFile(error);
                LogToFile(channel.id);
            });
        }
    });
}

IPCClient.AddImageHook((fileName) => PostShopMessage(fileName));

client.login(DiscordToken);

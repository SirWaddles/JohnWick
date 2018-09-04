const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
const Fortnite = require('./fortnite');
const { GetStoreImages, GetChangeImage } = require('./images');
const { DiscordToken } = require('./tokens');
const TSMessageHandle = require('./teamspeak');

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
        subbedChannels.push({
            channel: msg.channel.id.toString(),
            type: (parts.length > 1 && parts[1] == 'text') ? 'text' : 'image',
        });
        msg.channel.send("Sure thing! I'll tell you when the shop updates.");
        SaveChannelFile();
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
        if (parts.length > 1 && parts[1] == 'text') {
            GetTextMessage().then(message => msg.channel.send(message));
            return;
        }
        GetStoreImages().then(data => {
            var attach = new Discord.Attachment(data, 'shop.png');
            msg.channel.send(attach);
        });
    }
    if (parts[0] == '!changelist') {
        GetChangeImage().then(data => {
            var attach = new Discord.Attachment(data, 'shop.png');
            msg.channel.send(attach);
        });
    }
    if (parts[0] == '!broadcast' && msg.author.id == '229419335930609664') {
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

var targetPost = false;

function GetTextMessage() {
    return Fortnite.GetStoreData().then(data => {
        var storeInfo = Fortnite.GetStoreInfo(data);
        return message = "```\n" + storeInfo.map(Fortnite.GetAssetData).map(v => v.displayName + " - " + v.price).join("\n") + "\n```";
    });
}

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
    GetTextMessage().then(message => {
        var channelList = subbedChannels.filter(v => v.type == 'text').map(v => v.channel);
        client.channels.forEach(channel => {
            if (channelList.includes(channel.id)) {
                channel.send(message).catch(error => {
                    LogToFile(error);
                    LogToFile(subbedChannels.length);
                    // Probably missing permissions
                    subbedChannels = subbedChannels.filter(v => v.channel != channel.id);
                    LogToFile(subbedChannels.length);
                    SaveChannelFile();
                });
            }
        });
    });
    return GetStoreImages().then(data => {
        let fileName = GetFileName();
        fs.writeFileSync('./store_images/' + fileName, data);
        var channelList = subbedChannels.filter(v => v.type == 'image').map(v => v.channel);
        client.channels.forEach(channel => {
            if (channelList.includes(channel.id)) {
                channel.send("https://johnwick.genj.io/" + fileName).catch(error => {
                    LogToFile(error);
                    LogToFile(subbedChannels.length);
                    subbedChannels = subbedChannels.filter(v => v.channel != channel.id);
                    LogToFile(subbedChannels.length);
                    SaveChannelFile();
                });
            }
        });
    });
}

setInterval(function() {
    var now = new Date();
    Fortnite.GetStoreData().then(data => {
        if (!targetPost) {
            targetPost = new Date(data.expiration);
            return;
        }

        if (now > targetPost) {
            PostShopMessage();
            targetPost = new Date(data.expiration);
        }
    });
}, 300000); // 5 minutes - 60 * 5 * 1000

client.login(DiscordToken);

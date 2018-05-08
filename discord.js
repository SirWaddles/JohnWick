const fs = require('fs');
const Discord = require('discord.js');
const client = new Discord.Client();
const Fortnite = require('./fortnite');
const { GetStoreImages } = require('./images');
const { DiscordToken } = require('./tokens');

var subbedChannels = [];

if (fs.existsSync('channels.json')) {
    subbedChannels = JSON.parse(fs.readFileSync('channels.json'));
}

function SaveChannelFile() {
    fs.writeFileSync('channels.json', JSON.stringify(subbedChannels));
}

client.on('message', msg => {
    if (msg.content.substring(0, 1) != '!') return;
    var parts = msg.content.split(' ');
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
        msg.reply("\n```\n" + client.guilds.map(v => v.name).join("\n") + "\n```");
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
});

var targetPost = false;

function GetTextMessage() {
    return Fortnite.GetStoreData().then(data => {
        var storeInfo = Fortnite.GetStoreInfo(data);
        return message = "```\n" + storeInfo.map(Fortnite.GetAssetData).map(v => v.displayName + " - " + v.price).join("\n") + "\n```";
    });
}

function PostShopMessage() {
    GetTextMessage().then(message => {
        var channelList = subbedChannels.filter(v => v.type == 'text').map(v => v.channel);
        client.channels.forEach(channel => {
            channel.send(message);
        });
    });
    return GetStoreImages().then(data => {
        var attach = new Discord.Attachment(data, 'shop.png');
        var channelList = subbedChannels.filter(v => v.type == 'image').map(v => v.channel);
        client.channels.forEach(channel => {
            if (channelList.includes(channel.id)) {
                channel.send(attach);
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

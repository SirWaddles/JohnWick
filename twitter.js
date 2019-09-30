const fs = require('fs');
const Twitter = require('twitter');
const { TwitterToken } = require('./tokens.js');
const TwitterClient = new Twitter(TwitterToken);
const IPCClient = require('./client');

function UploadMedia(buffer) {
    return new Promise((resolve, reject) => {
        TwitterClient.post('media/upload', {media: buffer}, function(error, media, response) {
            if (error) {
                return reject(error);
            }

            resolve(media);
        });
    });
}

async function PostTweet(path) {
    let buffer = fs.readFileSync("./store_images/" + path);
    let media = await UploadMedia(buffer);
    let now = new Date();
    let title = "Daily Shop (" + now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0') + '-' + now.getDate() + ')';
    TwitterClient.post('statuses/update', {
        status: title,
        media_ids:media.media_id_string,
    }, (error, tweet, response) => {
        if (error) return console.error(error);
        console.log("Tweet Posted!");
    });
}

IPCClient.AddBroadcastHook('image', PostTweet);

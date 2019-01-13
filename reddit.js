const snoowrap = require('snoowrap');
const { RedditToken } = require('./tokens');

const r = new snoowrap({
  userAgent: 'node:john-wick:0.1.0 (by /u/SirWaddlesworth)',
  clientId: RedditToken.client_id,
  clientSecret: RedditToken.client_secret,
  refreshToken: RedditToken.refresh_token,
});

function submitRedditShop(link) {
    let now = new Date();
    let title = "Daily Shop (" + now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0') + '-' + now.getDate() + ')';
    r.getSubreddit('FortniteBR').submitLink({
        title: title,
        url: link,
    });
}

exports.submitRedditShop = submitRedditShop;

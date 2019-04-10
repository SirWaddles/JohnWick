const { Client } = require('pg');
const { PGSQLConnection } = require('./tokens');
const client = new Client(PGSQLConnection);

async function connect() {
    return client.connect();
}

exports.connect = connect;

async function disconnect() {
    return client.end();
}

exports.disconnect = disconnect;

function addNewChannel(channel_id, channel_type) {
    return client.query("INSERT INTO channels(discord, channel_type) VALUES($1, $2)", [channel_id, channel_type]).catch(console.error);
}

exports.addNewChannel = addNewChannel;

function removeChannel(channel_id) {
    return client.query("DELETE FROM channels WHERE discord=$1", [channel_id]).catch(console.error);;
}

exports.removeChannel = removeChannel;

function getChannels(channel_type) {
    return client.query("SELECT discord, channel_type FROM channels WHERE channel_type = $1", [channel_type]).then(r => r.rows).catch(console.error);;
}

exports.getChannels = getChannels;

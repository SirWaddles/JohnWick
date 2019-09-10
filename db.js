const { Pool } = require('pg');
const { PGSQLConnection } = require('./tokens');
const DBPool = new Pool(PGSQLConnection);

async function addShopHistory(item_id) {
    const client = await DBPool.connect();
    try {
        let now = new Date();
        return client.query("INSERT INTO shop_history (item_id, date_stamp) VALUES ($1, $2) ON CONFLICT DO NOTHING", [item_id, now]);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

exports.addShopHistory = addShopHistory;

async function getLastAppeared(item_id) {
    const client = await DBPool.connect();
    try {
        let now = new Date();
        let rows = await client.query('SELECT date_stamp FROM shop_history WHERE item_id = $1 AND date_stamp < $2 ORDER BY date_stamp DESC LIMIT 1', [item_id, now]);
        if (rows.rows.length <= 0) return false;
        return rows.rows[0].date_stamp;
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

exports.getLastAppeared = getLastAppeared;

async function getAppearanceCount(item_id) {
    const client = await DBPool.connect();
    try {
        let rows = await client.query("SELECT COUNT(item_id) AS item_count FROM shop_history WHERE item_id = $1", [item_id]);
        return rows.rows[0].item_count;
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

exports.getAppearanceCount = getAppearanceCount;

async function getLocaleString(namespace, key, lang_key) {
    const client = await DBPool.connect();
    let query = {
        name: 'retrieve-locale',
        text: 'SELECT content FROM localization WHERE namespace = $1 AND string_key = $2 AND lang_key = $3',
        values: [namespace, key, lang_key],
    };

    try {
        let rows = await client.query(query);
        return rows.rows[0].content;
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

exports.getLocaleString = getLocaleString;

// Ignore namespaces for this, for everything item-shop, it's "" anyway.
async function getLocaleStrings(keys, lang_key) {
    const client = await DBPool.connect();
    let whereClause = [...Array(keys.length).keys()].map(v => "$" + (v + 2)).join(", ");
    let params = keys.slice();
    params.unshift(lang_key);

    try {
        let rows = await client.query("SELECT string_key, content FROM localization WHERE lang_key = $1 AND string_key IN (" + whereClause + ")", params);
        return rows.rows.map(v => ({
            key: v.string_key,
            string: v.content,
        }));
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

exports.getLocaleStrings = getLocaleStrings;

async function insertLocaleString(namespace, key, lang_key, content) {
    const client = await DBPool.connect();
    let query = {
        name: 'upsert-locale',
        text: 'INSERT INTO localization (namespace, string_key, content, lang_key) VALUES ($1, $2, $3, $4)' +
            ' ON CONFLICT ON CONSTRAINT unique_entry DO UPDATE SET content = $3',
        values: [namespace, key, content, lang_key],
    };

    try {
        return client.query(query);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

exports.insertLocaleString = insertLocaleString;

function disconnectClient() {
    DBPool.end();
}

exports.disconnectClient = disconnectClient;

process.on('exit', function() {
    DBPool.end();
});

const { Client } = require('pg');
const { PGSQLConnection } = require('./tokens');
const client = new Client(PGSQLConnection);

client.connect().catch(console.error);

function addShopHistory(item_id) {
    return client.query("INSERT INTO shop_history (item_id, date_appeared) VALUES ($1, $2)", [item_id, Date.now()]).catch(console.error);
}

exports.addShopHistory = addShopHistory;

function getLastAppeared(item_id) {
    let dateFilter = Date.now() - (23 * 60 * 60 * 1000);
    return client.query('SELECT date_appeared FROM shop_history WHERE item_id = $1 AND date_appeared < $2 ORDER BY date_appeared DESC LIMIT 1', [item_id, dateFilter])
        .then(rows => {
            if (rows.rows.length <= 0) {
                return false;
            }
            return rows.rows[0].date_appeared;
        })
        .catch(console.error);
}

exports.getLastAppeared = getLastAppeared;

function getAppearanceCount(item_id) {
    return client.query("SELECT COUNT(item_id) AS item_count FROM shop_history WHERE item_id = $1", [item_id])
        .then(rows => {
            return rows.rows[0].item_count;
        })
        .catch(console.error);
}

exports.getAppearanceCount = getAppearanceCount;

function getLocaleString(namespace, key, lang_key) {
    let query = {
        name: 'retrieve-locale',
        text: 'SELECT content FROM localization WHERE namespace = $1 AND string_key = $2 AND lang_key = $3',
        values: [namespace, key, lang_key],
    };
    return client.query(query).then(r => {
        return r.rows[0].content;
    });
}

exports.getLocaleString = getLocaleString;

// Ignore namespaces for this, for everything item-shop, it's "" anyway.
function getLocaleStrings(keys, lang_key) {
    let whereClause = [...Array(keys.length).keys()].map(v => "$" + (v + 2)).join(", ");
    let params = keys.slice();
    params.unshift(lang_key);

    return client.query("SELECT string_key, content FROM localization WHERE lang_key = $1 AND string_key IN (" + whereClause + ")", params).then(r => {
        return r.rows.map(v => ({
            key: v.string_key,
            string: v.content,
        }));
    });
}

exports.getLocaleStrings = getLocaleStrings;

function insertLocaleString(namespace, key, lang_key, content) {
    let query = {
        name: 'upsert-locale',
        text: 'INSERT INTO localization (namespace, string_key, content, lang_key) VALUES ($1, $2, $3, $4)' +
            ' ON CONFLICT ON CONSTRAINT unique_entry DO UPDATE SET content = $3',
        values: [namespace, key, content, lang_key],
    };
    return client.query(query);
}

exports.insertLocaleString = insertLocaleString;

process.on('exit', function() {
    client.end();
});

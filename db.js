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

process.on('exit', function() {
    client.end();
});

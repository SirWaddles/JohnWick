const sqlite = require('sqlite3');

const db = new sqlite.Database('./store.db');

function addShopHistory(item_id) {
    let stmt = db.prepare("INSERT INTO shop_history (item_id, date_appeared) VALUES(?, ?)");
    stmt.run([item_id, Date.now()]);
    stmt.finalize();
}

exports.addShopHistory = addShopHistory;

function getLastAppeared(item_id) {
    return new Promise((resolve, reject) => {
        let dateFilter = Date.now() - (23 * 60 * 60 * 1000);
        db.all('SELECT date_appeared FROM shop_history WHERE item_id = ? AND date_appeared < ? ORDER BY date_appeared DESC LIMIT 1', item_id, dateFilter, (err, row) => {
            if (err) {
                reject('SQL Error');
                return;
            }
            if (row.length <= 0) {
                resolve(false);
                return;
            }
            resolve(row[0].date_appeared);
            return;
        });
    });
}

exports.getLastAppeared = getLastAppeared;

function getAppearanceCount(item_id) {
    return new Promise((resolve, reject) => {
        db.all('SELECT COUNT(item_id) AS item_count FROM shop_history WHERE item_id = ?', item_id, (err, row) => {
            if (err) {
                reject('SQL Error');
                return;
            }
            if (row.length <= 0) {
                reject('No results');
                return;
            }
            resolve(row[0].item_count);
        });
    });
}

exports.getAppearanceCount = getAppearanceCount;

process.on('exit', function() {
    db.close();
});

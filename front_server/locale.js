const { Client } = require('pg');
const { PGSQLConnection } = require('../tokens');

async function UpdateLocale(locale, lang_key) {
    let client = new Client(PGSQLConnection);
    await client.connect();
    try {
        for (namespace of locale) {
            for (entry of namespace.data) {
                let query = {
                    name: 'upsert-locale',
                    text: 'INSERT INTO localization (namespace, string_key, content, lang_key) VALUES ($1, $2, $3, $4)' +
                        ' ON CONFLICT ON CONSTRAINT unique_entry DO UPDATE SET content = $3',
                    values: [namespace.namespace, entry.key, entry.data, lang_key],
                };
                await client.query(query);
            }
        }
    } catch (e) {
        console.error(e);
    }
    await client.end();
}

exports.UpdateLocale = UpdateLocale;

async function GetLocaleStrings(keys, lang_key) {
    let client = new Client(PGSQLConnection);
    await client.connect();
    let whereClause = [...Array(keys.length).keys()].map(v => "$" + (v + 2)).join(", ");
    let params = keys.slice();
    params.unshift(lang_key);

    let rowData = await client.query("SELECT string_key, content FROM localization WHERE lang_key = $1 AND string_key IN (" + whereClause + ")", params);
    let rows = rowData.rows.map(v => ({
        key: v.string_key,
        string: v.content,
    }));

    await client.end();

    return rows;
}

exports.GetLocaleStrings = GetLocaleStrings;

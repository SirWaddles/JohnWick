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

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/Users/Administrador/Desktop/node-backup/npm-global/node_modules/9router/app/cli/.build-home/.9router/db/data.sqlite');

db.all("SELECT * FROM kv", (err, rows) => {
    console.log('KV STORE:', JSON.stringify(rows));
    db.close();
});

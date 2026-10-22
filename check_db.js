const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/Users/Administrador/Desktop/node-backup/npm-global/node_modules/9router/app/cli/.build-home/.9router/db/data.sqlite');

db.all("SELECT id, name FROM combos", (err, rows) => {
    console.log('LISTA DE COMBOS:', JSON.stringify(rows));
    db.close();
});

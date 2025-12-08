
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data/secure_users.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.all("SELECT * FROM contracts", (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Contracts count:", rows.length);
        console.log(JSON.stringify(rows, null, 2));
    });
});

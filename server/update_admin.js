
const db = require('./database');

const NEW_NAME = 'Daividas Girštautas';
const USERNAME = 'admin';

db.serialize(() => {
    db.run("UPDATE users SET full_name = ? WHERE username = ?", [NEW_NAME, USERNAME], function (err) {
        if (err) {
            console.error("Error updating user:", err.message);
        } else {
            console.log(`Updated ${this.changes} user(s). Set full_name to '${NEW_NAME}' for username '${USERNAME}'.`);
        }
    });

    // Verify
    db.get("SELECT * FROM users WHERE username = ?", [USERNAME], (err, row) => {
        if (err) console.error(err);
        else console.log("Updated User:", row);
    });
});

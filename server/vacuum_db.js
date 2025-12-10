const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your database
const DB_PATH = path.join(__dirname, '../data/secure_users.db');
const db = new sqlite3.Database(DB_PATH);

console.log("Starting database vacuum...");

db.serialize(() => {
    // VACUUM rebuilds the database file, repacking it into a minimal amount of disk space
    db.run("VACUUM;", (err) => {
        if (err) {
            console.error("Error during vacuum:", err.message);
        } else {
            console.log("Database vacuumed successfully! Deleted data is now permanently removed.");
        }
        db.close();
    });
});

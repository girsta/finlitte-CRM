const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Configurable Data Directory for Persistence
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'secure_users.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database at', DB_PATH);
  }
});

db.serialize(() => {
  // Users Table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'viewer',
    full_name TEXT,
    phone TEXT,
    email TEXT
  )`);

  // Create Index on Username
  db.run(`CREATE INDEX IF NOT EXISTS idx_username ON users(username)`);

  // Contracts Table
  db.run(`CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draudejas TEXT,
    pardavejas TEXT,
    ldGrupe TEXT,
    policyNo TEXT,
    galiojaNuo TEXT,
    galiojaIki TEXT,
    valstybinisNr TEXT,
    metineIsmoka REAL,
    ismoka REAL,
    notes TEXT,
    atnaujinimoData TEXT,
    is_archived INTEGER DEFAULT 0
  )`);

  // History Table
  db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER,
    user_id INTEGER,
    username TEXT,
    timestamp TEXT,
    action TEXT,
    details TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_contract_id ON history(contract_id)`);

  // Tasks Table
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    assigned_to TEXT,
    created_by TEXT,
    status TEXT DEFAULT 'pending',
    due_date TEXT,
    created_at TEXT,
    comments TEXT,
    completed_at TEXT
  )`);

  // --- Migrations for existing databases ---
  // Check for 'role' in users
  db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) console.error(err);
    if (rows && !rows.some(r => r.name === 'role')) {
      console.log("Migrating: Adding role column to users table");
      db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'viewer'");
    }
  });

  // Check for 'full_name' in users
  db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) console.error(err);
    if (rows && !rows.some(r => r.name === 'full_name')) {
      console.log("Migrating: Adding full_name column to users table");
      db.run("ALTER TABLE users ADD COLUMN full_name TEXT");
    }
  });

  // Check for 'phone' in users
  db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) console.error(err);
    if (rows && !rows.some(r => r.name === 'phone')) {
      console.log("Migrating: Adding phone column to users table");
      db.run("ALTER TABLE users ADD COLUMN phone TEXT");
    }
  });

  // Check for 'email' in users
  db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) console.error(err);
    if (rows && !rows.some(r => r.name === 'email')) {
      console.log("Migrating: Adding email column to users table");
      db.run("ALTER TABLE users ADD COLUMN email TEXT");
    }
  });

  // Check for 'is_archived' in contracts
  db.all("PRAGMA table_info(contracts)", (err, rows) => {
    if (err) console.error(err);
    if (rows && !rows.some(r => r.name === 'is_archived')) {
      console.log("Migrating: Adding is_archived column to contracts table");
      db.run("ALTER TABLE contracts ADD COLUMN is_archived INTEGER DEFAULT 0");
    }
  });

  // Check for 'user_id' in history
  db.all("PRAGMA table_info(history)", (err, rows) => {
    if (err) console.error(err);
    if (rows && !rows.some(r => r.name === 'user_id')) {
      console.log("Migrating: Adding user_id column to history table");
      db.run("ALTER TABLE history ADD COLUMN user_id INTEGER");
    }
  });

  // Check for 'comments' in tasks
  db.all("PRAGMA table_info(tasks)", (err, rows) => {
    if (err) console.error(err);
    if (rows && !rows.some(r => r.name === 'comments')) {
      console.log("Migrating: Adding comments column to tasks table");
      db.run("ALTER TABLE tasks ADD COLUMN comments TEXT");
    }
  });

  // Check for 'completed_at' in tasks
  db.all("PRAGMA table_info(tasks)", (err, rows) => {
    if (err) console.error(err);
    if (rows && !rows.some(r => r.name === 'completed_at')) {
      console.log("Migrating: Adding completed_at column to tasks table");
      db.run("ALTER TABLE tasks ADD COLUMN completed_at TEXT");
    }
  });

  // Seed Admin User if table is empty
  db.get("SELECT count(*) as count FROM users", [], async (err, row) => {
    if (err) console.error(err);
    if (row.count === 0) {
      console.log("Seeding default admin user...");
      const hashedPassword = await bcrypt.hash('admin123', 10);
      db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hashedPassword, 'admin']);
    }
  });
});

module.exports = db;
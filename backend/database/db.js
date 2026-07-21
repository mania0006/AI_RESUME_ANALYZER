const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'resume.db'));

// Users table — one row per account, password stored as a bcrypt hash (never plaintext)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create the table if it doesn't exist yet
db.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    candidate_name TEXT,
    ats_score INTEGER,
    experience_level TEXT,
    full_analysis TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: if this database already existed before auth was added, the
// 'analyses' table will exist but won't have a user_id column yet.
// CREATE TABLE IF NOT EXISTS is a no-op in that case, so check for the
// column explicitly and add it if missing.
const analysesColumns = db.prepare("PRAGMA table_info(analyses)").all();
const hasUserId = analysesColumns.some((col) => col.name === 'user_id');
if (!hasUserId) {
  db.exec('ALTER TABLE analyses ADD COLUMN user_id INTEGER REFERENCES users(id)');
}

module.exports = db;
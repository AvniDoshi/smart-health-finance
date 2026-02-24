const Database = require("better-sqlite3");
const path = require("path");

const dbPath = process.env.DB_PATH
  ? process.env.DB_PATH
  : path.join(__dirname, "data.sqlite");

const db = new Database(dbPath);

db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS onboarding (
  user_id INTEGER PRIMARY KEY,
  age_range TEXT,
  employment TEXT,
  insurance TEXT,
  income_comfort TEXT,
  topics TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS budget (
  user_id INTEGER PRIMARY KEY,
  monthly_premium REAL DEFAULT 0,
  meds REAL DEFAULT 0,
  primary_visits_per_year INTEGER DEFAULT 0,
  specialist_visits_per_year INTEGER DEFAULT 0,
  copay_primary REAL DEFAULT 0,
  copay_specialist REAL DEFAULT 0,
  emergency_buffer_target REAL DEFAULT 0,
  computed_monthly_estimate REAL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

module.exports = db;
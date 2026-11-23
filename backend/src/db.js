import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

// DB_FILE lets the tests use a temporary in-memory database
const dbFile = process.env.DB_FILE || path.join(dataDir, 'slideshow.db');

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');   // safer when many requests write at once
db.pragma('foreign_keys = ON');    // enforce links between tables

db.exec(`
  CREATE TABLE IF NOT EXISTS visitors (
    visitor_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name    TEXT NOT NULL,
    visitor_code TEXT NOT NULL UNIQUE,
    token_hash   TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS photos (
    photo_id       TEXT PRIMARY KEY,
    visitor_id     INTEGER NOT NULL REFERENCES visitors(visitor_id) ON DELETE CASCADE,
    image_path     TEXT NOT NULL,
    file_hash      TEXT NOT NULL,
    upload_date    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consent_status INTEGER NOT NULL DEFAULT 0 CHECK (consent_status IN (0, 1)),
    display_status TEXT NOT NULL DEFAULT 'visible' CHECK (display_status IN ('visible', 'hidden')),
    UNIQUE (visitor_id, file_hash)
  );

  CREATE TABLE IF NOT EXISTS admin (
    admin_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS slideshow_settings (
    setting_id      INTEGER PRIMARY KEY CHECK (setting_id = 1),
    photo_duration  INTEGER NOT NULL DEFAULT 5,
    transition_type TEXT NOT NULL DEFAULT 'fade'
  );

  CREATE TABLE IF NOT EXISTS removal_requests (
    request_id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id   TEXT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    visitor_id INTEGER NOT NULL REFERENCES visitors(visitor_id) ON DELETE CASCADE,
    reason     TEXT,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO slideshow_settings (setting_id, photo_duration, transition_type)
  VALUES (1, 5, 'fade');
`);

export default db;
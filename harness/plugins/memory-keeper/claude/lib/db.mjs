import Database from "better-sqlite3";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync } from "fs";

function ensureColumn(db, table, column, ddl, fallbackDdl) {
  try {
    db.prepare(`SELECT ${column} FROM ${table} LIMIT 0`).get();
    return;
  } catch {}

  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  } catch {
    if (fallbackDdl) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${fallbackDdl}`);
      } catch {}
    }
  }
}

const DB_DIR = join(homedir(), ".claude", "debug");
const DB_PATH = join(DB_DIR, "memory-keeper.db");

export function getDb() {
  mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // TODO: add migration
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      cwd TEXT,
      project TEXT,
      conversation TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'done', 'skipped', 'error', 'dropped')),
      classification TEXT,
      insight_text TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)
  `);

  // Migrations: add missing columns for existing DBs
  ensureColumn(db, "sessions", "status", "status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'done', 'skipped', 'error', 'dropped'))", "status TEXT DEFAULT 'pending'");
  ensureColumn(db, "sessions", "classification", "classification TEXT");
  ensureColumn(db, "sessions", "insight_text", "insight_text TEXT");
  ensureColumn(db, "sessions", "error_message", "error_message TEXT");
  ensureColumn(db, "sessions", "retry_count", "retry_count INTEGER DEFAULT 0");
  ensureColumn(db, "sessions", "created_at", "created_at TEXT DEFAULT (datetime('now'))", "created_at TEXT");
  ensureColumn(db, "sessions", "processed_at", "processed_at TEXT");

  return db;
}

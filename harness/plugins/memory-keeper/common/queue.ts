/**
 * SQLite-backed queue for async insight processing.
 * Single daemon process owns the DB — no concurrent access concerns.
 * Uses WAL mode for best single-writer performance.
 */

import Database from "better-sqlite3";
import { join } from "path";
import { LOG_DIR } from "./logger.js";
import { logger } from "./logger.js";

const log = logger.child({ component: "queue" });

const DEFAULT_DB_PATH = join(LOG_DIR, "memory-keeper.db");
const MAX_RETRIES = 3;

let db: Database.Database | null = null;

// ─── Schema ──────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  conversation TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('claude', 'pi-cron', 'pi-shutdown', 'pi-manual')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'processing', 'done', 'failed')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  source TEXT NOT NULL,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  total_enqueued INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);
`;

// ─── Types ───────────────────────────────────────────────────────────────

export interface QueueItem {
  id: number;
  sessionId: string;
  project: string;
  conversation: string;
  source: string;
  status: string;
  retryCount: number;
  createdAt: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  done: number;
  failed: number;
  total: number;
}

export interface EnqueueInput {
  sessionId: string;
  project: string;
  conversation: string;
  source: "claude" | "pi-cron" | "pi-shutdown" | "pi-manual";
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function getDb(): Database.Database {
  if (!db) throw new Error("Queue not opened. Call openQueue() first.");
  return db;
}

// ─── Public API ──────────────────────────────────────────────────────────

export function openQueue(dbPath?: string): void {
  if (db) return; // idempotent
  const path = dbPath ?? DEFAULT_DB_PATH;
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  log.info({ path }, "queue opened");
}

export function enqueue(item: EnqueueInput): number {
  const d = getDb();
  const insert = d.prepare(
    `INSERT INTO queue (session_id, project, conversation, source)
     VALUES (?, ?, ?, ?)`
  );
  const upsertSession = d.prepare(
    `INSERT INTO sessions (session_id, project, source, total_enqueued)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(session_id) DO UPDATE SET
       last_seen = datetime('now'),
       total_enqueued = total_enqueued + 1`
  );

  const run = d.transaction(() => {
    const result = insert.run(item.sessionId, item.project, item.conversation, item.source);
    upsertSession.run(item.sessionId, item.project, item.source);
    return result.lastInsertRowid as number;
  });

  const id = run();
  log.debug({ id, sessionId: item.sessionId, source: item.source }, "enqueued");
  return id;
}

export function dequeue(batchSize: number = 5): QueueItem[] {
  const d = getDb();
  const select = d.prepare(
    `SELECT id, session_id, project, conversation, source, status, retry_count, created_at
     FROM queue WHERE status = 'pending'
     ORDER BY created_at ASC LIMIT ?`
  );
  const markProcessing = d.prepare(
    `UPDATE queue SET status = 'processing' WHERE id = ?`
  );

  const run = d.transaction(() => {
    const rows = select.all(batchSize) as Array<{
      id: number;
      session_id: string;
      project: string;
      conversation: string;
      source: string;
      status: string;
      retry_count: number;
      created_at: string;
    }>;
    for (const row of rows) {
      markProcessing.run(row.id);
    }
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      project: r.project,
      conversation: r.conversation,
      source: r.source,
      status: "processing",
      retryCount: r.retry_count,
      createdAt: r.created_at,
    }));
  });

  return run();
}

export function markDone(id: number): void {
  const d = getDb();
  const result = d
    .prepare(
      `UPDATE queue SET status = 'done', processed_at = datetime('now') WHERE id = ?`
    )
    .run(id);
  if (result.changes === 0) {
    log.warn({ id }, "markDone: no row found");
  }
}

export function markFailed(id: number, error: string, retryCount: number): void {
  const d = getDb();
  if (retryCount >= MAX_RETRIES) {
    d.prepare(
      `UPDATE queue SET status = 'failed', error = ?, retry_count = ? WHERE id = ?`
    ).run(error, retryCount, id);
    log.warn({ id, retryCount, error }, "permanently failed");
  } else {
    d.prepare(
      `UPDATE queue SET status = 'pending', error = ?, retry_count = ? WHERE id = ?`
    ).run(error, retryCount, id);
    log.debug({ id, retryCount }, "re-queued for retry");
  }
}

export function getQueueStats(): QueueStats {
  const d = getDb();
  const row = d
    .prepare(
      `SELECT
        COALESCE(SUM(status = 'pending'), 0)    AS pending,
        COALESCE(SUM(status = 'processing'), 0) AS processing,
        COALESCE(SUM(status = 'done'), 0)       AS done,
        COALESCE(SUM(status = 'failed'), 0)     AS failed,
        COUNT(*)                                 AS total
       FROM queue`
    )
    .get() as { pending: number; processing: number; done: number; failed: number; total: number };
  return row;
}

export function gcSessions(keepCount: number = 30): number {
  const d = getDb();
  const run = d.transaction(() => {
    // Find session_ids to delete (beyond the keepCount most recent)
    const toDelete = d
      .prepare(
        `SELECT session_id FROM sessions
         ORDER BY last_seen DESC
         LIMIT -1 OFFSET ?`
      )
      .all(keepCount) as Array<{ session_id: string }>;

    if (toDelete.length === 0) return 0;

    const ids = toDelete.map((r) => r.session_id);
    const placeholders = ids.map(() => "?").join(",");

    d.prepare(`DELETE FROM queue WHERE session_id IN (${placeholders})`).run(
      ...ids
    );
    d.prepare(`DELETE FROM sessions WHERE session_id IN (${placeholders})`).run(
      ...ids
    );

    log.info({ deleted: ids.length }, "gc: removed old sessions");
    return ids.length;
  });

  return run();
}

export function closeQueue(): void {
  if (db) {
    db.close();
    db = null;
    log.debug("queue closed");
  }
}

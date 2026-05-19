// Filesystem-backed event queue. Maildir-style: pending/ → processing/ → unlink (success) | failed/ (terminal).
// All state transitions use rename(), which is atomic on POSIX.

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomBytes } from "crypto";

const QUEUE_ROOT = join(homedir(), ".claude", "debug", "memory-keeper-queue");

export const PENDING_DIR    = join(QUEUE_ROOT, "pending");
export const PROCESSING_DIR = join(QUEUE_ROOT, "processing");
export const FAILED_DIR     = join(QUEUE_ROOT, "failed");

export function ensureDirs() {
  for (const d of [PENDING_DIR, PROCESSING_DIR, FAILED_DIR]) mkdirSync(d, { recursive: true });
}

function newId() {
  // <ms>-<rand6> → lexicographic == FIFO, collision-resistant
  const ms = Date.now().toString().padStart(13, "0");
  const rand = randomBytes(3).toString("hex");
  return `${ms}-${rand}`;
}

/**
 * Enqueue an event. Atomic: writes <id>.json.tmp, fsync, renames to <id>.json.
 * Returns the event id.
 */
export function enqueue(event) {
  ensureDirs();
  const id = newId();
  const record = {
    id,
    event_type: event.event_type,
    session_id: event.session_id ?? null,
    cwd: event.cwd ?? null,
    project: event.project ?? null,
    payload: event.payload ?? null,
    event_data: event.event_data ?? null,
    retry_count: 0,
    error_message: null,
    created_at: new Date().toISOString(),
  };
  const finalPath = join(PENDING_DIR, `${id}.json`);
  const tmpPath = `${finalPath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(record, null, 2));
  renameSync(tmpPath, finalPath); // atomic publish
  return id;
}

/**
 * Pop the oldest pending event and claim it (move pending → processing).
 * Races between multiple daemons are resolved by rename's atomicity; the loser
 * sees ENOENT on rename and retries.
 * Returns { event, processingPath } or null when queue is empty.
 */
export function claimNext() {
  ensureDirs();
  let files;
  try {
    files = readdirSync(PENDING_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  files.sort(); // lexicographic == FIFO

  for (const name of files) {
    const src = join(PENDING_DIR, name);
    const dst = join(PROCESSING_DIR, name);
    try {
      renameSync(src, dst);
    } catch {
      continue; // another worker beat us, try the next
    }
    try {
      const event = JSON.parse(readFileSync(dst, "utf8"));
      return { event, processingPath: dst };
    } catch (err) {
      // Corrupt file — move to failed and continue
      const failedPath = join(FAILED_DIR, name);
      try { renameSync(dst, failedPath); } catch {}
      continue;
    }
  }
  return null;
}

export function complete(processingPath) {
  try { unlinkSync(processingPath); } catch {}
}

/**
 * Requeue a failed event with incremented retry. If retry_count would exceed maxRetries,
 * move to failed/ instead.
 */
export function requeueOrFail(processingPath, event, errMsg, maxRetries) {
  const newRetry = (event.retry_count || 0) + 1;
  const updated = { ...event, retry_count: newRetry, error_message: errMsg, last_failed_at: new Date().toISOString() };
  const name = `${event.id}.json`;

  if (newRetry >= maxRetries) {
    const failedPath = join(FAILED_DIR, name);
    writeFileSync(failedPath, JSON.stringify(updated, null, 2));
    try { unlinkSync(processingPath); } catch {}
    return { terminal: true, path: failedPath };
  }

  const pendingPath = join(PENDING_DIR, name);
  writeFileSync(pendingPath, JSON.stringify(updated, null, 2));
  try { unlinkSync(processingPath); } catch {}
  return { terminal: false, path: pendingPath };
}

/**
 * Recovery: any files left in processing/ from a crashed daemon get moved back to pending/.
 * Returns number recovered.
 */
export function recoverProcessing() {
  ensureDirs();
  let files;
  try { files = readdirSync(PROCESSING_DIR).filter((f) => f.endsWith(".json")); } catch { return 0; }
  let n = 0;
  for (const name of files) {
    try {
      renameSync(join(PROCESSING_DIR, name), join(PENDING_DIR, name));
      n++;
    } catch {}
  }
  return n;
}

export function stats() {
  ensureDirs();
  const count = (dir) => {
    try { return readdirSync(dir).filter((f) => f.endsWith(".json")).length; } catch { return 0; }
  };
  return {
    pending: count(PENDING_DIR),
    processing: count(PROCESSING_DIR),
    failed: count(FAILED_DIR),
  };
}

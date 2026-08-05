/**
 * Session files let a wait be resumed.
 *
 * The caller that opens the window is a short-lived process with a hard time
 * limit (a Claude Code bash injection is killed at 120s). The window itself
 * must outlive it, so the window runs in a detached process that writes its
 * result to a file, and any later call can pick that result up.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STALE_MS = 24 * 60 * 60 * 1000;

/**
 * A fixed path, not TMPDIR.
 *
 * TMPDIR is per-process: a Claude Code session sets its own, so the process
 * that opens the window and the later one that waits for it would look in
 * different directories and never find each other's session.
 */
export function sessionDir() {
  const dir = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "mdshow");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function newSessionId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function resultPath(id) {
  return join(sessionDir(), `${id}.json`);
}

/** Where the window process's stderr goes, so a launch failure leaves evidence. */
export function logPath(id) {
  return join(sessionDir(), `${id}.log`);
}

export function readLog(id) {
  try {
    return readFileSync(logPath(id), "utf8").trim();
  } catch {
    return "";
  }
}

export function writeResult(id, result) {
  writeFileSync(resultPath(id), JSON.stringify(result), "utf8");
}

export function readResult(id) {
  const path = resultPath(id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null; // Half-written file: the next poll gets it.
  }
}

export function dropResult(id) {
  try {
    rmSync(resultPath(id));
  } catch {
    // Already gone.
  }
}

/** Delete result files nobody collected, so the directory does not grow. */
export function pruneStaleResults(now = Date.now()) {
  const dir = sessionDir();
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    try {
      if (now - statSync(path).mtimeMs > STALE_MS) rmSync(path);
    } catch {
      // Raced with another mdshow process.
    }
  }
}

/**
 * Poll for a result until the deadline.
 * @param deadlineMs Infinity waits for as long as the reader needs.
 * @returns the result object, or null when the deadline passed first.
 */
export async function awaitResult(id, deadlineMs, pollMs = 200) {
  const until = Date.now() + deadlineMs;
  for (;;) {
    const result = readResult(id);
    if (result != null) return result;
    if (Date.now() >= until) return null;
    await new Promise((resume) => setTimeout(resume, pollMs));
  }
}

/**
 * The session `wait --last` should pick up, or null.
 *
 * An uncollected result wins over an open window: when the caller that opened
 * the window was killed after the reader submitted, the feedback is sitting in
 * a result file and the window is already gone.
 */
export function lastSession() {
  return uncollectedResults()[0] ?? openSessions()[0] ?? null;
}

/** Session ids whose result nobody has collected, newest first. */
export function uncollectedResults() {
  return newestFirst(".json");
}

/** Session ids that have an open window, newest first. */
export function openSessions() {
  return newestFirst(".open");
}

function newestFirst(suffix) {
  const dir = sessionDir();
  return readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => ({ id: name.slice(0, -suffix.length), at: statSync(join(dir, name)).mtimeMs }))
    .sort((left, right) => right.at - left.at)
    .map((entry) => entry.id);
}

/** Mark a session as having a window on screen, so `wait --last` can find it. */
export function markOpen(id, path) {
  writeFileSync(join(sessionDir(), `${id}.open`), path, "utf8");
}

/** The paths the open window shows, or null when there is no open marker. */
export function openPath(id) {
  try {
    return readFileSync(join(sessionDir(), `${id}.open`), "utf8").trim() || null;
  } catch {
    return null;
  }
}

export function markClosed(id) {
  try {
    rmSync(join(sessionDir(), `${id}.open`));
  } catch {
    // Already gone.
  }
}

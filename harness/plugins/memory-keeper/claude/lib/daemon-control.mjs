// Daemon lifecycle helpers shared between hooks and the daemon itself.

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { spawn } from "child_process";

const DEBUG_DIR = join(homedir(), ".claude", "debug");
const PID_FILE = join(DEBUG_DIR, "memory-keeper-daemon.pid");

export function pidFilePath() {
  return PID_FILE;
}

export function readPidFile() {
  if (!existsSync(PID_FILE)) return null;
  try {
    const raw = readFileSync(PID_FILE, "utf8").trim();
    const obj = raw.startsWith("{") ? JSON.parse(raw) : { pid: parseInt(raw, 10) };
    if (!obj.pid || Number.isNaN(obj.pid)) return null;
    return obj;
  } catch {
    return null;
  }
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === "EPERM"; // EPERM = exists, owned by other user (unlikely here)
  }
}

export function writePidFile(pid) {
  mkdirSync(DEBUG_DIR, { recursive: true });
  writeFileSync(PID_FILE, JSON.stringify({ pid, started_at: Date.now() }));
}

export function removePidFile() {
  try { unlinkSync(PID_FILE); } catch {}
}

export function daemonRunning() {
  const info = readPidFile();
  if (!info) return false;
  if (!isAlive(info.pid)) {
    removePidFile();
    return false;
  }
  return true;
}

export function ensureDaemon(daemonScriptPath) {
  if (daemonRunning()) return { spawned: false };
  const child = spawn("node", [daemonScriptPath], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });
  child.unref();
  return { spawned: true, pid: child.pid };
}

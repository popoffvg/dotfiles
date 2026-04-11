/**
 * Unified pino logger for memory-keeper.
 * Writes structured JSON to file, never to stdout (safe for MCP stdio/SSE transport).
 * Each subsystem gets a child logger with its own `component` field.
 */

import pino from "pino";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync, statSync, unlinkSync, renameSync, existsSync } from "fs";

export const LOG_DIR = join(homedir(), ".claude", "debug");
mkdirSync(LOG_DIR, { recursive: true });

export const LOG_FILE = join(LOG_DIR, "memory-keeper.log");

const MAX_LOG_SIZE = 512 * 1024;
const MAX_LOG_FILES = 3;

function rotateIfNeeded(): void {
  try {
    if (!existsSync(LOG_FILE)) return;
    const { size } = statSync(LOG_FILE);
    if (size < MAX_LOG_SIZE) return;
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const older = `${LOG_FILE}.${i}`;
      const newer = i === 1 ? LOG_FILE : `${LOG_FILE}.${i - 1}`;
      if (existsSync(newer)) {
        if (i === MAX_LOG_FILES - 1 && existsSync(older)) unlinkSync(older);
        renameSync(newer, older);
      }
    }
  } catch {}
}

rotateIfNeeded();

const root = pino(
  {
    level: process.env.MK_LOG_LEVEL || "info",
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.destination({ dest: LOG_FILE, append: true })
);

/** Core library logger */
export const logger = root.child({ component: "core" });

/** Create a child logger for a subsystem */
export function createLogger(component: string) {
  return root.child({ component });
}

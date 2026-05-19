#!/usr/bin/env node
// Long-running daemon: drains the filesystem event queue one item at a time.
// Idle-exits after IDLE_EXIT_MS of an empty queue. Hooks respawn on demand.

import { appendFileSync, mkdirSync, existsSync, writeFileSync, statSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { loadConfig } from "../lib/config.mjs";
import { runClassifier } from "../lib/classifier-cli.mjs";
import { writePidFile, removePidFile, daemonRunning } from "../lib/daemon-control.mjs";
import { claimNext, complete, requeueOrFail, recoverProcessing, stats } from "../lib/queue.mjs";
import { processEvent } from "./process-event.mjs";

const LOG_DIR = join(homedir(), ".claude", "debug");
const LOG_FILE = join(LOG_DIR, "memory-keeper-daemon.log");
const STATS_FILE = join(LOG_DIR, "memory-keeper-stats.json");
const MAX_LOG_SIZE = 512 * 1024;
const MAX_LOG_FILES = 3;

const IDLE_EXIT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 1000;
const MAX_RETRIES = 5;

function rotateLog() {
  try {
    if (!existsSync(LOG_FILE)) return;
    if (statSync(LOG_FILE).size < MAX_LOG_SIZE) return;
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const older = `${LOG_FILE}.${i}`;
      const newer = i === 1 ? LOG_FILE : `${LOG_FILE}.${i - 1}`;
      if (existsSync(newer)) {
        if (i === MAX_LOG_FILES - 1 && existsSync(older)) unlinkSync(older);
        renameSync(newer, older);
      }
    }
    writeFileSync(LOG_FILE, "");
  } catch {}
}

export function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${ts} [${process.pid}] ${msg}\n`);
  } catch {}
}

function writeStats() {
  try {
    const s = stats();
    writeFileSync(STATS_FILE, JSON.stringify({ updated_at: new Date().toISOString(), ...s }, null, 2) + "\n");
  } catch {}
}

let stopping = false;
process.on("SIGTERM", () => { stopping = true; log("SIGTERM received"); });
process.on("SIGINT",  () => { stopping = true; log("SIGINT received"); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (daemonRunning()) {
    log("ABORT another daemon is alive");
    process.exit(0);
  }
  writePidFile(process.pid);
  rotateLog();
  log(`STARTED pid=${process.pid}`);

  const config = loadConfig();
  if (!config.insights_root) {
    log("FATAL no insights_root configured");
    removePidFile();
    process.exit(1);
  }

  if (!config.classifier_command || !config.classifier_command.trim()) {
    log("FATAL classifier_command not set in memory-keeper.local.md");
    removePidFile();
    process.exit(1);
  }
  log(`CLASSIFIER cmd="${config.classifier_command}"`);
  const generate = (prompt) => runClassifier(prompt, config.classifier_command);

  const recovered = recoverProcessing();
  if (recovered > 0) log(`RECOVERED ${recovered} orphaned 'processing' events → pending`);

  let idleSince = Date.now();

  try {
    while (!stopping) {
      const claim = claimNext();

      if (!claim) {
        if (Date.now() - idleSince >= IDLE_EXIT_MS) {
          log(`IDLE-EXIT no work for ${Math.round((Date.now() - idleSince) / 1000)}s`);
          break;
        }
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      idleSince = Date.now();
      const { event, processingPath } = claim;

      try {
        await processEvent({ event, config, generate, log });
        complete(processingPath);
        writeStats();
      } catch (err) {
        const errMsg = String(err?.message || err);
        const r = requeueOrFail(processingPath, event, errMsg, MAX_RETRIES);
        log(`${r.terminal ? "FAILED" : "RETRY"} event=${event.id} type=${event.event_type} retry=${(event.retry_count || 0) + 1} err=${errMsg}`);
        writeStats();
      }
    }
  } finally {
    removePidFile();
    log("STOPPED");
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  main().catch((err) => {
    log(`FATAL ${err.message || err}`);
    removePidFile();
    process.exit(1);
  });
}

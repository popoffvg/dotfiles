#!/usr/bin/env node
// UserPromptSubmit hook: enqueues a `user_prompt` event after a cheap pre-filter,
// then ensures the daemon is alive. Most prompts are filtered out at this layer
// to keep LLM cost bounded.

import { readFileSync, mkdirSync, appendFileSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { enqueue } from "../lib/queue.mjs";
import { loadConfig } from "../lib/config.mjs";
import { ensureDaemon } from "../lib/daemon-control.mjs";

const LOG_DIR = join(homedir(), ".claude", "debug");
const LOG_FILE = join(LOG_DIR, "user-prompt-capture.log");

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${ts} ${msg}\n`);
  } catch {}
}

const MIN_PROMPT_LEN = 30;
const MAX_PROMPT_LEN = 8000;

// Returns null if the prompt should be skipped, else the (possibly trimmed) text.
export function prefilter(promptText) {
  if (!promptText) return null;
  const text = promptText.trim();
  if (text.length < MIN_PROMPT_LEN) return null;

  // Slash command — handled elsewhere, never interesting as memory.
  if (text.startsWith("/")) return null;

  // Wrapped command output / system reminders / local command results.
  if (text.startsWith("<command-") || text.startsWith("<system") || text.startsWith("<local")) return null;

  // Plain "yes / no / ok / continue" affirmatives.
  if (/^(yes|no|ok|okay|continue|go|proceed|sure|do it|next|next\.?)\.?$/i.test(text)) return null;

  // File pastes / pure URLs / pure error tracebacks rarely encode user intent.
  // Cheap heuristic: skip prompts that are >80% lowercase-no-vowel symbol soup.
  // (Kept very conservative — we'd rather classify and drop than skip a real one.)

  return text.slice(0, MAX_PROMPT_LEN);
}

export function detectProject(cwd) {
  if (!cwd) return "unknown";
  try {
    const root = execSync(`git -C "${cwd}" rev-parse --show-toplevel 2>/dev/null`, { encoding: "utf8" }).trim();
    if (root) return basename(root);
  } catch {}
  return basename(cwd);
}

function run() {
  const config = loadConfig();
  if (!config.insights_root) {
    log("SKIP no insights_root");
    process.exit(0);
  }

  const raw = readFileSync("/dev/stdin", "utf8");
  if (!raw.trim()) {
    log("SKIP empty stdin");
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    log("SKIP invalid json");
    process.exit(0);
  }

  const sessionId = input.session_id || input.sessionId || null;
  const cwd = input.cwd || "";
  const promptText = input.prompt || input.user_prompt || input.message || "";

  const filtered = prefilter(promptText);
  if (!filtered) {
    log(`SKIP prefiltered len=${promptText?.length ?? 0}`);
    process.exit(0);
  }

  const project = detectProject(cwd);
  const id = enqueue({
    event_type: "user_prompt",
    session_id: sessionId,
    cwd,
    project,
    payload: filtered,
  });
  log(`ENQUEUE user_prompt id=${id} session=${sessionId} project=${project} len=${filtered.length}`);

  const daemonPath = join(import.meta.dirname, "..", "worker", "daemon.mjs");
  const r = ensureDaemon(daemonPath);
  log(r.spawned ? `DAEMON spawned pid=${r.pid}` : "DAEMON already running");
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) run();

#!/usr/bin/env node
// UserPromptSubmit hook — point the session at the good-design skills, at most once per window.
// Stdin: { session_id, prompt, ... }
// Config at ~/.claude/design-reminder.json:
//   mode         — off | async (log, stay silent) | warn (default)
//   everyMinutes — minimum minutes between two reminders in one session (default 10)
//
// A skill description alone does not fire reliably: `searchable-names` fired 0 of 33 times on
// real naming tasks (harness/plugins/wm/evals/README.md). A hook runs every time.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { makeHookIO } from "./lib/hook-io.mjs";

const io = makeHookIO("design-reminder", { mode: "warn", everyMinutes: 10 });

// Names the skills and the verifier only; the rules live in the skills.
const REMINDER = `Design checkpoint. When this turn writes or changes code, or a markdown doc with code:

- Load the \`good-design-dry\`, \`good-design-kiss\`, and \`good-design-solid\` skills before the first edit.
- After the change is complete, follow \`## For the caller\` in \`~/.claude/agents/good-design-verifier.md\` before you report done.

Ignore this when the turn changes no code.`;

function lastShownPath(sessionId) {
  const dir = join(io.paths.lastFile, "..", "sessions");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${(sessionId || "nosession").replace(/[^\w-]/g, "")}.json`);
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let payload = {};
  try { payload = JSON.parse(input); } catch {}

  const cfg = io.loadCfg();
  if (cfg.mode === "off") process.exit(0);

  const path = lastShownPath(payload.session_id);
  let lastShown = 0;
  try { lastShown = JSON.parse(readFileSync(path, "utf8")).ts || 0; } catch {}
  const now = Date.now();
  if (now - lastShown < cfg.everyMinutes * 60_000) process.exit(0);

  try { writeFileSync(path, JSON.stringify({ ts: now })); } catch (e) { io.log(`design-reminder write err: ${e.message}`); }
  io.writeLast({ ts: now, session: payload.session_id, mode: cfg.mode });
  io.log(`design-reminder shown, session ${payload.session_id}`);
  if (cfg.mode === "async") process.exit(0);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: REMINDER },
  }) + "\n");
  process.exit(0);
}

main().catch((e) => { io.log(`design-reminder fatal: ${e.stack || e.message}`); process.exit(0); });

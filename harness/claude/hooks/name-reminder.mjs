#!/usr/bin/env node
// PostToolUse hook (Write|Edit) — raise the naming rules once every N source edits.
// Stdin: { session_id, tool_name, tool_input: {file_path, ...}, ... }
// Config at ~/.claude/name-reminder.json:
//   mode  — off | async (count, stay silent) | warn (default)
//   every — source edits between reminders (default 50)
//
// Why a counter and not every edit: naming rules apply to a whole diff, not to one
// line, and a reminder on every write becomes wallpaper the model stops reading.
//
// Why a hook and not the skill's own description: measured 2026-08-31 over 60 sessions,
// `searchable-names` fired 0 times out of 33 when a real session hit a naming task, and
// `pedant` fired 0 of 9. A description is a suggestion the model may skip; a hook runs.
// Full numbers: harness/plugins/wm/evals/README.md.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { makeHookIO } from "./lib/hook-io.mjs";
import { CODE_EXT } from "./lib/text.mjs";

const io = makeHookIO("name-reminder", {
  mode: "warn",
  every: 50,
});

// The reminder names the rules and points at their one home. It never restates them —
// a second copy here would drift from the skill the first time either is edited.
const REMINDER = `Naming checkpoint — %COUNT% source edits since the last one.

Read the names this session has written, against the \`searchable-names\` skill:

- one term per concept; a synonym splits every future search
- a public name is 2-4 words, one of them a domain word; a generic verb takes its object
- one searchable concept per file; never \`types\`, \`utils\`, \`helpers\`, \`config\`
- a domain id is a named type, never a bare primitive
- a metric, event, or flag string is one whole literal, never built from parts
- every error and log message opens with a unique literal prefix

Load the skill for the rule you need. Rename in this commit, not a later one — the rules
say a rename rides with the change that made the old name wrong.`;

function counterPath(sessionId) {
  const dir = join(io.paths.lastFile, "..", "counts");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${(sessionId || "nosession").replace(/[^\w-]/g, "")}.json`);
}

function bump(path) {
  let count = 0;
  try { count = JSON.parse(readFileSync(path, "utf8")).count || 0; } catch {}
  count += 1;
  try { writeFileSync(path, JSON.stringify({ count })); } catch (e) { io.log(`write err: ${e.message}`); }
  return count;
}

function reset(path) {
  try { writeFileSync(path, JSON.stringify({ count: 0 })); } catch {}
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let payload = {};
  try { payload = JSON.parse(input); } catch {}

  const cfg = io.loadCfg();
  if (cfg.mode === "off") process.exit(0);

  // Only source edits count. A run of markdown or JSON edits must not spend the
  // budget, or the reminder lands in a session that wrote no names at all.
  const file = payload.tool_input?.file_path || "";
  if (!CODE_EXT.has(extname(file))) process.exit(0);

  const path = counterPath(payload.session_id);
  const count = bump(path);
  if (count < cfg.every) process.exit(0);

  reset(path);
  io.writeLast({ ts: Date.now(), file, count, mode: cfg.mode });
  io.log(`reminder at ${count} source edits (last: ${file})`);

  if (cfg.mode === "async") process.exit(0);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: REMINDER.replace("%COUNT%", String(count)),
    },
  }) + "\n");
  process.exit(0);
}

main().catch((e) => { io.log(`fatal: ${e.stack || e.message}`); process.exit(0); });

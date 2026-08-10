#!/usr/bin/env node
// Stop hook — catch an absence claim built on evidence that cannot support it.
// Stdin: { session_id, transcript_path, stop_hook_active, ... }
// Behavior depends on mode in ~/.claude/claim-check.json:
//   off    — no-op
//   async  — log only, never blocks
//   strict — block when an absence claim rests on suppressed or truncated output  [default]
//
// No model call: a `claude -p` grader costs ~6s and ~$0.05 per turn on this
// machine, because the child inherits the parent's whole config. This checks the
// two failure modes that are mechanically decidable from the turn's own tool
// calls. The judgment cases live in the `claim-evidence` skill instead.

import { readFileSync } from "fs";
import { makeHookIO } from "./lib/hook-io.mjs";

const io = makeHookIO("claim-check", { mode: "strict" });

// A search whose emptiness is the finding must not hide stderr: `2>/dev/null`
// collapses command-not-found, no-such-directory, and permission-denied into the
// same silence as a genuine zero match.
const SUPPRESSED = /\b(grep|rg|ag|find|fd|ls)\b[^;|&]*2>\s*\/dev\/null/;

// Output cut before the assistant read it cannot support "X is not there".
const TRUNCATED = /\|\s*(head|tail)\b|--limit[= ]|--max-count[= ]|-m\s*\d+/;

// The claim that those two cannot support.
const ABSENCE = /\b(does not exist|doesn'?t exist|no such|not present|nothing found|zero hits|no hits|not found anywhere|never (called|used|referenced)|unused|(has|have|contains?) no \S|there (is|are) no)/i;

function readTurn(transcriptPath) {
  let raw = "";
  try { raw = readFileSync(transcriptPath, "utf8"); } catch { return null; }
  const lines = raw.trimEnd().split("\n");
  const commands = [];
  let finalText = "";

  // Walk back to the most recent human turn, collecting Bash commands on the way.
  for (let i = lines.length - 1; i >= 0; i--) {
    let rec;
    try { rec = JSON.parse(lines[i]); } catch { continue; }
    if (rec.type === "user" && rec.origin?.kind === "human") break;

    const content = rec.message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block.type === "tool_use" && block.name === "Bash" && block.input?.command) {
        commands.push(block.input.command);
      }
      if (rec.type === "assistant" && block.type === "text" && block.text?.trim() && !finalText) {
        finalText = block.text.trim();
      }
    }
  }
  return { commands, finalText };
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let payload = {};
  try { payload = JSON.parse(input); } catch {}

  // Never re-enter: a blocked stop feeds our own message back into the turn.
  if (payload.stop_hook_active) process.exit(0);

  const cfg = io.loadCfg();
  if (cfg.mode === "off") process.exit(0);

  const turn = readTurn(payload.transcript_path || "");
  if (!turn || !turn.finalText) process.exit(0);
  if (!ABSENCE.test(turn.finalText)) process.exit(0);

  // Already hedged? The message is doing the right thing.
  if (/\bunverified\b|\bnot verified\b|\bfirst \d+ results\b|\bas of \d/i.test(turn.finalText)) process.exit(0);

  const suppressed = turn.commands.filter((c) => SUPPRESSED.test(c));
  const truncated = turn.commands.filter((c) => TRUNCATED.test(c));
  if (!suppressed.length && !truncated.length) process.exit(0);

  const lines = ["⚠ claim-check — this turn asserts an absence on evidence that cannot support it."];
  if (suppressed.length) {
    lines.push("\nstderr was suppressed, so an empty result may mean the command never ran:");
    for (const c of suppressed.slice(0, 3)) lines.push(`  ${c.slice(0, 160)}`);
    lines.push("  Re-run without `2>/dev/null` and check the exit code (grep/rg: 0 matched, 1 no match, 2 error, 127 binary missing).");
    lines.push("  Only exit 1 supports \"not there\". Add a positive control on a term you know is present.");
  }
  if (truncated.length) {
    lines.push("\noutput was cut, so it cannot support a claim about the whole corpus:");
    for (const c of truncated.slice(0, 3)) lines.push(`  ${c.slice(0, 160)}`);
    lines.push("  Re-run unbounded and scoped to the thing itself, or say \"not in the first N results\".");
  }
  lines.push("\nRun the check, or restate the claim as what was actually observed.");
  const msg = lines.join("\n");

  io.writeLast({ ts: Date.now(), suppressed, truncated, mode: cfg.mode });
  io.log(`flagged: suppressed=${suppressed.length} truncated=${truncated.length}`);

  if (cfg.mode !== "strict") process.exit(0);
  process.stderr.write(msg + "\n");
  process.exit(2);
}

main().catch((e) => { io.log(`fatal: ${e.stack || e.message}`); process.exit(0); });

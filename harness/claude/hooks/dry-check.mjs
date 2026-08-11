#!/usr/bin/env node
// Stop hook — catch a final message that says the same thing twice.
// Stdin: { session_id, transcript_path, stop_hook_active, ... }
// Behavior depends on mode in ~/.claude/dry-check.json:
//   off    — no-op
//   async  — log only, never blocks
//   strict — block when one block of the message restates an earlier one  [default]
//
// No model call, for the reason claim-check.mjs states: a `claude -p` grader
// costs seconds and cents on every turn. Bigram overlap between blocks of the
// same message is decidable from the text alone.

import { readFileSync } from "fs";
import { makeHookIO } from "./lib/hook-io.mjs";
import { tokenize, bigrams } from "./lib/text.mjs";

const io = makeHookIO("dry-check", {
  mode: "strict",
  minRatio: 0.55,     // share of the later block's bigrams already in an earlier block
  minShared: 6,       // absolute floor, so a short block cannot trip on a high ratio
  minWords: 12,       // blocks below this are too short to judge
  recapRatio: 0.3,    // lower bar for a block whose heading announces a recap
});

// Split on blank lines, but keep a fenced code block whole so its ``` lines
// never start a new block. Fenced blocks are dropped afterwards: a command
// shown next to its output repeats on purpose.
function splitBlocks(text) {
  const blocks = [];
  let cur = [];
  let inFence = false;
  const flush = () => { if (cur.length) blocks.push(cur.join("\n")); cur = []; };

  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      cur.push(line);
      if (!inFence) flush();
      continue;
    }
    if (!inFence && !line.trim()) { flush(); continue; }
    cur.push(line);
  }
  flush();
  return blocks.filter((b) => !/^\s*```/.test(b));
}

const RECAP = /^\s*(#{1,6}\s*)?(\*\*)?\s*(summary|recap|in short|in summary|to summarize|to sum up|takeaways?|conclusion)\b/i;

function analyze(text, cfg) {
  const blocks = splitBlocks(text);
  const grams = blocks.map((b) => ({ raw: b, toks: tokenize(b) }));
  const findings = [];

  for (let j = 1; j < grams.length; j++) {
    const later = grams[j];
    if (later.toks.length < cfg.minWords) continue;
    const lg = bigrams(later.toks);
    if (!lg.size) continue;

    for (let i = 0; i < j; i++) {
      const earlier = grams[i];
      if (earlier.toks.length < 4) continue;
      const eg = bigrams(earlier.toks);
      let shared = 0;
      for (const g of lg) if (eg.has(g)) shared++;
      const ratio = shared / lg.size;
      const bar = RECAP.test(later.raw) ? cfg.recapRatio : cfg.minRatio;
      if (ratio >= bar && shared >= cfg.minShared) {
        findings.push({ earlier: i, later: j, ratio: +ratio.toFixed(2), shared,
                        earlierHead: head(earlier.raw), laterHead: head(later.raw) });
        break; // one report per repeating block; the earliest source is the one to reference
      }
    }
  }
  return { blockCount: blocks.length, findings };
}

function head(block) {
  return block.replace(/\s+/g, " ").trim().slice(0, 90);
}

// The most recent assistant message, all its text blocks joined. Stops at the
// last human turn so an earlier assistant message cannot leak in.
function readFinalText(transcriptPath) {
  let raw = "";
  try { raw = readFileSync(transcriptPath, "utf8"); } catch { return ""; }
  const lines = raw.trimEnd().split("\n");
  const parts = [];

  for (let i = lines.length - 1; i >= 0; i--) {
    let rec;
    try { rec = JSON.parse(lines[i]); } catch { continue; }
    if (rec.type === "user" && rec.origin?.kind === "human") break;
    if (rec.type !== "assistant") continue;
    const content = rec.message?.content;
    if (!Array.isArray(content)) continue;
    const texts = content.filter((b) => b.type === "text" && b.text?.trim()).map((b) => b.text.trim());
    if (texts.length) { parts.push(texts.join("\n\n")); break; }
  }
  return parts.join("\n\n");
}

function format(findings) {
  const lines = ["⚠ dry-check — this message says the same thing twice."];
  for (const f of findings) {
    lines.push("");
    lines.push(`  block ${f.later} repeats block ${f.earlier} (${Math.round(f.ratio * 100)}% of its word pairs, ${f.shared} shared):`);
    lines.push(`    earlier: ${f.earlierHead}`);
    lines.push(`    later:   ${f.laterHead}`);
  }
  lines.push("");
  lines.push("Delete the later block, or replace it with a pointer to the earlier one.");
  lines.push("A table or list already states its content — do not narrate it again in prose.");
  return lines.join("\n");
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

  const text = readFinalText(payload.transcript_path || "");
  if (!text) process.exit(0);

  const { blockCount, findings } = analyze(text, cfg);
  if (!findings.length) process.exit(0);

  io.writeLast({ ts: Date.now(), blockCount, findings, mode: cfg.mode });
  io.log(`flagged: ${findings.length} repeating block(s) of ${blockCount}`);

  if (cfg.mode !== "strict") process.exit(0);
  process.stderr.write(format(findings) + "\n");
  process.exit(2);
}

main().catch((e) => { io.log(`fatal: ${e.stack || e.message}`); process.exit(0); });

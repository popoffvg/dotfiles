#!/usr/bin/env node
// PostToolUse hook (Write|Edit) — catch a comment that says what the code says.
// Stdin: { tool_name, tool_input: {file_path, content | old_string, new_string}, ... }
// Behavior depends on mode in ~/.claude/comment-check.json:
//   off    — no-op
//   async  — log only
//   warn   — feed the findings back as additionalContext, never blocks  [default]
//   strict — exit 2, so the turn must fix the comment before it ends
//
// The deletion test this automates: delete the comment, read the line below,
// name the fact you lost. No fact lost — the comment was a restatement.
//
// No model call. Two properties decide it: how much of the comment's vocabulary
// is already visible in the code under it, and whether the comment states a
// reason. A reason carries a causal or contrast word; a paraphrase does not.

import { readFileSync, existsSync } from "fs";
import { extname } from "path";
import { makeHookIO } from "./lib/hook-io.mjs";
import { tokenize, codeWords } from "./lib/text.mjs";

const io = makeHookIO("comment-check", {
  mode: "warn",
  minRatio: 0.7,    // share of the comment's words already visible in the code window
  minWords: 3,      // below this a comment is a label, not a claim
  window: 3,        // code lines under the comment that count as "the code below"
});

// Prose that states an invariant, an assumption, or a rejected alternative uses
// one of these. Their absence is what separates a reason from a paraphrase.
const REASON = /\b(because|since|so|hence|therefore|otherwise|unless|but|not|never|no|cannot|can't|must|would|could|only|instead|rather|deliberately|on purpose|beware|caution|assumes?|invariant|breaks?|fails?|prevents?|stops?|avoids?|guards?|else)\b/i;

// Whole-line comments only. A trailing `#` or `//` inside a string literal is
// not worth the parser it would take to exclude.
const LINE_COMMENT = /^\s*(\/\/+|#+|--|;+|\*|\/\*+)/;
const CODE_EXT = new Set([".tengo", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".go", ".py", ".sh",
  ".bash", ".zsh", ".rs", ".java", ".rb", ".c", ".h", ".cc", ".cpp", ".hpp", ".kt", ".swift",
  ".lua", ".sql", ".php", ".scala", ".m", ".mm"]);

// A doc tag whose only content is the parameter's own name and its type.
const DOC_TAG = /^\s*(\*\s*)?@(param|arg|argument|return|returns|type)\b(.*)$/i;
const TYPE_WORD = /^(string|number|int|integer|long|double|float|bool|boolean|object|map|array|list|any|void|undefined|null|byte|char|\[\]|\{\}|[A-Za-z_][\w.]*\[\])$/i;

function stripMarker(line) {
  return line.replace(LINE_COMMENT, "").replace(/\*\/\s*$/, "");
}

// Consecutive comment lines are one unit: a paragraph explaining a declaration
// must be judged whole, not line by line.
function commentUnits(lines) {
  const units = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    if (LINE_COMMENT.test(lines[i]) && !/^\s*#!/.test(lines[i])) {
      if (!cur) cur = { start: i, lines: [] };
      cur.lines.push(lines[i]);
      continue;
    }
    if (cur) { units.push(cur); cur = null; }
  }
  if (cur) units.push(cur);
  return units;
}

function codeWindow(lines, afterIdx, count) {
  const out = [];
  for (let i = afterIdx; i < lines.length && out.length < count; i++) {
    if (!lines[i].trim() || LINE_COMMENT.test(lines[i])) continue;
    out.push(lines[i]);
  }
  return out;
}

// A comment word counts as visible in the code when every piece it splits into
// is a word the code already spells — so `liabilityType` covers "liability".
function visible(token, codeSet) {
  const pieces = [...codeWords([token])];
  return pieces.length > 0 && pieces.every((p) => codeSet.has(p));
}

function emptyDocTags(unit) {
  const hits = [];
  for (const line of unit.lines) {
    const m = line.match(DOC_TAG);
    if (!m) continue;
    const tag = m[2].toLowerCase();
    let rest = (m[3] || "").replace(/[:\-–—,]/g, " ").trim().split(/\s+/).filter(Boolean);
    // On `@param`, the first token is the parameter's own name — the signature
    // already spells it, so it is not prose.
    if (/^(param|arg|argument)$/.test(tag)) rest = rest.slice(1);
    if (rest.filter((w) => !TYPE_WORD.test(w)).length === 0) hits.push(line.trim());
  }
  return hits;
}

function analyze(text, cfg) {
  const lines = text.split("\n");
  const findings = [];

  for (const unit of commentUnits(lines)) {
    const body = unit.lines.map(stripMarker).join(" ").trim();
    const head = body.replace(/\s+/g, " ").slice(0, 90);

    for (const tag of emptyDocTags(unit)) {
      findings.push({ line: unit.start + 1 + unit.lines.findIndex((l) => l.trim() === tag),
                      kind: "empty doc tag", head: tag, anchor: tag });
    }

    // A divider or banner has no sentence to judge.
    if (/^[\s─=\-*#]+$/.test(body)) continue;

    const window = codeWindow(lines, unit.start + unit.lines.length, cfg.window);
    if (!window.length) continue;              // trailing comment, nothing under it

    const toks = tokenize(body);
    if (toks.length < cfg.minWords) continue;
    if (REASON.test(body)) continue;            // states a reason, not a paraphrase

    const codeSet = codeWords(window);
    let shared = 0;
    for (const t of toks) if (visible(t, codeSet)) shared++;
    const ratio = shared / toks.length;
    if (ratio >= cfg.minRatio) {
      findings.push({ line: unit.start + 1, kind: "restates the code", head,
                      ratio: +ratio.toFixed(2), code: window[0].trim().slice(0, 90),
                      anchor: unit.lines[0].trim() });
    }
  }
  return findings;
}

// Judge the file as it now stands on disk, so line numbers are real, but report
// only units the edit itself introduced.
function addedText(input, toolName) {
  if (toolName === "Write") return input.content || "";
  const before = new Set((input.old_string || "").split("\n").map((l) => l.trim()));
  return (input.new_string || "")
    .split("\n")
    .filter((l) => !before.has(l.trim()))
    .join("\n");
}

function format(findings, file) {
  const lines = ["⚠ comment-check — a comment here repeats what the code says."];
  for (const f of findings) {
    lines.push("");
    if (f.kind === "empty doc tag") {
      lines.push(`  ${file}:${f.line} — the tag states only the name and the type:`);
      lines.push(`    ${f.head}`);
    } else {
      lines.push(`  ${file}:${f.line} — ${Math.round(f.ratio * 100)}% of the comment's words are in the code under it:`);
      lines.push(`    comment: ${f.head}`);
      lines.push(`    code:    ${f.code}`);
    }
  }
  lines.push("");
  lines.push("Apply the deletion test: delete the comment, read the code, name the fact you lost.");
  lines.push("No fact lost — delete it. A fact lost — write that fact alone (an invariant, an");
  lines.push("assumption about another system, a rejected alternative), not what the code shows.");
  return lines.join("\n");
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let payload = {};
  try { payload = JSON.parse(input); } catch {}

  const cfg = io.loadCfg();
  if (cfg.mode === "off") process.exit(0);

  const toolInput = payload.tool_input || {};
  const file = toolInput.file_path || "";
  if (!CODE_EXT.has(extname(file))) process.exit(0);
  if (!existsSync(file)) process.exit(0);

  let onDisk = "";
  try { onDisk = readFileSync(file, "utf8"); } catch { process.exit(0); }

  const added = addedText(toolInput, payload.tool_name || "");
  const addedLines = new Set(added.split("\n").map((l) => l.trim()).filter(Boolean));
  if (!addedLines.size) process.exit(0);

  // The unit is judged in its on-disk context, but reported only when the edit
  // itself wrote its opening line.
  const findings = analyze(onDisk, cfg).filter((f) => addedLines.has(f.anchor));
  if (!findings.length) process.exit(0);

  const msg = format(findings, file);
  io.writeLast({ ts: Date.now(), file, findings, mode: cfg.mode });
  io.log(`${file}: ${findings.length} finding(s)`);

  if (cfg.mode === "async") process.exit(0);
  if (cfg.mode === "strict") {
    process.stderr.write(msg + "\n");
    process.exit(2);
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg },
  }) + "\n");
  process.exit(0);
}

main().catch((e) => { io.log(`fatal: ${e.stack || e.message}`); process.exit(0); });

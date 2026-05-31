#!/usr/bin/env node
// UserPromptSubmit hook — prompt-coach.
// Stdin: { session_id, prompt, ... }
// Behavior depends on mode in ~/.claude/prompt-coach.json:
//   off    — no-op
//   async  — log only, never blocks, no inline output
//   warn   — print critique to stdout (visible + appended to context), never blocks  [default]
//   strict — block only when score ≤ MIN_SCORE
//   block  — block on any flagged prompt

import { readFileSync, mkdirSync, appendFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir, tmpdir } from "os";
import { spawnSync } from "child_process";

const CFG_PATH = join(homedir(), ".claude", "prompt-coach.json");
const LOG_DIR = join(homedir(), ".claude", "debug");
const LOG_FILE = join(LOG_DIR, "prompt-coach.log");
const STATE_DIR = join(tmpdir(), "prompt-coach");
const LAST_FILE = join(STATE_DIR, "last.json");

const DEFAULT_CFG = {
  mode: "warn",          // off | async | warn | strict | block
  minScore: 10,          // /25, below this counts as "bad" for strict/block
  budgetMs: 1500,        // hard ceiling on analyzer wall time
  minPromptChars: 20,    // skip very short prompts
  model: "claude-haiku-4-5",
};

function log(msg) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
  } catch {}
}

function loadCfg() {
  try {
    if (existsSync(CFG_PATH)) {
      return { ...DEFAULT_CFG, ...JSON.parse(readFileSync(CFG_PATH, "utf8")) };
    }
  } catch (e) { log(`cfg parse err: ${e.message}`); }
  return DEFAULT_CFG;
}

// Cheap regex pre-filter. Returns issues without LLM call.
// Returns null if nothing suspicious → skip LLM entirely.
function preFilter(prompt) {
  const issues = [];
  const lower = prompt.toLowerCase();
  const hasFileRef = /[\w./-]+\.(ts|tsx|js|mjs|go|py|md|json|sh|rs|java|rb)(:\d+)?/.test(prompt);
  const hasVagueVerb = /\b(fix|improve|make better|clean up|refactor|update)\b/.test(lower);
  const hasPronounNoAntecedent = /^\s*(fix|do|make|update|change)\s+(it|this|that|them)\b/i.test(prompt);
  const tooShort = prompt.trim().length < 40;
  const hasSuccessCue = /\b(done when|so that|until|test|passes?|verify|expect)\b/i.test(prompt);

  if (hasVagueVerb && !hasFileRef) issues.push({ dim: "context", msg: "vague verb without file/path reference" });
  if (hasPronounNoAntecedent) issues.push({ dim: "resolvability", msg: "starts with unresolved pronoun" });
  if (tooShort && hasVagueVerb) issues.push({ dim: "goal", msg: "very short + vague — what's the goal?" });
  if (!hasSuccessCue && hasVagueVerb) issues.push({ dim: "success", msg: "no success criteria stated" });

  return issues.length ? issues : null;
}

function format(critique) {
  const { score, dimensions, issues, rewrite } = critique;
  const lines = [];
  lines.push(`⚠ prompt-coach (score ${score ?? "?"}/25)`);
  if (dimensions) {
    const d = dimensions;
    lines.push(`  goal:${d.goal} ctx:${d.context} success:${d.success} scope:${d.scope} resolv:${d.resolvability}`);
  }
  for (const i of (issues || [])) {
    lines.push(`  ✗ ${i.dim.padEnd(13)} ${i.msg}`);
  }
  if (rewrite) {
    lines.push("");
    lines.push("  suggested rewrite:");
    for (const ln of wrap(rewrite, 72)) lines.push(`  ${ln}`);
  }
  return lines.join("\n");
}

function wrap(s, w) {
  const out = []; let line = "";
  for (const word of s.split(/\s+/)) {
    if ((line + " " + word).length > w) { out.push(line); line = word; }
    else line = line ? line + " " + word : word;
  }
  if (line) out.push(line);
  return out;
}

// Call Haiku via `claude -p` for a structured critique. Synchronous, time-boxed.
function callLLM(prompt, cfg, rubric) {
  const sys = `You are a prompt-quality reviewer. Apply the rubric below to the user's prompt. Output ONLY valid JSON matching the schema. No prose.\n\n${rubric}`;
  const user = `Prompt to review:\n---\n${prompt}\n---`;
  const args = ["-p", "--output-format", "json", "--model", cfg.model, "--system-prompt", sys, user];
  const res = spawnSync("claude", args, { timeout: cfg.budgetMs, encoding: "utf8" });
  if (res.status !== 0 || !res.stdout) { log(`llm err: status=${res.status} stderr=${res.stderr?.slice(0, 200)}`); return null; }
  try {
    const outer = JSON.parse(res.stdout);
    const text = outer.result || outer.text || res.stdout;
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]);
  } catch (e) { log(`llm parse err: ${e.message}`); return null; }
}

function writeLast(payload) {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(LAST_FILE, JSON.stringify(payload, null, 2));
  } catch (e) { log(`writeLast err: ${e.message}`); }
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let payload = {};
  try { payload = JSON.parse(input); } catch {}
  const prompt = (payload.prompt || "").trim();
  if (!prompt) process.exit(0);

  const cfg = loadCfg();
  if (cfg.mode === "off") process.exit(0);
  if (prompt.length < cfg.minPromptChars) process.exit(0);
  // Skip slash commands and pure tool invocations.
  if (prompt.startsWith("/")) process.exit(0);

  const cheap = preFilter(prompt);
  if (!cheap) {
    writeLast({ prompt, ts: Date.now(), skipped: "prefilter-clean" });
    process.exit(0);
  }

  let critique = null;
  if (cfg.mode !== "async") {
    const rubricPath = join(process.env.CLAUDE_PLUGIN_ROOT || ".", "common", "rubric.md");
    let rubric = "";
    try { rubric = readFileSync(rubricPath, "utf8"); } catch {}
    if (rubric) critique = callLLM(prompt, cfg, rubric);
  }

  // Fall back to cheap pre-filter findings if LLM unavailable.
  if (!critique) {
    critique = {
      score: 25 - cheap.length * 4,
      issues: cheap,
      rewrite: null,
    };
  }

  writeLast({ prompt, ts: Date.now(), critique, mode: cfg.mode });

  if (cfg.mode === "async") process.exit(0);

  const msg = format(critique);
  const score = critique.score ?? 25;
  const bad = score <= cfg.minScore;

  if (cfg.mode === "block" || (cfg.mode === "strict" && bad)) {
    // Block the prompt.
    process.stderr.write(msg + "\n\n→ blocked. revise prompt, or `/coach-mode warn` to soften.\n");
    process.exit(2);
  }

  // warn / strict-but-not-bad: print to stdout (Claude Code shows it AND appends to context).
  process.stdout.write(msg + "\n");
  process.exit(0);
}

main().catch((e) => { log(`fatal: ${e.stack || e.message}`); process.exit(0); });

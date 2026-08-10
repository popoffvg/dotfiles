// Shared plumbing for hooks that grade text with a cheap model.
// One factory per hook name gives it a config file, a debug log, a state dir,
// and a time-boxed `claude -p` call that returns parsed JSON or null.
//
// Config lives at ~/.claude/<name>.json and overrides the caller's defaults, so
// a mode can be flipped without editing the hook.

import { readFileSync, mkdirSync, appendFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir, tmpdir } from "os";
import { spawnSync } from "child_process";

export function makeHookIO(name, defaultCfg) {
  const cfgPath = join(homedir(), ".claude", `${name}.json`);
  const logDir = join(homedir(), ".claude", "debug");
  const logFile = join(logDir, `${name}.log`);
  const stateDir = join(tmpdir(), name);
  const lastFile = join(stateDir, "last.json");

  function log(msg) {
    try {
      mkdirSync(logDir, { recursive: true });
      appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
    } catch {}
  }

  function loadCfg() {
    try {
      if (existsSync(cfgPath)) {
        return { ...defaultCfg, ...JSON.parse(readFileSync(cfgPath, "utf8")) };
      }
    } catch (e) { log(`cfg parse err: ${e.message}`); }
    return defaultCfg;
  }

  function writeLast(payload) {
    try {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(lastFile, JSON.stringify(payload, null, 2));
    } catch (e) { log(`writeLast err: ${e.message}`); }
  }

  // Read a rubric markdown file sitting next to the hook that calls this.
  function readRubric(hookDir, filename) {
    try { return readFileSync(join(hookDir, filename), "utf8"); } catch { return ""; }
  }

  // Time-boxed structured critique. Returns the parsed JSON object or null.
  function callLLM({ system, user, model, budgetMs }) {
    const args = ["-p", "--output-format", "json", "--model", model, "--system-prompt", system, user];
    const res = spawnSync("claude", args, { timeout: budgetMs, encoding: "utf8" });
    if (res.status !== 0 || !res.stdout) {
      log(`llm err: status=${res.status} stderr=${res.stderr?.slice(0, 200)}`);
      return null;
    }
    try {
      const outer = JSON.parse(res.stdout);
      const text = outer.result || outer.text || res.stdout;
      const m = text.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    } catch (e) { log(`llm parse err: ${e.message}`); return null; }
  }

  return { log, loadCfg, writeLast, readRubric, callLLM, paths: { cfgPath, logFile, lastFile } };
}

export function wrap(s, w) {
  const out = []; let line = "";
  for (const word of s.split(/\s+/)) {
    if ((line + " " + word).length > w) { out.push(line); line = word; }
    else line = line ? line + " " + word : word;
  }
  if (line) out.push(line);
  return out;
}

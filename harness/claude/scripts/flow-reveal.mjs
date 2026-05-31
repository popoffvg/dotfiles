#!/usr/bin/env node
// flow-reveal: resolve the real source behind a workflow-pseudocode binding and open it in Zed.
//
// Two binding layers (see skills/explore "Workflow TS schema"):
//   - notable `if` lines in a *.workflow.ts carry an inline `// <ULID>` comment;
//     the ULID -> {source, repo?} mapping lives in a sibling *.bindings.json.
//   - component declarations in a *.d.ts carry a JSDoc `@source <path:line>` tag.
//
// Usage:
//   flow-reveal.mjs reveal <file> <row>     read line <row> (1-based) of <file>, resolve, open in Zed
//   flow-reveal.mjs reveal <file> <row> --print   resolve and print the target; do NOT open
//   flow-reveal.mjs check  <dir>            lint: every ULID/@source resolves to an existing path:line
//
// Source paths resolve relative to a binding's "repo" (if given), else $ZED_WORKTREE_ROOT,
// else the nearest git root above <file>. Exit codes: 0 ok, 1 not found / lint failure, 2 usage.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, isAbsolute, resolve as pathResolve } from "node:path";

// Crockford base32, 26 chars — a ULID. Anchored so it matches the whole token.
const ULID_RE = /\b([0-9A-HJKMNP-TV-Z]{26})\b/;
const SOURCE_TAG_RE = /@source\s+(\S+?:\d+(?::\d+)?)/;

function fail(msg, code = 1) {
  process.stderr.write(`flow-reveal: ${msg}\n`);
  process.exit(code);
}

function gitRoot(startDir) {
  const r = spawnSync("git", ["-C", startDir, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : null;
}

function readLines(file) {
  return readFileSync(file, "utf8").split("\n");
}

// Find the sibling bindings json for a workflow file, then any *.bindings.json in the dir.
function findBindingsFiles(file) {
  const dir = dirname(file);
  const out = [];
  const stem = file.replace(/\.workflow\.ts$/, "").replace(/\.[^.]+$/, "");
  const preferred = `${stem}.bindings.json`;
  if (existsSync(preferred)) out.push(preferred);
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".bindings.json")) {
      const p = join(dir, name);
      if (!out.includes(p)) out.push(p);
    }
  }
  return out;
}

function lookupUlid(file, ulid) {
  for (const bf of findBindingsFiles(file)) {
    let map;
    try {
      map = JSON.parse(readFileSync(bf, "utf8"));
    } catch (e) {
      fail(`invalid JSON in ${bf}: ${e.message}`);
    }
    if (map && Object.prototype.hasOwnProperty.call(map, ulid)) {
      return { entry: map[ulid], bindingsFile: bf };
    }
  }
  return null;
}

// Look for an @source tag on `row`, else scan upward through the enclosing JSDoc block.
function findSourceTag(lines, row) {
  for (let i = row - 1; i >= 0 && i >= row - 1 - 30; i--) {
    const m = SOURCE_TAG_RE.exec(lines[i]);
    if (m) return m[1];
    // stop if we walked above the start of a JSDoc block boundary far from the line
    if (i < row - 2 && /\*\//.test(lines[i]) && i !== row - 1) break;
  }
  return null;
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Resolve a binding's source ref to an absolute "path:line[:col]" Zed can open.
// Absolute source paths are used as-is. Relative ones resolve against, in order:
// an explicit per-binding repo, the Zed worktree root (the open project — where the
// real source lives), the workflow file's git root, then the file's directory.
function resolveTarget(entry, file, source) {
  if (isAbsolute(source)) return source;
  if (entry && entry.repo) return join(entry.repo, source);
  const z = process.env.ZED_WORKTREE_ROOT;
  // Zed sets ZED_WORKTREE_ROOT to the *file path* when a single file (not a folder)
  // is opened, so trust it only when it is a directory.
  if (z && isDir(z)) return join(z, source);
  const gr = gitRoot(dirname(file));
  if (gr) return join(gr, source);
  return join(dirname(file), source);
}

// Resolve the source ref for line `row` (1-based) of `file`. Returns {target, source, via} or null.
function resolveAtLine(file, row) {
  const lines = readLines(file);
  if (row < 1 || row > lines.length) fail(`row ${row} out of range for ${file}`);
  const line = lines[row - 1];

  const um = ULID_RE.exec(line);
  if (um) {
    const hit = lookupUlid(file, um[1]);
    if (!hit) fail(`ULID ${um[1]} not found in any *.bindings.json beside ${file}`);
    const source = typeof hit.entry === "string" ? hit.entry : hit.entry.source;
    if (!source) fail(`binding for ${um[1]} has no "source"`);
    const entry = typeof hit.entry === "object" ? hit.entry : null;
    return { target: resolveTarget(entry, file, source), source, via: `ulid ${um[1]}` };
  }

  const tag = findSourceTag(lines, row);
  if (tag) {
    return { target: resolveTarget(null, file, tag), source: tag, via: "@source" };
  }

  return null;
}

function pathLineExists(base, ref) {
  const [path, lineStr] = ref.split(":");
  const abs = pathResolve(base, path);
  if (!existsSync(abs)) return { ok: false, why: `missing file ${path}` };
  if (lineStr) {
    const n = readLines(abs).length;
    if (Number(lineStr) > n) return { ok: false, why: `line ${lineStr} > ${n} in ${path}` };
  }
  return { ok: true };
}

function cmdReveal(argv) {
  const print = argv.includes("--print");
  const [file, rowStr] = argv.filter((a) => a !== "--print");
  if (!file || !rowStr) fail("usage: reveal <file> <row> [--print]", 2);
  if (!existsSync(file)) fail(`no such file: ${file}`);
  const row = Number(rowStr);
  if (!Number.isInteger(row)) fail(`row must be an integer, got ${rowStr}`, 2);

  // $ZED_ROW base (0- vs 1-based) varies; try the exact row, then row+1 as a fallback.
  let r = resolveAtLine(file, row);
  if (!r) r = resolveAtLine(file, row + 1);
  if (!r) fail(`no ULID or @source binding on line ${row} of ${file}`);

  if (print) {
    process.stdout.write(`${r.target}   (${r.via})\n`);
    return;
  }
  const z = spawnSync("zed", [r.target], { stdio: "inherit" });
  if (z.status !== 0) fail(`zed exited ${z.status} opening ${r.target}`);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".git")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function cmdCheck(argv) {
  const [dir] = argv;
  if (!dir || !existsSync(dir)) fail("usage: check <dir>", 2);
  const z = process.env.ZED_WORKTREE_ROOT;
  const base = (z && isDir(z) ? z : null) || gitRoot(dir) || dir;
  const problems = [];
  let checked = 0;

  // Collect every ULID that has a binding, and every ULID referenced from a
  // workflow file, so we can flag notable-if comments that were never mapped.
  const boundUlids = new Set();
  const referencedUlids = []; // { ulid, file, line }

  for (const f of walk(dir)) {
    if (f.endsWith(".workflow.ts")) {
      const lines = readLines(f);
      for (let i = 0; i < lines.length; i++) {
        const m = ULID_RE.exec(lines[i]);
        if (m) referencedUlids.push({ ulid: m[1], file: f, line: i + 1 });
      }
    }
  }

  for (const f of walk(dir)) {
    if (f.endsWith(".bindings.json")) {
      let map;
      try {
        map = JSON.parse(readFileSync(f, "utf8"));
      } catch (e) {
        problems.push(`${f}: invalid JSON (${e.message})`);
        continue;
      }
      for (const [ulid, entry] of Object.entries(map)) {
        boundUlids.add(ulid);
        const source = typeof entry === "string" ? entry : entry.source;
        const b = (typeof entry === "object" && entry.repo) || base;
        if (!source) {
          problems.push(`${f}: ${ulid} has no source`);
          continue;
        }
        checked++;
        const r = pathLineExists(b, source);
        if (!r.ok) problems.push(`${f}: ${ulid} -> ${source}: ${r.why}`);
      }
    } else if (f.endsWith(".d.ts")) {
      const lines = readLines(f);
      for (let i = 0; i < lines.length; i++) {
        const m = SOURCE_TAG_RE.exec(lines[i]);
        if (m) {
          checked++;
          const r = pathLineExists(base, m[1]);
          if (!r.ok) problems.push(`${f}:${i + 1}: @source ${m[1]}: ${r.why}`);
        }
      }
    }
  }

  // Every notable-if ULID in a workflow file must have a binding entry.
  for (const ref of referencedUlids) {
    if (!boundUlids.has(ref.ulid)) {
      problems.push(`${ref.file}:${ref.line}: ULID ${ref.ulid} has no entry in any *.bindings.json`);
    }
  }

  if (problems.length) {
    process.stderr.write(problems.join("\n") + "\n");
    fail(`${problems.length} problem(s); ${checked} source binding(s) checked`, 1);
  }
  process.stdout.write(
    `ok: ${checked} source binding(s) resolve; ${referencedUlids.length} workflow ULID(s) all mapped\n`,
  );
}

const [, , cmd, ...rest] = process.argv;
if (cmd === "reveal") cmdReveal(rest);
else if (cmd === "check") cmdCheck(rest);
else fail("usage: flow-reveal.mjs {reveal <file> <row> [--print] | check <dir>}", 2);

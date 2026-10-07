#!/usr/bin/env python3
"""Split rule files into rules and cut a diff into rule-checker batches.

A rule file is markdown under `<store>/rules/` or `<notes-dir>/rules/`. Each `# H1`
is one rule; the text under it, up to the next H1, is its description. One batch is
up to `--batch-size` rules that cover the same changed files, and the hunks of those files.
When the batches pass `--max-batches`, every batch takes more rules instead.

Subcommands:
  rules  print every rule and its scope; exit 2 on a broken rule file
  plan   write manifest.json and one brief per batch into --out; print one
         summary line — the briefs are batches/b001.md … in order
  check  exit 1 when a planned (file, rule) pair has no verdict, or a rule
         appeared after the plan

Exit 0 = ok · 1 = check found an unchecked pair or an unplanned rule · 2 = usage or
a broken rule file.
"""

from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import json
import os
import re
import subprocess
import sys
from pathlib import Path

RULES_DIR = "rules"
NOTES_RULE_FILES = ("RULES.md", "PATTERNS.md")
ALL_FILES = ("**",)

# A rule file with no `paths:` frontmatter takes its scope from its file name.
SCOPE_BY_STEM: dict[str, tuple[str, ...]] = {
    "any": ALL_FILES,
    "go": ("**/*.go",),
    "ts": ("**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"),
    "js": ("**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"),
    "py": ("**/*.py",),
    "sh": ("**/*.sh", "**/*.bash"),
    "md": ("**/*.md",),
    "proto": ("**/*.proto",),
    "rs": ("**/*.rs",),
    "test": ("**/*_test.go", "**/*.test.ts", "**/*.spec.ts", "**/test_*.py", "**/*_test.py"),
    "RULES": ALL_FILES,
    "PATTERNS": ALL_FILES,
}

VERDICT_ROW = re.compile(r"^\|\s*`?([^|`]+?)`?\s*\|\s*(PASS|FAIL|N/A)\b", re.IGNORECASE)


def die(msg: str, code: int = 2) -> None:
    print(f"wm-rule-batches: {msg}", file=sys.stderr)
    sys.exit(code)


def store_root() -> Path:
    return Path(os.environ.get("WM_NOTES_HOME") or Path.home() / ".notes")


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "rule"


def split_frontmatter(text: str) -> tuple[dict[str, list[str]], str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text
    fm: dict[str, list[str]] = {}
    key = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return fm, "\n".join(lines[i + 1:])
        item = re.match(r"^\s*-\s*['\"]?([^'\"]+)['\"]?\s*$", line)
        if item and key:
            fm[key].append(item.group(1))
            continue
        kv = re.match(r"^(\w[\w-]*):\s*(.*)$", line)
        if kv:
            key = kv.group(1)
            value = kv.group(2).strip()
            if value.startswith("["):
                fm[key] = [v.strip().strip("'\"") for v in value.strip("[]").split(",") if v.strip()]
            else:
                fm[key] = [value.strip("'\"")] if value else []
    return {}, text


def rule_sources(notes_dir: Path | None) -> list[tuple[str, Path]]:
    """Every rule file, project scope first, so a project rule shadows a global one."""
    roots: list[tuple[str, Path]] = []
    if notes_dir:
        roots.append(("project", notes_dir))
    store = store_root()
    if not notes_dir or store.resolve() != notes_dir.resolve():
        roots.append(("global", store))
    found: list[tuple[str, Path]] = []
    for scope, root in roots:
        rules_dir = root / RULES_DIR
        if rules_dir.is_dir():
            found += [(scope, p) for p in sorted(rules_dir.rglob("*.md"))]
        if scope == "project":
            found += [(scope, root / n) for n in NOTES_RULE_FILES if (root / n).is_file()]
    return found


def parse_rule_file(scope: str, path: Path, base: Path) -> list[dict]:
    fm, body = split_frontmatter(path.read_text())
    stem = path.stem
    paths = tuple(fm.get("paths") or ()) or SCOPE_BY_STEM.get(stem)
    rel = str(path.relative_to(base)) if path.is_relative_to(base) else path.name
    if not paths:
        die(f"{path}: no `paths:` frontmatter and no scope for file name `{stem}` "
            f"(known: {', '.join(sorted(SCOPE_BY_STEM))})")
    rules: list[dict] = []
    current: dict | None = None
    preamble: list[str] = []
    for line in body.splitlines():
        h1 = re.match(r"^#\s+(.+?)\s*#*\s*$", line)
        if h1:
            current = {"title": h1.group(1), "body": []}
            rules.append(current)
        elif current is not None:
            current["body"].append(line)
        elif line.strip():
            preamble.append(line)
    if not rules:
        if not preamble:
            return []
        print(f"wm-rule-batches: {path}: no H1 — the whole file is one rule", file=sys.stderr)
        rules = [{"title": stem, "body": preamble}]
    elif preamble:
        die(f"{path}: text above the first H1 belongs to no rule — move it under a heading")
    out = []
    for r in rules:
        key = f"{Path(rel).with_suffix('')}/{slug(r['title'])}"
        out.append({
            "id": key,
            "title": r["title"],
            "body": "\n".join(r["body"]).strip(),
            "paths": list(paths),
            "source": f"{scope}:{path}",
        })
    return out


def decision_rules(notes_dir: Path, todo: str | None) -> list[dict]:
    thoughts = notes_dir / "thoughts"
    if not thoughts.is_dir():
        return []
    script = Path(__file__).with_name("wm-constraints.py")
    cmd = [sys.executable, str(script), str(thoughts), "--json"] + (["--todo", todo] if todo else [])
    run = subprocess.run(cmd, capture_output=True, text=True)
    if run.returncode not in (0, 1):
        die(f"wm-constraints.py failed: {run.stderr.strip()}")
    rows = json.loads(run.stdout or "[]") if run.returncode == 0 else []
    return [{
        "id": f"D{r['id']}",
        "title": r["title"] or f"D{r['id']}",
        "body": f"{r['rule']}\n\nOrigin: [[{r['origin']}]]" + (" — nobody approved this rule" if r.get("source") == "auto" else ""),
        "paths": list(ALL_FILES),
        "source": f"decision:{thoughts}",
    } for r in rows]


def load_rules(notes_dir: Path | None, todo: str | None) -> list[dict]:
    seen: dict[str, dict] = {}
    for scope, path in rule_sources(notes_dir):
        base = (notes_dir if scope == "project" else store_root()) / RULES_DIR
        for rule in parse_rule_file(scope, path, base):
            seen.setdefault(rule["id"], rule)
    if notes_dir and todo:
        for rule in decision_rules(notes_dir, todo):
            seen.setdefault(rule["id"], rule)
    return list(seen.values())


def matches(path: str, globs: list[str]) -> bool:
    for g in globs:
        if g == "**" or fnmatch.fnmatch(path, g):
            return True
        if g.startswith("**/") and fnmatch.fnmatch(path, g[3:]):
            return True
    return False


def git(repo: Path, *args: str) -> str:
    run = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    if run.returncode != 0:
        die(f"git {' '.join(args)}: {run.stderr.strip()}")
    return run.stdout


def changed_files(repo: Path, rng: str) -> list[str]:
    if rng == "worktree":
        tracked = git(repo, "diff", "HEAD", "--name-only", "--diff-filter=d").split()
        untracked = git(repo, "ls-files", "--others", "--exclude-standard").split()
        return sorted(set(tracked + untracked))
    return git(repo, "diff", rng, "--name-only", "--diff-filter=d").split()


def hunks(repo: Path, rng: str, path: str) -> str:
    if rng == "worktree":
        text = git(repo, "diff", "HEAD", "--", path)
        if not text and (repo / path).is_file():
            body = (repo / path).read_text(errors="replace").splitlines()
            text = f"new file {path}\n@@ -0,0 +1,{len(body)} @@\n" + "\n".join("+" + l for l in body)
        return text
    return git(repo, "diff", rng, "--", path)


def tip_of(rng: str) -> str:
    if rng == "worktree":
        return "worktree"
    if ".." in rng:
        return rng.split("..")[-1].lstrip(".") or "HEAD"
    return rng


def cmd_rules(args: argparse.Namespace) -> int:
    rules = load_rules(args.notes_dir, args.todo)
    for r in rules:
        print(f"{r['id']}\t{','.join(r['paths'])}\t{r['source']}")
    print(f"{len(rules)} rule(s)", file=sys.stderr)
    return 0


def cmd_plan(args: argparse.Namespace) -> int:
    rules = load_rules(args.notes_dir, args.todo)
    if not rules:
        die("no rule found — create <notes-dir>/rules/<lang>.md or ~/.notes/rules/<lang>.md")
    out: Path = args.out
    (out / "batches").mkdir(parents=True, exist_ok=True)
    (out / "results").mkdir(parents=True, exist_ok=True)
    for stale in list((out / "batches").glob("*.md")) + list((out / "results").glob("*.md")):
        stale.unlink()
    tip = tip_of(args.range)
    files, batches, diffs = [], [], {}
    for path in changed_files(args.repo, args.range):
        diff = hunks(args.repo, args.range, path)
        if not diff.strip() or any(l.startswith("Binary files") for l in diff.splitlines()[:5]):
            files.append({"path": path, "rules": [], "skipped": "binary or empty diff"})
            continue
        diffs[path] = diff
        files.append({"path": path, "rules": [r["id"] for r in rules if matches(path, r["paths"])]})

    pools: dict[tuple[str, ...], list[dict]] = {}
    for r in rules:
        in_scope = tuple(p for p in diffs if matches(p, r["paths"]))
        if in_scope:
            pools.setdefault(in_scope, []).append(r)
    scoped = [(group, list(in_scope)) for in_scope, group in pools.items()]
    size = args.batch_size
    while sum(-(-len(g) // size) for g, _ in scoped) > args.max_batches:
        size += 1

    for group, in_scope in scoped:
        diff = "\n".join(diffs[p].rstrip() for p in in_scope)
        for i in range(0, len(group), size):
            chunk = group[i:i + size]
            bid = f"b{len(batches) + 1:03d}"
            brief = out / "batches" / f"{bid}.md"
            rules_md = "\n\n".join(f"## {r['id']}\n\n**{r['title']}**\n\n{r['body']}" for r in chunk)
            brief.write_text(
                f"batch: {bid}\nfiles: {' '.join(in_scope)}\ntip: {tip}\nresult: {out / 'results' / (bid + '.md')}\n\n"
                f"# Hunks\n\n```diff\n{diff}\n```\n\n# Rules\n\n{rules_md}\n"
            )
            batches.append({"id": bid, "files": in_scope, "rules": [r["id"] for r in chunk],
                            "brief": str(brief), "result": str(out / "results" / f"{bid}.md")})
    manifest = {
        "created": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "range": args.range,
        "tip": tip,
        "repo": str(args.repo),
        "notes_dir": str(args.notes_dir) if args.notes_dir else None,
        "todo": args.todo,
        "rules": [{k: r[k] for k in ("id", "title", "paths", "source")} for r in rules],
        "files": files,
        "batches": batches,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"{len(rules)} rule(s), {len(files)} file(s), {len(batches)} batch(es) → {out / 'manifest.json'}")
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    manifest = json.loads((args.out / "manifest.json").read_text())
    problems: list[str] = []
    counts: dict[str, dict[str, int]] = {}
    for b in manifest["batches"]:
        result = Path(b["result"])
        verdicts: dict[str, str] = {}
        if result.is_file():
            for line in result.read_text().splitlines():
                m = VERDICT_ROW.match(line)
                if m:
                    verdicts[m.group(1).strip()] = m.group(2).upper()
        for rid in b["rules"]:
            v = verdicts.get(rid)
            if v is None:
                problems.append(f"UNCHECKED\t{b['id']}\t{rid}")
                continue
            counts.setdefault(rid, {}).setdefault(v, 0)
            counts[rid][v] += 1
    notes_dir = Path(manifest["notes_dir"]) if manifest["notes_dir"] else None
    planned = {r["id"] for r in manifest["rules"]}
    for r in load_rules(notes_dir, manifest["todo"]):
        if r["id"] not in planned:
            problems.append(f"UNPLANNED\t-\t{r['id']}\t(added after the plan — run plan again)")
    for rid in sorted(planned):
        c = counts.get(rid, {})
        if not any(rid in b["rules"] for b in manifest["batches"]):
            print(f"{rid}\tn/a — no changed file in scope")
        else:
            print(f"{rid}\t" + " ".join(f"{k}={v}" for k, v in sorted(c.items())))
    for p in problems:
        print(p)
    return 1 if problems else 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="wm-rule-batches.py", description=__doc__.splitlines()[0],
                                 epilog="Tool index — every .notes tool and its flags: wm:TOOLS.md")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("rules", "plan"):
        p = sub.add_parser(name)
        p.add_argument("--notes-dir", type=Path, help="project notes dir; omit for global rules only")
        p.add_argument("--todo", help="add the TODO's decision rules (wm-constraints.py --todo)")
        if name == "plan":
            p.add_argument("--range", required=True, help="`worktree`, or any range `git diff` takes")
            p.add_argument("--out", type=Path, required=True, help="dir for manifest.json, batches/, results/")
            p.add_argument("--repo", type=Path, default=Path("."))
            p.add_argument("--batch-size", type=int, default=10, help="rules per batch before the cap applies")
            p.add_argument("--max-batches", type=int, default=8, help="most rule-checker agents per round")
    c = sub.add_parser("check")
    c.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    return {"rules": cmd_rules, "plan": cmd_plan, "check": cmd_check}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())

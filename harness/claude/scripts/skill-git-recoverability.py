#!/usr/bin/env python3
"""Say, per skill, whether deleting it is recoverable from git.

Answers the only question that matters before a prune: if this directory is
removed, can it come back? Three verdicts per skill:

  TRACKED    the SKILL.md resolves into a git repo AND git knows the path
  SYMLINK    the entry is a symlink into a repo (deleting the link is harmless;
             deleting the target is a repo change git can restore)
  UNTRACKED  a real directory git has never seen — deletion is permanent

Reads a rollup.json (health-rollup.py) and filters to one bucket, or takes
skill names as args.

Usage:
  skill-git-recoverability.py --rollup <path> --bucket DEAD
  skill-git-recoverability.py <skill-name>...
Options: --skills-dir DIR (default ~/.claude/skills), --json
"""

import argparse
import json
import os
import subprocess
from pathlib import Path


def git(args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)


def verdict(entry):
    """Classify one ~/.claude/skills/<name> entry."""
    if not entry.exists():
        return "MISSING", "", ""
    link = entry.is_symlink()
    real = entry.resolve()
    md = real / "SKILL.md"
    if not md.exists():
        return "MISSING", str(real), ""
    top = git(["rev-parse", "--show-toplevel"], md.parent)
    if top.returncode != 0:
        return "UNTRACKED", str(md), ""
    repo = top.stdout.strip()
    ls = git(["ls-files", "--error-unmatch", str(md)], md.parent)
    if ls.returncode != 0:
        return "UNTRACKED", str(md), repo
    return ("SYMLINK" if link else "TRACKED"), str(md), repo


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*")
    ap.add_argument("--rollup")
    ap.add_argument("--bucket", default="DEAD")
    ap.add_argument("--skills-dir", default=str(Path.home() / ".claude" / "skills"))
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    names = list(args.names)
    if args.rollup:
        data = json.load(open(os.path.expanduser(args.rollup)))
        names += [s["skill"] for s in data["skills"] if s["bucket"] == args.bucket]

    base = Path(os.path.expanduser(args.skills_dir))
    rows = []
    for name in dict.fromkeys(names):
        # A plugin skill (plugin:name) lives in the plugin cache, not here; its
        # source is the plugin repo, so it is recoverable by definition.
        if ":" in name:
            rows.append({"skill": name, "verdict": "PLUGIN", "path": "", "repo": ""})
            continue
        v, path, repo = verdict(base / name)
        rows.append({"skill": name, "verdict": v, "path": path, "repo": repo})

    if args.json:
        print(json.dumps(rows, indent=1))
        return
    counts = {}
    for r in rows:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    for r in sorted(rows, key=lambda x: (x["verdict"], x["skill"])):
        print(f"{r['verdict']:<10} {r['skill']}")
    print()
    print("totals:", counts)
    unsafe = [r["skill"] for r in rows if r["verdict"] == "UNTRACKED"]
    if unsafe:
        print(f"\n{len(unsafe)} skill(s) would be lost permanently — no git copy exists.")


if __name__ == "__main__":
    main()

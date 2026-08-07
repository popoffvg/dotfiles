#!/usr/bin/env python3
"""Estimate the resident context cost of the skill listing.

Walks skill roots (~/.claude/skills, <project>/.claude/skills, installed
plugin skills), reads only the `name:` and `description:` frontmatter fields,
and reports per-skill estimated tokens (chars/4) plus totals per root.

Usage: doctor-skill-listing-cost.py [project_dir]
"""
import json
import os
import sys
import glob

project = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
home = os.path.expanduser("~")

roots = [
    ("user", os.path.join(home, ".claude", "skills")),
    ("project", os.path.join(project, ".claude", "skills")),
]
cache = os.path.join(home, ".claude", "plugins", "cache")
for d in sorted(glob.glob(os.path.join(cache, "*", "*"))):
    sk = os.path.join(d, "skills")
    if os.path.isdir(sk):
        roots.append(("plugin:" + os.path.basename(d), sk))
for d in sorted(glob.glob(os.path.join(home, ".claude", "plugins", "repos", "*", "*"))):
    sk = os.path.join(d, "skills")
    if os.path.isdir(sk):
        roots.append(("repo:" + os.path.basename(d), sk))


def frontmatter(path):
    name = desc = ""
    try:
        with open(path, errors="replace") as fh:
            first = fh.readline()
            if first.strip() != "---":
                return name, desc
            key = None
            for line in fh:
                if line.strip() == "---":
                    break
                if line[:1] not in (" ", "\t") and ":" in line:
                    key, _, val = line.partition(":")
                    key = key.strip()
                    val = val.strip()
                    if key == "name":
                        name = val
                    elif key == "description":
                        desc = val
                elif key == "description":
                    desc += " " + line.strip()
    except OSError:
        pass
    return name, desc


out = []
for label, root in roots:
    if not os.path.isdir(root):
        continue
    items = []
    for md in sorted(glob.glob(os.path.join(root, "**", "SKILL.md"), recursive=True)):
        name, desc = frontmatter(md)
        if not name:
            continue
        chars = len(name) + len(desc)
        items.append({"name": name, "chars": chars, "est_tokens": round(chars / 4),
                      "path": os.path.relpath(md, root)})
    if items:
        out.append({
            "root": label,
            "dir": root,
            "count": len(items),
            "est_tokens_total": round(sum(i["chars"] for i in items) / 4),
            "skills": sorted(items, key=lambda i: -i["chars"]),
        })

print(json.dumps({
    "roots": out,
    "grand_total_est_tokens": sum(r["est_tokens_total"] for r in out),
    "grand_total_skills": sum(r["count"] for r in out),
}, indent=2))

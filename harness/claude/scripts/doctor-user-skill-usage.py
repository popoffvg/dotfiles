#!/usr/bin/env python3
"""Join ~/.claude/skills entries against skillUsage counters in ~/.claude.json.

Reports per skill: usageCount (lifetime, both qualified and bare keys),
lastUsedAt, metadata.origin, and est. listing tokens (chars/4 of name +
description). Sorted by usage then cost.
"""
import json
import os
import glob
import time

home = os.path.expanduser("~")
usage = json.load(open(os.path.join(home, ".claude.json"))).get("skillUsage") or {}
root = os.path.join(home, ".claude", "skills")


def frontmatter(path):
    name = desc = origin = ""
    with open(path, errors="replace") as fh:
        if fh.readline().strip() != "---":
            return name, desc, origin
        key = None
        for line in fh:
            if line.strip() == "---":
                break
            stripped = line.strip()
            if line[:1] not in (" ", "\t") and ":" in line:
                key, _, val = line.partition(":")
                key = key.strip()
                val = val.strip()
                if key == "name":
                    name = val
                elif key == "description":
                    desc = val
            elif key == "description":
                desc += " " + stripped
            elif stripped.startswith("origin:"):
                origin = stripped.split(":", 1)[1].strip()
    return name, desc, origin


rows = []
for md in sorted(glob.glob(os.path.join(root, "**", "SKILL.md"), recursive=True)):
    name, desc, origin = frontmatter(md)
    if not name:
        continue
    rel = os.path.relpath(os.path.dirname(md), root)
    count = 0
    last = None
    for key in {name, rel, rel.replace(os.sep, ":"), os.path.basename(rel)}:
        u = usage.get(key)
        if u:
            count = max(count, u.get("usageCount", 0))
            if u.get("lastUsedAt"):
                last = max(last or 0, u["lastUsedAt"])
    chars = len(name) + len(desc)
    rows.append({
        "name": name,
        "dir": rel,
        "uses": count,
        "last": time.strftime("%Y-%m-%d", time.localtime(last / 1000)) if last else "-",
        "est_tokens": round(chars / 4),
        "origin": origin or "-",
    })

rows.sort(key=lambda r: (r["uses"], -r["est_tokens"]))
print(f"{'skill':38} {'uses':>4} {'last':>10} {'tok':>4}  origin")
for r in rows:
    print(f"{r['name'][:38]:38} {r['uses']:>4} {r['last']:>10} {r['est_tokens']:>4}  {r['origin']}")
zero = [r for r in rows if r["uses"] == 0]
print(f"\ntotal skills: {len(rows)}  est tokens: {sum(r['est_tokens'] for r in rows)}")
print(f"zero-use skills: {len(zero)}  est tokens: {sum(r['est_tokens'] for r in zero)}")

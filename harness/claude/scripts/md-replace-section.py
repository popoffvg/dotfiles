#!/usr/bin/env python3
"""Replace one markdown section (heading line through the line before the next heading of
the same or higher level) with the contents of a file, or delete it.

Usage: md-replace-section.py <file.md> <exact heading line> [<replacement-file> | --delete]
Prints the replaced line range. Exits 1 when the heading is not found exactly once.
"""
import sys

path, heading = sys.argv[1], sys.argv[2]
repl = sys.argv[3] if len(sys.argv) > 3 else "--delete"
lines = open(path).read().split("\n")
fenced, in_fence = set(), False
for i, l in enumerate(lines):
    if l.lstrip().startswith("```"):
        in_fence = not in_fence
    elif in_fence:
        fenced.add(i)
hits = [i for i, l in enumerate(lines) if l.rstrip() == heading and i not in fenced]
if len(hits) != 1:
    sys.exit(f"heading matched {len(hits)} times, need exactly 1: {heading!r}")
start = hits[0]
level = len(heading) - len(heading.lstrip("#"))
end = len(lines)
for i in range(start + 1, len(lines)):
    s = lines[i]
    if i in fenced:
        continue
    if s.startswith("#") and 0 < len(s) - len(s.lstrip("#")) <= level and s.lstrip("#").startswith(" "):
        end = i
        break
body = [] if repl == "--delete" else open(repl).read().rstrip("\n").split("\n") + [""]
open(path, "w").write("\n".join(lines[:start] + body + lines[end:]))
print(f"{path}: replaced lines {start+1}-{end}")

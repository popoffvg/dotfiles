#!/usr/bin/env python3
"""Check that each <path>:<line> from a prx comments file lands on a commentable
line of a unified diff (RIGHT side = added or context lines inside a hunk).

Usage: prx-diff-line-check.py <diff-file> <comments-file>

Comments file lines look like:  - path/to/file.go:123 — body text
Lines without a `path:line` prefix are reported as GENERAL.
Exit 0 always; the report goes to stdout as TSV:
    OK|NOT_IN_DIFF|FILE_NOT_IN_DIFF|GENERAL <tab> path <tab> line <tab> nearest commentable lines
"""

import re
import sys


def parse_diff_right_lines(diff_text):
    """Map new-file path -> set of new-file line numbers present in the diff."""
    per_file = {}
    current = None
    new_line = 0
    for raw in diff_text.splitlines():
        if raw.startswith("+++ "):
            path = raw[4:].strip()
            if path.startswith("b/"):
                path = path[2:]
            current = None if path == "/dev/null" else path
            per_file.setdefault(current, set()) if current else None
            continue
        if raw.startswith("@@"):
            match = re.search(r"\+(\d+)", raw)
            new_line = int(match.group(1)) if match else 0
            continue
        if current is None:
            continue
        if raw.startswith("+"):
            per_file[current].add(new_line)
            new_line += 1
        elif raw.startswith("-") or raw.startswith("\\"):
            continue
        elif raw.startswith(" "):
            per_file[current].add(new_line)
            new_line += 1
    return per_file


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8", errors="replace") as handle:
        per_file = parse_diff_right_lines(handle.read())
    with open(sys.argv[2], encoding="utf-8") as handle:
        comment_lines = handle.read().splitlines()

    for raw in comment_lines:
        if not raw.startswith("- "):
            continue
        head = raw[2:]
        match = re.match(r"^(\S+?):(\d+)\b", head)
        if not match:
            print("GENERAL\t{}\t\t".format(head[:60]))
            continue
        path, line = match.group(1), int(match.group(2))
        if path not in per_file:
            print("FILE_NOT_IN_DIFF\t{}\t{}\t".format(path, line))
            continue
        available = sorted(per_file[path])
        if line in per_file[path]:
            print("OK\t{}\t{}\t".format(path, line))
        else:
            near = [n for n in available if abs(n - line) <= 15]
            print("NOT_IN_DIFF\t{}\t{}\t{}".format(path, line, near or available[:20]))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Find which line of a file matches an md-comment anchor hash.

The md-comment language server anchors each comment to a line number plus a hash:
the first 16 hex characters of the SHA-256 of that line with trailing whitespace
removed. When a comment looks mislocated, this reports every line that still
hashes to the stored value.

usage: md-comment-find-anchor.py <file> <hash>...
       md-comment-find-anchor.py --store <md-comment.json> [<root>]

With --store, every comment in the store is checked against the file it names,
resolved relative to <root> (default: the store's grandparent, i.e. the .tmp/ parent).
"""

import hashlib
import json
import sys
from pathlib import Path


def line_hash(line: str) -> str:
    return hashlib.sha256(line.rstrip().encode()).hexdigest()[:16]


def matches(path: Path, wanted: str) -> list[int]:
    lines = path.read_text().split("\n")
    return [n for n, line in enumerate(lines, 1) if line_hash(line) == wanted]


def report(path: Path, wanted: str, stored_line: int | None = None) -> None:
    if not path.exists():
        print(f"{path}: missing")
        return
    found = matches(path, wanted)
    lines = path.read_text().split("\n")
    where = f" stored line {stored_line}" if stored_line else ""
    if not found:
        print(f"{path}:{stored_line or '?'} {wanted}{where} → no line matches (orphaned)")
    else:
        for n in found:
            marker = " ← stored line" if n == stored_line else ""
            print(f"{path}:{n} {wanted} → {lines[n - 1]!r}{marker}")
    if stored_line and stored_line <= len(lines) and stored_line not in found:
        print(f"    stored line {stored_line} now holds {lines[stored_line - 1]!r}")


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__, file=sys.stderr)
        return 2

    if args[0] == "--store":
        store_path = Path(args[1])
        root = Path(args[2]) if len(args) > 2 else store_path.parent.parent
        store = json.loads(store_path.read_text())
        for name, comments in store.get("files", {}).items():
            for comment in comments:
                print(f"# {comment['text']!r}")
                report(root / name, comment["hash"], comment["line"])
        return 0

    path = Path(args[0])
    for wanted in args[1:]:
        report(path, wanted)
    return 0


if __name__ == "__main__":
    sys.exit(main())

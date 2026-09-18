#!/usr/bin/env python3
"""Whole-word identifier rename across a tree.

Usage: rename-identifiers.py <root> <map-file> [glob ...]

The map file holds one rename per line, "old<TAB>new" or "old -> new". Blank
lines and lines starting with # are ignored. Longer names are applied first, so
a prefix rename cannot eat a longer one.
"""
import pathlib
import re
import sys


def load_pairs(path):
    pairs = []
    for line in pathlib.Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        old, new = re.split(r"\t| -> ", line, maxsplit=1)
        pairs.append((old.strip(), new.strip()))
    return sorted(pairs, key=lambda pair: -len(pair[0]))


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    root = pathlib.Path(sys.argv[1])
    pairs = load_pairs(sys.argv[2])
    globs = sys.argv[3:] or ["*.go"]

    changed = 0
    for pattern in globs:
        for path in root.rglob(pattern):
            if not path.is_file():
                continue
            original = path.read_text()
            text = original
            for old, new in pairs:
                text = re.sub(r"\b" + re.escape(old) + r"\b", new, text)
            if text != original:
                path.write_text(text)
                changed += 1
    print(f"files rewritten: {changed}")


if __name__ == "__main__":
    main()

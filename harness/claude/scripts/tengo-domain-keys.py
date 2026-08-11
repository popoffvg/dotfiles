#!/usr/bin/env python3
"""Report the `domain: { ... }` key sets of PColumn specs in Tengo sources.

Brace-matches each `domain:` block, so annotations that merely follow one are
never counted as domain keys — a fixed-window grep gets that wrong.

Usage:
    tengo-domain-keys.py <path> [<path> ...]

Prints, per key set, how many spec sites declare exactly that set and which
repos they are in — the shape needed to answer "is a bare blockId domain the
norm here, or do blocks qualify more?".
"""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

KEY = re.compile(r'"([^"]+)"\s*:')


def domain_blocks(text: str) -> list[str]:
    """Every `domain:` block's body, brace-matched."""
    out = []
    for match in re.finditer(r"domain\s*:\s*\{", text):
        depth = 1
        i = match.end()
        while i < len(text) and depth:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
            i += 1
        out.append(text[match.end() : i - 1])
    return out


def key_set(body: str) -> tuple[str, ...]:
    """The keys declared directly in one domain body, nesting ignored."""
    return tuple(sorted(set(KEY.findall(body))))


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2

    counts: Counter[tuple[str, ...]] = Counter()
    repos: defaultdict[tuple[str, ...], set[str]] = defaultdict(set)

    files = []
    for arg in argv:
        path = Path(arg)
        files.extend(sorted(path.rglob("*.tengo")) if path.is_dir() else [path])

    for file in files:
        try:
            text = file.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            print(f"skipped {file}: {exc}", file=sys.stderr)
            continue
        for body in domain_blocks(text):
            keys = key_set(body)
            counts[keys] += 1
            repos[keys].add(file.parts[file.parts.index("1_blocks") + 1]
                            if "1_blocks" in file.parts else str(file.parent))

    total = sum(counts.values())
    print(f"{total} domain blocks in {len(files)} files\n")
    for keys, n in counts.most_common():
        names = ", ".join(keys) if keys else "(empty)"
        where = sorted(repos[keys])
        shown = ", ".join(where[:6]) + (" …" if len(where) > 6 else "")
        print(f"{n:4}  {names}\n      in {len(where)}: {shown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

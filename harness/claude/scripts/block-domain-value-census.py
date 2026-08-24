#!/usr/bin/env python3
"""Census of PColumn `domain:` KEY -> VALUE pairs across a blocks corpus.

`tengo-domain-keys.py` answers "which key SETS appear"; this answers "which
VALUES does one key actually take, and in how many blocks" — the shape needed
to spot two spellings of the same concept (`V` vs `VGene`, `human` vs
`homo-sapiens`), and keys that carry exactly one value everywhere.

Brace-matches every `domain:` / `contextDomain:` block so a following
`annotations:` block is never counted. Scans `.tengo`, `.ts`, `.vue`.

Usage:
    block-domain-value-census.py <blocks-root> [--key SUBSTR] [--min N] [--context]

A "block" is a top-level directory under <blocks-root>.
"""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

PAIR = re.compile(r'"([^"]+)"\s*:\s*"([^"]*)"')
EXTS = {".tengo", ".ts", ".vue"}


def domain_bodies(text: str, field: str) -> list[str]:
    out = []
    for m in re.finditer(rf"(?<![A-Za-z]){field}\s*:\s*\{{", text):
        depth, i = 1, m.end()
        while i < len(text) and depth:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
            i += 1
        out.append(text[m.end(): i - 1])
    return out


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    root = Path(args[0]).expanduser()
    key_filter = ""
    minimum = 1
    field = "domain"
    for i, a in enumerate(args):
        if a == "--key":
            key_filter = args[i + 1]
        elif a == "--min":
            minimum = int(args[i + 1])
        elif a == "--context":
            field = "contextDomain"

    uses: Counter = Counter()
    blocks: defaultdict = defaultdict(set)
    key_blocks: defaultdict = defaultdict(set)
    key_uses: Counter = Counter()
    scanned = 0

    for path in root.rglob("*"):
        if path.suffix not in EXTS or not path.is_file():
            continue
        if "node_modules" in path.parts or "dist" in path.parts:
            continue
        try:
            text = path.read_text(errors="ignore")
        except OSError:
            continue
        scanned += 1
        block = path.relative_to(root).parts[0]
        for body in domain_bodies(text, field):
            body = re.sub(r"\bcontextDomain\s*:\s*\{[^{}]*\}", "", body)
            for k, v in PAIR.findall(body):
                if key_filter and key_filter not in k:
                    continue
                uses[(k, v)] += 1
                blocks[(k, v)].add(block)
                key_uses[k] += 1
                key_blocks[k].add(block)

    nblocks = len([p for p in root.iterdir() if p.is_dir()])
    print(f"# {field} census — root={root}  files={scanned}  blocks={nblocks}")
    for key in sorted(key_uses, key=lambda k: -key_uses[k]):
        if key_uses[key] < minimum:
            continue
        print(f"\n{key}  — {key_uses[key]} uses / {len(key_blocks[key])} blocks")
        for (k, v), n in sorted(uses.items(), key=lambda kv: -kv[1]):
            if k != key:
                continue
            print(f"    {v!r:40s} {n:4d} uses / {len(blocks[(k, v)]):2d} blocks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

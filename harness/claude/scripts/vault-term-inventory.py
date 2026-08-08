#!/usr/bin/env python3
"""vault-term-inventory.py — which notes are terms, and which of them need work.

Classifies every note in a vault's notes dir and reports, per term note, the
concrete defects that a cleanup pass would fix. Read-only.

Emits a summary table plus (with --write-lists DIR) one file per defect class
containing the affected slugs, so a cleanup pass has an exact worklist.

Usage:  vault-term-inventory.py <notes-dir> [--write-lists <out-dir>]
"""
import os
import re
import sys
from collections import Counter, defaultdict


def parse(path):
    """Return (frontmatter dict-ish, body). No yaml dep — same shape as store/frontmatter.ts."""
    fm, body = {}, ""
    try:
        with open(path, "r", encoding="utf8", errors="replace") as fh:
            text = fh.read()
    except OSError:
        return fm, body
    if not text.startswith("---"):
        return fm, text
    end = text.find("\n---", 3)
    if end == -1:
        return fm, text
    head, body = text[3:end], text[end + 4 :]
    for line in head.splitlines():
        m = re.match(r"^([a-zA-Z_][\w-]*):\s*(.*)$", line)
        if m:
            fm[m.group(1)] = m.group(2).strip()
    return fm, body


def aliases_of(fm):
    raw = fm.get("aliases", "")
    m = re.match(r"^\[(.*)\]$", raw.strip())
    if not m or not m.group(1).strip():
        return []
    return [a.strip().strip("\"'") for a in m.group(1).split(",") if a.strip()]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    notes_dir = sys.argv[1]
    out_dir = None
    if "--write-lists" in sys.argv:
        out_dir = sys.argv[sys.argv.index("--write-lists") + 1]
        os.makedirs(out_dir, exist_ok=True)

    types = Counter()
    defects = defaultdict(list)
    terms = []

    for name in sorted(os.listdir(notes_dir)):
        if not name.endswith(".md"):
            continue
        slug = name[:-3]
        fm, body = parse(os.path.join(notes_dir, name))
        ntype = fm.get("type", "(missing)")
        types[ntype] += 1
        if ntype not in ("term", "tool"):
            continue
        terms.append(slug)

        if " " in name:
            defects["filename-has-space"].append(slug)
        if fm.get("id") and fm["id"] != slug:
            defects["id-does-not-match-filename"].append(slug)
        if "## Definition" not in body:
            defects["no-definition-heading"].append(slug)
        if "## How it works" not in body:
            defects["no-how-it-works-heading"].append(slug)
        if not aliases_of(fm):
            defects["no-aliases"].append(slug)
        if not fm.get("topic"):
            defects["no-topic"].append(slug)
        if fm.get("status") not in ("raw", "draft", "permanent"):
            defects["bad-status"].append(slug)
        # a term note with no outbound wikilink and nothing pointing in is a dead end
        if "[[" not in body:
            defects["no-outbound-links"].append(slug)

    print(f"notes dir: {notes_dir}")
    print(f"total notes: {sum(types.values())}\n")
    print("by type:")
    for t, n in types.most_common():
        mark = "  <- claimable as a term" if t in ("term", "tool") else ""
        print(f"  {n:5}  {t}{mark}")
    print(f"\nclaimable as a term: {len(terms)}\n")

    print("defects among those:")
    for k in sorted(defects, key=lambda k: -len(defects[k])):
        pct = 100.0 * len(defects[k]) / max(len(terms), 1)
        print(f"  {len(defects[k]):5}  ({pct:4.1f}%)  {k}")

    clean = [s for s in terms if not any(s in v for v in defects.values())]
    print(f"\n  {len(clean):5}  ({100.0*len(clean)/max(len(terms),1):4.1f}%)  no defects")

    if out_dir:
        for k, v in defects.items():
            with open(os.path.join(out_dir, f"{k}.txt"), "w", encoding="utf8") as fh:
                fh.write("\n".join(v) + "\n")
        with open(os.path.join(out_dir, "all-terms.txt"), "w", encoding="utf8") as fh:
            fh.write("\n".join(terms) + "\n")
        print(f"\nlists written to {out_dir}/")


if __name__ == "__main__":
    main()

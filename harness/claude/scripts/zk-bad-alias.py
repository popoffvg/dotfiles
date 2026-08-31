#!/usr/bin/env python3
"""Find aliases that are too short/ambiguous — the ones link-backfill uses to
create false edges (e.g. alias 'AI' -> arithmetic-intensity)."""
import sys, re, collections
from pathlib import Path

LINK = re.compile(r'\[\[([^\]|#]+)\|([^\]]+)\]\]')
ALIAS_BLOCK = re.compile(r'^aliases:\s*(.*)$((?:\n[ \t]*-[ \t]*.*)*)', re.M)
LAYERS = ["00-inbox", "10-sources", "20-notes", "30-maps", "40-journal"]


def main(vault):
    v = Path(vault)
    files = []
    for L in LAYERS:
        files += list((v / L).rglob("*.md"))

    # 1. aliases declared in frontmatter
    alias_owner = collections.defaultdict(list)
    for f in files:
        try:
            txt = f.read_text(errors="ignore")
        except Exception:
            continue
        if not txt.startswith("---"):
            continue
        end = txt.find("\n---", 3)
        if end < 0:
            continue
        m = ALIAS_BLOCK.search(txt[3:end])
        if not m:
            continue
        al = []
        inline = m.group(1).strip()
        if inline.startswith("["):
            al += [x.strip().strip('"\'') for x in inline.strip("[]").split(",")]
        elif inline:
            al.append(inline.strip('"\''))
        for line in (m.group(2) or "").splitlines():
            line = line.strip()
            if line.startswith("-"):
                al.append(line[1:].strip().strip('"\''))
        for a in al:
            if a:
                alias_owner[a].append(str(f.relative_to(v)))

    print("=== SHORT / AMBIGUOUS ALIASES (len<=4 or all-caps acronym) ===")
    for a, owners in sorted(alias_owner.items(), key=lambda x: len(x[0])):
        if len(a) <= 4 or (a.isupper() and len(a) <= 6):
            print(f"  {a!r:14} -> {owners}")

    print("\n=== ALIAS COLLISIONS (same alias, multiple owners) ===")
    for a, owners in alias_owner.items():
        if len(owners) > 1:
            print(f"  {a!r:20} -> {owners}")

    print("\n=== PIPED LINK DISPLAY-TEXT usage (target|display) ===")
    piped = collections.Counter()
    for f in files:
        try:
            txt = f.read_text(errors="ignore")
        except Exception:
            continue
        for tgt, disp in LINK.findall(txt):
            piped[(tgt.strip(), disp.strip())] += 1
    print(f"total piped links: {sum(piped.values())}")
    print("top 30 (target | display) pairs:")
    for (t, d), c in piped.most_common(30):
        flag = "  <== SUSPECT" if len(d) <= 4 or d.lower() not in t.lower().replace("-", " ") else ""
        print(f"  {c:5}  [[{t}|{d}]]{flag}")


main(sys.argv[1] if len(sys.argv) > 1 else ".")

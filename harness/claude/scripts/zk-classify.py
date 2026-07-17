#!/usr/bin/env python3
"""zk-classify.py — classify a vault's .md files into zettelkasten target folders.

Dry-run only: reads every note, writes a reviewable migration_plan.csv. Moves NOTHING.
Token-free (pure heuristics). Reproducible: same input -> same CSV.

Target layers:
  00-inbox   fleeting/unprocessed captures
  10-sources literature notes (one per external article/paper/video)
  20-notes   permanent atomic zettels
  30-maps    MOCs / index notes
  40-journal dated notes
  _attic     raw HTML + original dumps (kept OUT of the graph)

Usage: zk-classify.py <vault-dir> [out.csv]
"""
import os, re, sys, csv
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/Users/popoffvg/obsidian/zcore")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT.parent / "migration_plan.csv"
SKIP_DIRS = {".trash", ".obsidian", ".git", ".firecrawl", ".cocoindex_code",
             ".stfolder", "graphify-out", "assets", "_attic", ".ledger",
             "templates", ".services"}

FM = re.compile(r'^---\s*\n(.*?)\n---', re.S)
WL = re.compile(r'\[\[[^\]]+\]\]')
KV = lambda fm, k: (re.search(rf'^{k}:\s*(.+)$', fm, re.M) or [None, ""])[1].strip().strip('"')

# top dirs whose contents route by dir name regardless of content
DIR_ROUTE = {
    "journal": "40-journal",
    "inbox": "00-inbox", "todos": "00-inbox",
}
# consumption dirs = literature notes (summaries of external content)
SOURCE_DIRS = {"papers", "reading", "resources", "social", "ai",
               "_raw", "raw", "_processed", "processed", "content", "milabs",
               "software", "security", "general", "databases"}
# permanent atomic-note dirs — the distilled zettel layer (seed; grows via extraction)
REFERENCE_DIRS = {"terms"}
# curated-list dirs = Maps of Content
MAP_DIRS = {"awesome"}
# a note whose source is a code repo or product homepage is a `tool` note
TOOL_HOSTS = ("github.com", "gitlab.com", "npmjs.com", "pypi.org", "crates.io")


def classify(p: Path, text: str):
    rel = p.relative_to(ROOT)
    top = rel.parts[0] if len(rel.parts) > 1 else "(root)"
    head = text[:200].lstrip().lower()
    m = FM.match(text.lstrip())
    fm = m.group(1) if m else ""
    ftype = KV(fm, "type").lower() if fm else ""
    words = len(text.split())
    has_wl = bool(WL.search(text))
    url = KV(fm, "url") or KV(fm, "source") if fm else ""
    name = p.stem.lower()

    # 1. raw HTML dumps or frontmatter-less scrapes in raw dirs -> _attic
    if head.startswith("<!doctype") or head.startswith("<html"):
        return "_attic", "raw HTML dump"
    if top in ("_raw", "raw") and not fm:
        return "_attic", "raw scrape, no frontmatter"

    # 2. explicit type wins
    if ftype == "tool":
        return "20-notes", "type:tool"
    if ftype in ("term", "note", "concept"):
        return "20-notes", f"type:{ftype}"
    if ftype in ("map", "moc", "index"):
        return "30-maps", f"type:{ftype}"
    if ftype in ("journal", "daily"):
        return "40-journal", f"type:{ftype}"
    if ftype in ("fleeting", "inbox"):
        return "00-inbox", f"type:{ftype}"
    if ftype in ("source", "article", "paper", "post", "blog-post", "video",
                 "tweet", "pdf", "reading") or ftype.startswith("social"):
        return "10-sources", f"type:{ftype}"

    # 3. dir-based routing
    if top in DIR_ROUTE:
        return DIR_ROUTE[top], f"dir:{top}"
    if top in REFERENCE_DIRS:
        return "20-notes", f"reference dir:{top}"
    if top in MAP_DIRS:  # awesome-lists etc. are curated Maps of Content
        return "30-maps", f"map dir:{top}"

    # 4b. tool note — source is a code repo / package / product homepage
    if url and any(h in url for h in TOOL_HOSTS):
        return "20-notes", "tool: repo/package url"

    if top in SOURCE_DIRS:  # consumption dirs are literature, regardless of length
        return "10-sources", f"source dir:{top}"

    # 4. index/MOC by name
    if name in ("index", "readme", "moc", "_index") or "map of content" in text[:400].lower():
        return "30-maps", "index/MOC by name"

    # 5. atomic/reference zettel: frontmatter + short (one concept).
    #    Beats the url test — a homepage url is attribution, not "I summarized a long read".
    if fm and words < 250:
        return "20-notes", "atomic: fm+short" + ("+linked" if has_wl else "")

    # 6. long-form with an external source url -> literature note
    if url and url.startswith(("http://", "https://")) and words >= 250:
        return "10-sources", "has source url + long-form"

    # 7. consumption dirs default to literature
    if top in SOURCE_DIRS:
        return "10-sources", f"source dir:{top}"

    # 8. long-form with frontmatter -> literature
    if fm and words >= 400:
        return "10-sources", "long-form w/ fm"

    # 9. no frontmatter, short -> inbox (needs triage)
    if not fm:
        return "00-inbox", "no frontmatter, needs triage"

    # fallback
    return "20-notes", "fallback: fm note"


def main():
    rows, counts = [], {}
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in SKIP_DIRS and not d.startswith(".")]
        for f in fn:
            if not f.endswith(".md"):
                continue
            p = Path(dp) / f
            # vault infrastructure docs at root are not notes
            if p.parent == ROOT and f in ("CLAUDE.md", "README.md"):
                continue
            try:
                t = p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            dst, reason = classify(p, t)
            rows.append((str(p.relative_to(ROOT)), dst, reason, len(t.split())))
            counts[dst] = counts.get(dst, 0) + 1
    rows.sort(key=lambda r: (r[1], r[0]))
    with OUT.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["src", "dst", "reason", "words"])
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows -> {OUT}")
    for k in sorted(counts):
        print(f"  {k:12} {counts[k]:6}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""zk-link-backfill.py — Phase 4: auto-insert [[wikilinks]] from an alias index. 0 tokens.

Builds an index of {title, id, aliases} -> canonical note for the permanent layers,
then scans every note body for literal whole-phrase mentions and wraps the FIRST
mention per target in `[[canonical|surface]]`. This fixes graph orphans without the model.

Conservative by construction:
  - link targets come only from 20-notes + 30-maps (concepts/tools/maps), not sources
  - skips frontmatter, fenced ```code```, inline `code`, existing [[links]], and URLs
  - whole-word/phrase match, case-insensitive; min length 4; a stoplist drops common words
  - at most one new link per (note, target) — no link spam

DEFAULT = dry-run (reports orphan delta). Pass --apply to edit files.

Usage: zk-link-backfill.py <vault> [--apply] [--link-in 10-sources,20-notes,30-maps]
"""
import sys, os, re, argparse
from pathlib import Path

TARGET_LAYERS = ["20-notes", "30-maps"]          # what we link TO (concepts, tools, maps)
DEFAULT_SCAN = ["10-sources", "20-notes", "30-maps"]  # what we scan/edit
FM = re.compile(r'^---\s*\n.*?\n---\s*\n', re.S)
WL = re.compile(r'\[\[[^\]]+\]\]')
FENCE = re.compile(r'```.*?```', re.S)
INLINE = re.compile(r'`[^`]+`')
URL = re.compile(r'https?://\S+')
STOP = {"note", "notes", "index", "code", "data", "api", "cli", "app", "the", "and",
        "test", "type", "tool", "file", "post", "read", "list", "core", "main",
        "term", "terms", "summary", "related", "source", "sources", "integration",
        "overview", "links", "general", "datasets", "dataset", "agents", "agent",
        "content", "example", "examples", "results", "key points", "how it works",
        "ideas", "blogs", "open source", "watchlist", "reading", "software"}
DOMAINISH = re.compile(r'.*\.[a-z]{2,4}$')  # www.dbreunig.com, dl.acm.org — attribution stubs, not concepts
ATTRIB = re.compile(r'.+\s-\s.+\.[a-z]{2,4}$')  # "Open Source - github.com" — literature title, not a concept
HEADING = re.compile(r'^\s{0,3}#{1,6}\s', re.M)


def kv(fm_text, key):
    m = re.search(rf'^{key}:\s*(.+)$', fm_text, re.M)
    return m.group(1).strip().strip('"') if m else ""


def aliases_of(fm_text):
    m = re.search(r'^aliases:\s*\[(.*?)\]', fm_text, re.M)
    if m:
        return [a.strip().strip('"\'') for a in m.group(1).split(",") if a.strip()]
    # block form
    out, grab = [], False
    for ln in fm_text.splitlines():
        if re.match(r'^aliases:\s*$', ln):
            grab = True; continue
        if grab:
            mm = re.match(r'^\s*-\s*(.+)$', ln)
            if mm:
                out.append(mm.group(1).strip().strip('"\''))
            else:
                break
    return out


def build_index(vault):
    idx = {}  # lowercased phrase -> canonical stem
    for layer in TARGET_LAYERS:
        for p in (vault / layer).rglob("*.md"):
            stem = p.stem
            text = p.read_text(encoding="utf-8", errors="ignore")
            fmm = FM.match(text)
            fm_text = fmm.group(0) if fmm else ""
            phrases = {stem, kv(fm_text, "title"), kv(fm_text, "id")}
            phrases |= set(aliases_of(fm_text))
            for ph in phrases:
                ph = (ph or "").strip()
                key = ph.lower()
                if len(ph) < 4 or key in STOP or DOMAINISH.match(key) or ATTRIB.match(key):
                    continue
                # first writer wins; prefer shorter canonical stem on clash
                if key not in idx or len(stem) < len(idx[key]):
                    idx[key] = stem
    return idx


def mask_spans(body):
    """Return list of (start,end) spans that must not be linked into."""
    spans = []
    for rx in (FENCE, INLINE, URL, WL):
        spans += [m.span() for m in rx.finditer(body)]
    # mask whole heading lines — never link a ## Heading
    for m in HEADING.finditer(body):
        eol = body.find("\n", m.start())
        spans.append((m.start(), eol if eol != -1 else len(body)))
    return spans


def in_span(pos, spans):
    return any(s <= pos < e for s, e in spans)


def backfill_note(text, idx, self_stem):
    fmm = FM.match(text)
    head = fmm.group(0) if fmm else ""
    body = text[len(head):]
    spans = mask_spans(body)
    added = []
    # longest phrases first so multi-word concepts win over their substrings
    for phrase in sorted(idx, key=len, reverse=True):
        target = idx[phrase]
        if target == self_stem:
            continue
        rx = re.compile(r'(?<![\w\[\-/.])(' + re.escape(phrase) + r')(?![\w\]\-/.])', re.I)
        for m in rx.finditer(body):
            if in_span(m.start(), spans):
                continue
            surface = m.group(1)
            link = f'[[{target}|{surface}]]' if surface.lower() != target.lower() else f'[[{target}]]'
            body = body[:m.start()] + link + body[m.end():]
            added.append(target)
            spans = mask_spans(body)  # recompute after edit
            break  # one link per target per note
    return head + body, added


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vault")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--scan", default=",".join(DEFAULT_SCAN))
    args = ap.parse_args()
    vault = Path(args.vault)
    scan_layers = args.scan.split(",")

    idx = build_index(vault)
    print(f"index: {len(idx)} link phrases from {'+'.join(TARGET_LAYERS)}")

    orphan_before = orphan_after = notes = links = touched = 0
    for layer in scan_layers:
        for p in (vault / layer).rglob("*.md"):
            notes += 1
            text = p.read_text(encoding="utf-8", errors="ignore")
            had = bool(WL.search(text))
            new, added = backfill_note(text, idx, p.stem)
            if not had:
                orphan_before += 1
            if added and args.apply:
                p.write_text(new, encoding="utf-8")
            if added:
                touched += 1
                links += len(added)
            has_after = bool(WL.search(new))
            if not has_after:
                orphan_after += 1

    mode = "APPLIED" if args.apply else "DRY-RUN (no changes)"
    print(f"[{mode}] scanned {notes} notes · {links} links {'added' if args.apply else 'would add'} "
          f"across {touched} notes")
    print(f"orphans: {orphan_before} -> {orphan_after} "
          f"({orphan_before - orphan_after} fewer, {100*(orphan_before-orphan_after)//max(orphan_before,1)}% reduction)")


if __name__ == "__main__":
    main()

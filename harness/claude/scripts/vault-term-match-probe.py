#!/usr/bin/env python3
"""vault-term-match-probe.py — can a code-side title+alias index resolve terms that
have a DIFFERENT name from the note that already defines them?

The question qmd BM25 is used for. This probe answers it without an index:
read every note's `title` + `aliases` frontmatter once, normalize, and score
candidates by token overlap.

Read-only. Prints per-term candidates and the wall-clock cost of the whole pass.

Usage:  vault-term-match-probe.py <notes-dir> [term ...]
"""
import os
import re
import sys
import time
import unicodedata

STOP = {"the", "a", "an", "of", "for", "in", "on", "to", "and", "or"}


def normalize(s):
    """lowercase, strip accents/punctuation, singularize crudely, drop stopwords."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", " ", s.lower())
    toks = []
    for t in s.split():
        if t in STOP:
            continue
        toks.append(singular(t))
    return toks


def singular(t):
    """Crude but order-correct. The naive 'strip es before s' rule turns
    memtables -> memtabl and silently loses the match to memtable."""
    if len(t) <= 3:
        return t
    if t.endswith("ies"):
        return t[:-3] + "y"
    if t.endswith(("ses", "xes", "zes", "ches", "shes")):
        return t[:-2]
    if t.endswith("s") and not t.endswith("ss"):
        return t[:-1]
    return t


def parse_front(path):
    """Return (title, [aliases]) without a yaml dependency — same approach as store/frontmatter.ts."""
    title, aliases = None, []
    try:
        with open(path, "r", encoding="utf8", errors="replace") as fh:
            if fh.readline().rstrip("\n") != "---":
                return None, []
            for line in fh:
                line = line.rstrip("\n")
                if line == "---":
                    break
                m = re.match(r"^title:\s*(.+)$", line)
                if m:
                    title = m.group(1).strip().strip("\"'")
                m = re.match(r"^aliases:\s*\[(.*)\]\s*$", line)
                if m and m.group(1).strip():
                    aliases = [a.strip().strip("\"'") for a in m.group(1).split(",")]
    except OSError:
        pass
    return title, aliases


def build(notes_dir):
    """slug -> {'title':…, 'names':[(display, tokenset), …]}"""
    idx = {}
    for name in os.listdir(notes_dir):
        if not name.endswith(".md"):
            continue
        path = os.path.join(notes_dir, name)
        slug = name[:-3]
        title, aliases = parse_front(path)
        names = []
        for disp in [title or slug] + aliases:
            toks = set(normalize(disp))
            if toks:
                names.append((disp, toks))
        idx[slug] = {"title": title or slug, "names": names}
    return idx


def score(term_toks, entry):
    """containment: how much of the query is covered, tie-broken by how tight the match is."""
    best = (0.0, None)
    for disp, toks in entry["names"]:
        if not toks:
            continue
        inter = term_toks & toks
        if not inter:
            continue
        covered = len(inter) / len(term_toks)      # all query words present?
        tightness = len(inter) / len(toks)         # penalise very broad titles
        s = covered * (0.5 + 0.5 * tightness)
        if s > best[0]:
            best = (s, disp)
    return best


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    notes_dir = sys.argv[1]
    terms = sys.argv[2:] or [
        "sparse index", "write amplification", "skip list", "tombstone",
        "raft", "write-ahead log", "WAL", "LSM tree", "log structured merge tree",
        "bloom filters", "memtables",
    ]

    t0 = time.perf_counter()
    idx = build(notes_dir)
    build_ms = (time.perf_counter() - t0) * 1000
    n_alias = sum(len(e["names"]) - 1 for e in idx.values())
    print(f"indexed {len(idx)} notes ({n_alias} aliases) in {build_ms:.0f}ms\n")

    for term in terms:
        tt = set(normalize(term))
        t0 = time.perf_counter()
        hits = []
        for slug, entry in idx.items():
            s, via = score(tt, entry)
            if s > 0:
                hits.append((s, slug, via, entry["title"]))
        hits.sort(reverse=True)
        q_us = (time.perf_counter() - t0) * 1000

        exact = "EXACT" if hits and hits[0][0] >= 0.999 else "     "
        print(f'{exact} "{term}"   {q_us:.1f}ms, {len(hits)} candidates')
        for s, slug, via, title in hits[:4]:
            note = f'  (via alias "{via}")' if via != title else ""
            print(f"        {s:.2f}  {slug}{note}")
        if not hits:
            print("        -- none --")
        print()


if __name__ == "__main__":
    main()

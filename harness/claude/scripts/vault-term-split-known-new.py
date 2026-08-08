#!/usr/bin/env python3
"""vault-term-split-known-new.py — split extracted terms into "already has a note" vs "new".

Takes the deduped term list produced by workflow-journal-aggregate-terms.py and resolves
each entry against the vault's own title+alias index (the same matching used by lookup).

Emits two lists:
  known-terms.txt  terms whose note exists -> candidates for improvement
  new-terms.txt    terms with no note      -> candidates for creation

Read-only. Usage:
  vault-term-split-known-new.py <terms.json> <notes-dir> [--out DIR] [--min-count N]
"""
import json
import os
import re
import sys
import unicodedata

STOP = {"the", "a", "an", "of", "for", "in", "on", "to", "and", "or"}


def singular(t):
    if len(t) <= 3:
        return t
    if t.endswith("ies"):
        return t[:-3] + "y"
    if t.endswith(("ses", "xes", "zes", "ches", "shes")):
        return t[:-2]
    if t.endswith("s") and not t.endswith("ss"):
        return t[:-1]
    return t


def tokens(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", " ", s.lower())
    return [singular(w) for w in s.split() if w not in STOP]


def parse_front(path):
    title, aliases = None, []
    try:
        with open(path, encoding="utf8", errors="replace") as fh:
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
    idx = {}
    for name in os.listdir(notes_dir):
        if not name.endswith(".md"):
            continue
        slug = name[:-3]
        title, aliases = parse_front(os.path.join(notes_dir, name))
        names = []
        for disp in [title or slug] + aliases + [slug.replace("-", " ")]:
            ts = set(tokens(disp))
            if ts:
                names.append((disp, ts))
        idx[slug] = {"title": title or slug, "names": names}
    return idx


def best(term_toks, idx):
    top = (0.0, None, None)
    for slug, entry in idx.items():
        for disp, ts in entry["names"]:
            inter = term_toks & ts
            if not inter:
                continue
            covered = len(inter) / len(term_toks)
            tight = len(inter) / len(ts)
            s = covered * (0.5 + 0.5 * tight)
            if s > top[0]:
                top = (s, slug, disp)
    return top


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    terms = json.load(open(sys.argv[1], encoding="utf8"))
    notes_dir = sys.argv[2]
    out_dir = None
    if "--out" in sys.argv:
        out_dir = sys.argv[sys.argv.index("--out") + 1]
        os.makedirs(out_dir, exist_ok=True)
    min_count = 1
    if "--min-count" in sys.argv:
        min_count = int(sys.argv[sys.argv.index("--min-count") + 1])

    idx = build(notes_dir)
    known, near, new = [], [], []
    for e in terms:
        if e["count"] < min_count:
            continue
        tt = set(tokens(e["term"]))
        if not tt:
            continue
        score, slug, via = best(tt, idx)
        row = {**e, "score": round(score, 2), "slug": slug, "via": via}
        if score >= 0.999:
            known.append(row)
        elif score >= 0.7:
            near.append(row)
        else:
            new.append(row)

    tot = len(known) + len(near) + len(new)
    print(f"vault notes indexed: {len(idx)}")
    print(f"terms considered:    {tot}  (min-count {min_count})\n")
    print(f"  EXACT  has a note:      {len(known):5}  ({100*len(known)/tot:.1f}%)")
    print(f"  NEAR   0.7-0.99:        {len(near):5}  ({100*len(near)/tot:.1f}%)  needs a judgement call")
    print(f"  NEW    no note:         {len(new):5}  ({100*len(new)/tot:.1f}%)")

    print("\ntop NEW terms by mentions (no note exists):")
    for e in new[:30]:
        print(f"  {e['count']:4}  {e['term']}")

    print("\ntop NEAR matches (existing note under a different name):")
    for e in near[:15]:
        print(f"  {e['count']:4}  {e['term']:38} -> {e['slug']}  ({e['score']})")

    if out_dir:
        for name, rows in (("known-terms", known), ("near-terms", near), ("new-terms", new)):
            with open(os.path.join(out_dir, f"{name}.txt"), "w", encoding="utf8") as fh:
                for e in rows:
                    extra = f"\t{e['slug']}" if e["slug"] else ""
                    fh.write(f"{e['count']}\t{e['term']}{extra}\n")
            with open(os.path.join(out_dir, f"{name}.json"), "w", encoding="utf8") as fh:
                json.dump(rows, fh, indent=1)
        print(f"\nwrote known/near/new .txt + .json to {out_dir}/")


if __name__ == "__main__":
    main()

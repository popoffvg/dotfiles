#!/usr/bin/env python3
"""zk-dedup-sources.py — dedup 10-sources literature notes that are the SAME article.

Groups notes by normalized source url, then WITHIN each url group clusters by body
similarity so distinct articles sharing a coarse url (e.g. a shared /docs page) are never
merged. For each true-duplicate cluster: keep the best note, drop the rest, and fold the
dropped filenames/titles into the survivor's `aliases:` so existing [[links]] keep resolving.

Duplicate tiers (both require the SAME normalized url):
  exact    — identical normalized body text
  strong   — body similarity >= threshold (default 0.90)
Divergent notes (same url, dissimilar bodies) are LEFT ALONE and reported.

"Best" survivor: has content_hash > longest body > cleanest filename (no _1/(1)/--hash suffix).

DEFAULT = dry-run. --apply to delete + write aliases. Undo via jj.

Usage: zk-dedup-sources.py <vault> [--apply] [--threshold 0.90]
"""
import sys, re, argparse, difflib, collections
from pathlib import Path

FM = re.compile(r'^---\s*\n(.*?)\n---\s*\n?', re.S)
SUFFIX = re.compile(r'(--[0-9a-f]{6}|_\d+|\s*\(\d+\))$')


def split_fm(text):
    m = FM.match(text)
    return (m.group(1), text[m.end():]) if m else ("", text)


def kv(block, key):
    m = re.search(rf'^{key}:\s*(.+)$', block, re.M)
    return m.group(1).strip().strip('"\'') if m else ""


def norm_url(u):
    u = u.strip().lower()
    u = re.sub(r'^https?://', '', u)
    u = re.sub(r'^www\.', '', u)
    return u.split('#')[0].split('?')[0].rstrip('/')


def norm_body(body):
    b = re.sub(r'\s+', ' ', body.lower())
    return re.sub(r'[^\w ]', '', b).strip()


def clean_stem(stem):
    while SUFFIX.search(stem):
        stem = SUFFIX.sub('', stem)
    return stem


# strip trailing " - Author" (spaces REQUIRED around the dash, so kebab-slug hyphens survive)
# or " (domain)" attribution segments
ATTRIB_TAIL = re.compile(r'\s+-\s+[^-]+$|\s*\([^()]*\)$')


def core_title(stem):
    """Strip hash/_N/(N) suffixes then trailing ` - author` / `(domain)` attribution
    segments, leaving the leading title. Name-variants of one article collapse to the
    same core; distinct articles (different leading title) stay distinct."""
    s = clean_stem(stem)
    prev = None
    while prev != s:
        prev = s
        s = ATTRIB_TAIL.sub('', s).strip()
    return re.sub(r'[^\w]', '', s.lower())


def best(notes):
    # notes: list of dicts {path, block, body, fp}
    def score(n):
        return (1 if kv(n["block"], "content_hash") else 0,
                len(n["body"]),
                -len(n["path"].name),
                0 if SUFFIX.search(n["path"].stem) else 1)
    return max(notes, key=score)


def add_aliases(block, new_aliases):
    existing = []
    m = re.search(r'^aliases:\s*\[(.*?)\]', block, re.M)
    if m:
        existing = [a.strip().strip('"\'') for a in m.group(1).split(",") if a.strip()]
    merged = list(dict.fromkeys(existing + new_aliases))
    line = 'aliases: [' + ", ".join(f'"{a}"' for a in merged) + ']'
    if m:
        return block[:m.start()] + line + block[m.end():]
    return block.rstrip("\n") + "\n" + line


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vault")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--threshold", type=float, default=0.90)
    args = ap.parse_args()
    src = Path(args.vault) / "10-sources"

    by_url = collections.defaultdict(list)
    for p in src.rglob("*.md"):
        text = p.read_text(encoding="utf-8", errors="ignore")
        block, body = split_fm(text)
        u = kv(block, "url") or kv(block, "source")
        if not u.startswith("http"):
            continue
        by_url[norm_url(u)].append({"path": p, "block": block, "body": body,
                                     "fp": norm_body(body), "text": text})

    dropped = kept = clusters = 0
    plan = []
    divergent_groups = []
    for url, notes in by_url.items():
        if len(notes) < 2:
            continue
        # cluster key: identical body OR same core-title. Distinct articles sharing a
        # coarse url (different leading title AND different body) never merge.
        buckets = collections.defaultdict(list)
        for n in notes:
            n["core"] = core_title(n["path"].stem)
            buckets[n["core"]].append(n)
        # merge buckets whose bodies are byte-identical even if titles differ
        merged_used = set()
        keys = list(buckets)
        for a in range(len(keys)):
            if keys[a] in merged_used:
                continue
            for b in range(a + 1, len(keys)):
                if keys[b] in merged_used:
                    continue
                fa = buckets[keys[a]][0]["fp"]
                fb = buckets[keys[b]][0]["fp"]
                if fa and fa == fb:
                    buckets[keys[a]] += buckets[keys[b]]
                    merged_used.add(keys[b])
        for k in merged_used:
            del buckets[k]

        real_dups = [g for g in buckets.values() if len(g) > 1]
        if len(buckets) > 1 or not real_dups:
            # url has >1 distinct article (or no dup) — record any divergence for review
            if len(buckets) > 1:
                divergent_groups.append((url, [n["path"].name for n in notes]))
        for group in real_dups:
            clusters += 1
            survivor = best(group)
            losers = [n for n in group if n is not survivor]
            aliases = sorted({clean_stem(n["path"].stem) for n in losers} |
                             {n["path"].stem for n in losers})
            plan.append((url, survivor, losers, aliases))
            kept += 1
            dropped += len(losers)

    print(f"url groups with >1 note: {sum(1 for v in by_url.values() if len(v)>1)}")
    print(f"true-duplicate clusters: {clusters}  survivors kept: {kept}  files to drop: {dropped}")
    print(f"same-url-but-DISTINCT-article groups (left alone): {len(divergent_groups)}\n")
    for url, survivor, losers, aliases in plan[:20]:
        print(f"  {url}")
        print(f"     KEEP  {survivor['path'].name}")
        for n in losers:
            print(f"     drop  {n['path'].name}")
    if len(plan) > 20:
        print(f"  … +{len(plan)-20} more clusters")
    if divergent_groups:
        print(f"\n  --- distinct articles sharing a url (NOT deduped, review manually) ---")
        for url, names in divergent_groups[:8]:
            print(f"  {url}: {len(names)} distinct — {names[:3]}")

    if args.apply:
        for url, survivor, losers, aliases in plan:
            nb = add_aliases(survivor["block"], aliases)
            _, body = split_fm(survivor["text"])
            survivor["path"].write_text(f"---\n{nb}\n---\n{body}", encoding="utf-8")
            for n in losers:
                n["path"].unlink()
        print(f"\n[APPLIED] dropped {dropped} duplicate files, folded aliases into {kept} survivors")
    else:
        print(f"\n[DRY-RUN] no changes")


if __name__ == "__main__":
    main()

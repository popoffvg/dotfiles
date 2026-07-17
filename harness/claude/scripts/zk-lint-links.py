#!/usr/bin/env python3
"""zk-lint-links.py — find and remove stale [[wikilinks]] the way Obsidian resolves them.

Obsidian resolves a [[target]] by note basename (case-insensitive) OR a frontmatter
`aliases:` entry OR the note id. A target matching none of those is STALE (an unresolved
link). This is why a filename-only checker over-reports — it ignores aliases.

Removal unwraps the link, keeping the prose:  [[X|Y]] -> Y ,  [[X]] -> X ,  ![[X]] -> (dropped embed).
Code fences and inline code are ignored (a [[example]] shown in a sample is not a real link).

DEFAULT = dry-run (reports stale links). --apply to unwrap them. Undo via jj.

Usage: zk-lint-links.py <vault> [--apply] [--layers ...] [--drop-embeds]
"""
import sys, re, argparse, collections
from pathlib import Path

FM = re.compile(r'^---\s*\n(.*?)\n---\s*\n?', re.S)
WL = re.compile(r'(!?)\[\[([^\]]+)\]\]')
FENCE = re.compile(r'^[ \t]*(```|~~~)')
DEFAULT_LAYERS = ["00-inbox", "10-sources", "20-notes", "30-maps", "40-journal"]
SKIP = {".git", ".jj", ".obsidian", ".trash", ".stfolder", ".cocoindex_code",
        ".firecrawl", "!services", "graphify-out", ".ledger", "_attic"}


def split_fm(text):
    m = FM.match(text)
    return (m.group(1), text[m.end():]) if m else ("", text)


def kv(block, key):
    m = re.search(rf'^{key}:\s*(.+)$', block, re.M)
    return m.group(1).strip().strip('"\'') if m else ""


def aliases_of(block):
    out = []
    m = re.search(r'^aliases:\s*\[(.*?)\]', block, re.M)
    if m:
        out += [a.strip().strip('"\'') for a in m.group(1).split(",") if a.strip()]
    grab = False
    for ln in block.splitlines():
        if re.match(r'^aliases:\s*$', ln):
            grab = True; continue
        if grab:
            mm = re.match(r'^\s*-\s*(.+)$', ln)
            if mm:
                out.append(mm.group(1).strip().strip('"\''))
            else:
                break
    return out


def resolvable_set(vault):
    """Every name Obsidian can resolve a [[link]] to: basename, id, aliases (lowercased).
    Scans the WHOLE vault (a link may target a note in any folder, incl. _attic)."""
    names = set()
    for p in vault.rglob("*.md"):
        if any(part in SKIP for part in p.relative_to(vault).parts[:-1]):
            continue
        names.add(p.stem.lower())
        block, _ = split_fm(p.read_text(encoding="utf-8", errors="ignore"))
        i = kv(block, "id")
        if i:
            names.add(i.lower())
        for a in aliases_of(block):
            names.add(a.lower())
    return names


def norm_target(t):
    # drop display alias and heading/block anchors, take basename, lowercase
    t = t.split("|", 1)[0]
    t = t.split("#", 1)[0]
    t = t.strip().rsplit("/", 1)[-1]
    if t.endswith(".md"):
        t = t[:-4]
    return t.strip().lower()


def mask_fenced(text):
    out, inf = [], False
    for ln in text.split("\n"):
        if FENCE.match(ln):
            inf = not inf; out.append(""); continue
        out.append("" if inf else ln)
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vault")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--layers", default=",".join(DEFAULT_LAYERS))
    ap.add_argument("--drop-embeds", action="store_true",
                    help="also remove stale ![[embed]] entirely (default: keep as text)")
    args = ap.parse_args()
    vault = Path(args.vault)

    resolvable = resolvable_set(vault)
    print(f"resolvable names (basename+id+aliases): {len(resolvable)}")

    stale_targets = collections.Counter()
    stale_by_file = collections.Counter()
    files_scanned = links_total = stale_total = 0

    def repl_factory(counter_file):
        def repl(m):
            nonlocal stale_total
            bang, inner = m.group(1), m.group(2)
            if norm_target(inner) in resolvable:
                return m.group(0)
            stale_total += 1
            stale_targets[norm_target(inner)] += 1
            counter_file[0] += 1
            if bang:  # embed
                display = inner.split("|", 1)[-1] if "|" in inner else ""
                return "" if args.drop_embeds else display
            # normal link -> unwrap to display text
            disp = inner.split("|", 1)[1] if "|" in inner else inner.split("#", 1)[0]
            return disp
        return repl

    for L in args.layers.split(","):
        for p in (vault / L).rglob("*.md"):
            files_scanned += 1
            text = p.read_text(encoding="utf-8", errors="ignore")
            masked = mask_fenced(text)
            links_total += len(WL.findall(masked))
            cf = [0]
            # operate on real text, but decide staleness identically; skip links inside fences
            # by checking each match's position against fenced regions
            fenced_spans = []
            inf = False; pos = 0
            for ln in text.split("\n"):
                if FENCE.match(ln):
                    inf = not inf
                start = pos; pos += len(ln) + 1
                if inf or FENCE.match(ln):
                    fenced_spans.append((start, pos))

            def repl(m):
                if any(s <= m.start() < e for s, e in fenced_spans):
                    return m.group(0)
                return repl_factory(cf)(m)

            new = WL.sub(repl, text)
            if cf[0]:
                stale_by_file[str(p.relative_to(vault))] = cf[0]
                if args.apply and new != text:
                    p.write_text(new, encoding="utf-8")

    print(f"scanned {files_scanned} notes · {links_total} wikilinks · STALE: {stale_total} "
          f"across {len(stale_by_file)} files")
    print("\ntop stale targets:")
    for t, n in stale_targets.most_common(15):
        print(f"  {n:4}  [[{t}]]")
    print("\nfiles with most stale links:")
    for f, n in stale_by_file.most_common(8):
        print(f"  {n:4}  {f}")
    print(f"\n[{'APPLIED — unwrapped stale links' if args.apply else 'DRY-RUN — no changes'}]")


if __name__ == "__main__":
    main()

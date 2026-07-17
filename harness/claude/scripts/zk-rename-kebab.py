#!/usr/bin/env python3
"""zk-rename-kebab.py — align note filenames to their kebab `id`. Undo via jj.

For every note in the zettelkasten layers, rename the file to `<id>.md` and fold the old
filename (and title, if different) into `aliases:` so existing [[Old Name]] links keep
resolving via Obsidian alias resolution. Journals (already `<id>`) are no-ops.

Collision-safe: if two notes resolve to the same id, the second gets `-<n>` appended and
that suffixed name is what its id is updated to (id and filename stay in sync).

DEFAULT = dry-run. --apply to rename. Reverse with jj.

Usage: zk-rename-kebab.py <vault> [--apply] [--layers 00-inbox,10-sources,...]
"""
import sys, re, argparse, collections
from pathlib import Path

FM = re.compile(r'^---\s*\n(.*?)\n---\s*\n?', re.S)
SLUG = re.compile(r'[^a-z0-9]+')
DEFAULT_LAYERS = ["00-inbox", "10-sources", "20-notes", "30-maps", "40-journal"]


def slugify(s):
    return SLUG.sub('-', s.lower()).strip('-') or "note"


def split_fm(text):
    m = FM.match(text)
    return (m.group(1), text[m.end():]) if m else ("", text)


def kv(block, key):
    m = re.search(rf'^{key}:\s*(.+)$', block, re.M)
    return m.group(1).strip().strip('"\'') if m else ""


def get_aliases(block):
    m = re.search(r'^aliases:\s*\[(.*?)\]', block, re.M)
    if not m:
        return []
    return [a.strip().strip('"\'') for a in m.group(1).split(",") if a.strip()]


def set_aliases(block, aliases):
    line = 'aliases: [' + ", ".join(f'"{a}"' for a in aliases) + ']'
    m = re.search(r'^aliases:\s*\[.*?\]', block, re.M)
    if m:
        return block[:m.start()] + line + block[m.end():]
    return block.rstrip("\n") + "\n" + line


def set_id(block, new_id):
    m = re.search(r'^id:\s*.+$', block, re.M)
    if m:
        return block[:m.start()] + f'id: {new_id}' + block[m.end():]
    return f'id: {new_id}\n' + block


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vault")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--layers", default=",".join(DEFAULT_LAYERS))
    args = ap.parse_args()
    vault = Path(args.vault)

    notes = []
    for L in args.layers.split(","):
        for p in sorted((vault / L).rglob("*.md")):
            notes.append(p)

    taken = set()  # target stems already claimed
    plan = []      # (path, new_name, new_id, aliases, block, body)
    no_id = renamed = same = collided = 0

    for p in notes:
        text = p.read_text(encoding="utf-8", errors="ignore")
        block, body = split_fm(text)
        nid = kv(block, "id") or slugify(p.stem)
        if not kv(block, "id"):
            no_id += 1
        # resolve collision
        target = nid
        if target in taken:
            n = 2
            while f"{nid}-{n}" in taken:
                n += 1
            target = f"{nid}-{n}"
            collided += 1
        taken.add(target)

        if target == p.stem:
            same += 1
            continue

        # preserve old references
        old_names = {p.stem}
        title = kv(block, "title")
        if title and slugify(title) != target:
            old_names.add(title)
        aliases = get_aliases(block)
        merged = list(dict.fromkeys(aliases + [o for o in old_names if o not in aliases]))
        plan.append((p, f"{target}.md", target, merged, block, body))
        renamed += 1

    print(f"notes: {len(notes)}  already-aligned: {same}  to-rename: {renamed}  "
          f"collisions-suffixed: {collided}  (missing id, slug-derived: {no_id})")
    for p, newname, *_ in plan[:15]:
        print(f"  {p.name}\n     -> {newname}")
    if len(plan) > 15:
        print(f"  … +{len(plan)-15} more")

    if args.apply:
        # Two-phase to avoid clobber: a final name may currently belong to another file
        # that is itself queued to move. Move every file to a unique temp name first, then
        # to its final name — no rename can ever overwrite a not-yet-moved file.
        tmps = []
        for i, (p, newname, nid, aliases, block, body) in enumerate(plan):
            nb = set_aliases(set_id(block, nid), aliases)
            p.write_text(f"---\n{nb}\n---\n{body}", encoding="utf-8")
            tmp = p.with_name(f".zkrename-{i}.tmp.md")
            p.rename(tmp)
            tmps.append((tmp, p.with_name(newname)))
        collisions_at_apply = 0
        for tmp, final in tmps:
            if final.exists():
                collisions_at_apply += 1
                raise SystemExit(f"ABORT: final target already exists, would clobber: {final}")
            tmp.rename(final)
        print(f"\n[APPLIED] renamed {renamed} files to <id>.md, folded old names into aliases")
    else:
        print(f"\n[DRY-RUN] no changes")


if __name__ == "__main__":
    main()

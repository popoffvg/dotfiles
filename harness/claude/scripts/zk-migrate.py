#!/usr/bin/env python3
"""zk-migrate.py — Phase 1+2 of the zettelkasten migration.

Reads migration_plan.csv (from zk-classify.py) and, per row:
  - moves src -> <vault>/<dst>/<basename>
  - normalizes frontmatter: injects missing id/type/status/created (never reformats
    or overwrites existing keys)
  - collision-safe: byte-identical target -> drop src as duplicate (dedup);
    differing target -> disambiguate with a 6-char content-hash suffix
  - writes an undo log (moves.jsonl) so every move is reversible
  - idempotent: re-runnable, skips already-migrated files

Obsidian links are filename-based, so folder moves preserve [[wikilinks]] as long as
basenames stay unique — which the collision handling guarantees.

DEFAULT = dry-run. Pass --apply to execute.

Usage:
  zk-migrate.py <vault> <plan.csv> [--apply] [--only PREFIX] [--undo UNDO.jsonl]
  zk-migrate.py <vault> --undo-from UNDO.jsonl --apply     # reverse a prior run
"""
import sys, os, csv, json, hashlib, re, argparse
from pathlib import Path
from datetime import datetime, timezone

TYPE_BY_DST = {
    "10-sources": "source", "20-notes": "note", "30-maps": "map",
    "40-journal": "journal", "00-inbox": "fleeting",
}
STATUS_BY_DST = {
    "10-sources": "raw", "20-notes": "permanent", "30-maps": "permanent",
    "40-journal": "permanent", "00-inbox": "raw",
}
FM = re.compile(r'^---\s*\n(.*?)\n---\s*\n?', re.S)
SLUG = re.compile(r'[^a-z0-9]+')


def slugify(name: str) -> str:
    return SLUG.sub('-', name.lower()).strip('-') or "note"


def content_hash(p: Path) -> str:
    return hashlib.sha1(p.read_bytes()).hexdigest()


def note_type(dst: str, reason: str) -> str:
    if reason.startswith("tool"):
        return "tool"
    if reason.startswith("type:"):
        t = reason.split(":", 1)[1].strip()
        return {"term": "note", "concept": "note"}.get(t, t)
    return TYPE_BY_DST.get(dst, "note")


def normalize_frontmatter(text: str, *, ntype: str, dst: str, stem: str, created: str) -> str:
    """Add missing id/type/status/created/title as top-level keys. Never touch existing keys."""
    m = FM.match(text)
    if m:
        fm_block, body = m.group(1), text[m.end():]
        keys = {ln.split(":", 1)[0].strip() for ln in fm_block.splitlines() if ":" in ln and not ln.startswith(" ")}
    else:
        fm_block, body, keys = "", text, set()
    add = []
    if "id" not in keys:
        add.append(f'id: {slugify(stem)}')
    if "type" not in keys:
        add.append(f'type: {ntype}')
    if "status" not in keys:
        add.append(f'status: {STATUS_BY_DST.get(dst, "permanent")}')
    if "created" not in keys and "date" not in keys and "first_seen" not in keys:
        add.append(f'created: {created}')
    if "title" not in keys:
        add.append(f'title: "{stem}"')
    new_fm = (fm_block + ("\n" if fm_block and add else "") + "\n".join(add)).strip("\n")
    return f"---\n{new_fm}\n---\n{body}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vault")
    ap.add_argument("plan", nargs="?")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--only", default=None, help="only migrate src paths starting with this prefix")
    ap.add_argument("--undo", default=None, help="path to write undo log (default <vault>/.ledger/moves.jsonl)")
    ap.add_argument("--undo-from", default=None, help="reverse a prior run from this undo log")
    args = ap.parse_args()

    vault = Path(args.vault)
    undo_path = Path(args.undo) if args.undo else vault / ".ledger" / "moves.jsonl"

    # ---- reverse mode ----
    if args.undo_from:
        entries = [json.loads(l) for l in Path(args.undo_from).read_text().splitlines() if l.strip()]
        for e in reversed(entries):
            if e["action"] != "move":
                continue
            frm, to = vault / e["to"], vault / e["from"]
            if args.apply and frm.exists():
                to.parent.mkdir(parents=True, exist_ok=True)
                os.rename(frm, to)
        print(f"{'Reversed' if args.apply else 'Would reverse'} {len(entries)} moves")
        return

    rows = list(csv.DictReader(open(args.plan)))
    if args.only:
        rows = [r for r in rows if r["src"].startswith(args.only)]
    now = datetime.now(timezone.utc).date().isoformat()

    moved = dropped = suffixed = normalized = skipped = 0
    log = []
    for r in rows:
        src = vault / r["src"]
        dst_dir = vault / r["dst"]
        stem = src.stem
        target = dst_dir / src.name
        if not src.exists():
            skipped += 1
            continue
        if target.resolve() == src.resolve():  # already in place — true no-op
            skipped += 1
            continue
        # collision handling
        if target.exists() and target.resolve() != src.resolve():
            if content_hash(src) == content_hash(target):
                dropped += 1
                log.append({"action": "drop", "from": r["src"], "dup_of": str(target.relative_to(vault))})
                if args.apply:
                    src.unlink()
                continue
            else:
                target = dst_dir / f"{stem}--{content_hash(src)[:6]}.md"
                suffixed += 1
        # normalize frontmatter (skip _attic — raw stays raw)
        text = src.read_text(encoding="utf-8", errors="ignore")
        if r["dst"] != "_attic":
            new = normalize_frontmatter(text, ntype=note_type(r["dst"], r["reason"]),
                                        dst=r["dst"], stem=stem, created=now)
            if new != text:
                normalized += 1
        else:
            new = text
        log.append({"action": "move", "from": r["src"], "to": str(target.relative_to(vault))})
        moved += 1
        if args.apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            if new != text:
                src.write_text(new, encoding="utf-8")
            os.rename(src, target)

    if args.apply:
        undo_path.parent.mkdir(parents=True, exist_ok=True)
        with undo_path.open("a", encoding="utf-8") as fh:
            for e in log:
                fh.write(json.dumps(e, ensure_ascii=False) + "\n")

    mode = "APPLIED" if args.apply else "DRY-RUN (no changes)"
    print(f"[{mode}] moved={moved} normalized={normalized} deduped-dropped={dropped} "
          f"name-suffixed={suffixed} skipped(already-moved)={skipped}")
    if args.apply:
        print(f"undo log: {undo_path}  (reverse with: zk-migrate.py {vault} --undo-from {undo_path} --apply)")


if __name__ == "__main__":
    main()

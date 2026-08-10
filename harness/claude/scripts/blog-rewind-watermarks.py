#!/usr/bin/env python3
"""Rewind the dated (rss) discovery cursors in an openclaw blogs watermarks.json so a run can reach
articles the cursor has already passed. Moves a cursor BACKWARDS only — a cursor already older than
the target is left alone.

Default: no time window. Every dated cursor goes to the epoch, so a source's whole feed is eligible
and the per-run cap paces the release. `--hours N` limits the reach to the last N hours instead.

The cursor is set to the epoch rather than deleted: an absent cursor means "first sight", which
baselines the source and discovers nothing.

Undated (index/sitemap) sources are never touched: their cursor is a seen-id set with no time
dimension, and clearing it makes every link on the index page look new.

Re-ingesting is not a risk — discovery drops any article whose raw artifact already exists — so the
effect is bounded to articles that were never ingested.

Usage: blog-rewind-watermarks.py <watermarks.json> [--hours=N] [--apply]
Dry-run by default. Writes a timestamped backup before saving.
"""
import json
import shutil
import sys
from datetime import datetime, timedelta, timezone


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2
    path = args[0]
    apply = "--apply" in sys.argv
    hours = 72
    for a in sys.argv[1:]:
        if a.startswith("--hours"):
            hours = int(a.split("=", 1)[1]) if "=" in a else int(args[1])

    state = json.load(open(path))
    target = (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    rewound, already_older, undated = 0, 0, 0
    for sid, entry in state.items():
        date = entry.get("date")
        if date is None:
            undated += 1
            continue
        if date <= target:
            already_older += 1
            continue
        entry["date"] = target
        rewound += 1
        print(f"  {sid:38} {date} -> {target}")

    print(f"\nrewound to {target} ({hours}h): {rewound}")
    print(f"already older, untouched     : {already_older}")
    print(f"undated (seen-set), untouched: {undated}")

    if not apply:
        print("\nDRY RUN — pass --apply to write.")
        return 0

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = f"{path}.bak-{stamp}"
    shutil.copy2(path, backup)
    with open(path, "w") as fh:
        json.dump(state, fh, indent=2)
        fh.write("\n")
    print(f"\nbackup: {backup}\nwrote : {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

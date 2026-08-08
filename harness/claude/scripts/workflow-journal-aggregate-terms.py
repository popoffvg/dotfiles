#!/usr/bin/env python3
"""workflow-journal-aggregate-terms.py — rebuild term results from a workflow journal.

A workflow's return value crosses a VM boundary with an array-length cap (4096). A large
result set dies there even though every agent succeeded. The per-agent return values are
already durable in journal.jsonl, so aggregation belongs here, not in the script.

Reads {"type":"result"} lines, pulls {results:[{file,terms[]}]} payloads, dedupes on a
normalized key, and reports counts that keep failure and empty distinct.

Usage:  workflow-journal-aggregate-terms.py <journal.jsonl> [--out <dir>] [--top N]
"""
import json
import os
import re
import sys
from collections import defaultdict


def norm(term):
    """Fold case, punctuation and simple plurals. Deliberately does NOT fold
    acronym<->expansion; that has to be fixed at extraction time."""
    s = re.sub(r"[^a-z0-9]+", " ", term.lower()).strip()
    out = []
    for w in s.split():
        if len(w) > 3 and w.endswith("ies"):
            w = w[:-3] + "y"
        elif len(w) > 3 and w.endswith(("ses", "xes", "zes", "ches", "shes")):
            w = w[:-2]
        elif len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return " ".join(out)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = sys.argv[1]
    out_dir = None
    if "--out" in sys.argv:
        out_dir = sys.argv[sys.argv.index("--out") + 1]
        os.makedirs(out_dir, exist_ok=True)
    top = 40
    if "--top" in sys.argv:
        top = int(sys.argv[sys.argv.index("--top") + 1])

    batches = notes = empty = 0
    by_key = {}
    per_file = {}

    for line in open(path, encoding="utf8"):
        try:
            rec = json.loads(line)
        except Exception:
            continue
        if rec.get("type") != "result":
            continue
        val = rec.get("value") or rec.get("result")
        if not isinstance(val, dict):
            continue
        rows = val.get("results")
        if not isinstance(rows, list):
            continue  # manifest agents and other shapes
        batches += 1
        for r in rows:
            if not isinstance(r, dict):
                continue
            f = r.get("file") or "?"
            terms = [t for t in (r.get("terms") or []) if str(t).strip()]
            notes += 1
            per_file[f] = terms
            if not terms:
                empty += 1
            for raw in terms:
                t = str(raw).strip()
                k = norm(t)
                if not k:
                    continue
                e = by_key.setdefault(k, {"term": t, "count": 0, "files": []})
                e["count"] += 1
                if len(e["files"]) < 5:
                    e["files"].append(f)

    uniq = sorted(by_key.values(), key=lambda e: (-e["count"], e["term"].lower()))

    print(f"journal:        {path}")
    print(f"batches:        {batches}")
    print(f"notes recorded: {notes}")
    print(f"  with terms:   {notes - empty}")
    print(f"  empty:        {empty}")
    print(f"unique terms:   {len(uniq)}")
    print(f"  seen once:    {sum(1 for e in uniq if e['count'] == 1)}")
    print(f"  seen 2+:      {sum(1 for e in uniq if e['count'] >= 2)}")
    print(f"\ntop {top} by mentions:")
    for e in uniq[:top]:
        print(f"  {e['count']:4}  {e['term']}")

    if out_dir:
        with open(os.path.join(out_dir, "terms.json"), "w", encoding="utf8") as fh:
            json.dump(uniq, fh, indent=1)
        with open(os.path.join(out_dir, "terms.txt"), "w", encoding="utf8") as fh:
            for e in uniq:
                fh.write(f"{e['count']}\t{e['term']}\n")
        with open(os.path.join(out_dir, "per-file.json"), "w", encoding="utf8") as fh:
            json.dump(per_file, fh, indent=1)
        print(f"\nwrote terms.json / terms.txt / per-file.json to {out_dir}/")


if __name__ == "__main__":
    main()

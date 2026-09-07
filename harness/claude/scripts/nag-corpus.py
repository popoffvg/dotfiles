#!/usr/bin/env python3
"""Pair each Bash-bypass nag with the command that triggered it.

The nag arrives as a `hook_additional_context` attachment whose text names the
bypass; the command that caused it is the `tool_use` input in the assistant
turn just before. This walks transcripts, keeps that pairing, and writes one
TSV row per nag so the offenders can be counted instead of guessed.

Usage: nag-corpus.py [--projects DIR] [--match SUBSTR] [--out FILE] [--days N]
Output columns: date, project, session, bypass_kind, command (first 200 chars)
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

NAG_MARK = "Bash bypass detected"
# The nag body lists one bullet per detected bypass; this pulls the rule name.
BULLET_RE = re.compile(r"^\s*[-*]\s+(.+?)(?:\s+—|\s+-\s|$)", re.M)


def as_text(content):
    """Attachment content is a list of strings; str() on it yields a repr whose
    newlines are the two characters backslash-n, and every line-anchored match
    then fails silently."""
    if isinstance(content, list):
        return "\n".join(str(x) for x in content)
    return str(content or "")


def kind_of(text):
    kinds = []
    for m in BULLET_RE.finditer(text):
        line = m.group(1)
        line = re.sub(r"`[^`]*`", lambda x: x.group(0), line)
        kinds.append(line.strip()[:80])
    return kinds or ["(unparsed)"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--projects", default=str(Path.home() / ".claude" / "projects"))
    ap.add_argument("--match")
    ap.add_argument("--days", type=int)
    ap.add_argument("--out")
    args = ap.parse_args()

    cutoff = time.time() - args.days * 86400 if args.days else None
    out = open(args.out, "w", encoding="utf-8") if args.out else sys.stdout
    rows = 0
    base = Path(args.projects)
    for path in sorted(base.rglob("*.jsonl")):
        if args.match and args.match not in str(path):
            continue
        if cutoff and path.stat().st_mtime < cutoff:
            continue
        last_cmd = ""
        last_ts = ""
        try:
            fh = open(path, encoding="utf-8", errors="replace")
        except OSError:
            continue
        with fh:
            for raw in fh:
                try:
                    rec = json.loads(raw)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                if not isinstance(rec, dict):
                    continue
                content = (rec.get("message") or {}).get("content")
                if isinstance(content, list):
                    for b in content:
                        if (isinstance(b, dict) and b.get("type") == "tool_use"
                                and b.get("name") == "Bash"):
                            last_cmd = str((b.get("input") or {}).get("command", ""))
                            last_ts = rec.get("timestamp") or ""
                if rec.get("type") == "attachment":
                    att = rec.get("attachment") or {}
                    text = as_text(att.get("content"))
                    if att.get("type") == "hook_additional_context" and NAG_MARK in text:
                        for kind in kind_of(text):
                            cmd = " ".join(last_cmd.split())[:200]
                            out.write(f"{last_ts[:10]}\t{path.parent.name}\t"
                                      f"{path.stem}\t{kind}\t{cmd}\n")
                            rows += 1
    if args.out:
        out.close()
    print(f"nag-corpus: {rows} nag rows", file=sys.stderr)


if __name__ == "__main__":
    main()

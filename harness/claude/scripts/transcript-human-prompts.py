#!/usr/bin/env python3
"""Print the human prompts of a Claude Code transcript, in order.

A transcript's `user` records also carry tool results and hook output; only
`origin.kind == "human"` is something the operator typed.

Usage:
  transcript-human-prompts.py <transcript.jsonl|session-id> [--grep PATTERN] [--context N] [--max N]

  <session-id>  resolves under ~/.claude/projects/**/ and
                ~/.claude/self-improvement/lessons/, newest match first.
  --grep        case-insensitive regex; prints only matching prompts
  --context N   also print the assistant text that followed a matched prompt,
                truncated to N chars (0 = off, default 0)
  --max N       stop after N printed prompts
"""
import json
import re
import sys
from pathlib import Path

HOME = Path.home()
SEARCH_DIRS = [HOME / ".claude" / "projects", HOME / ".claude" / "self-improvement" / "lessons"]


def resolve(target: str) -> Path:
    p = Path(target)
    if p.is_file():
        return p
    hits = []
    for d in SEARCH_DIRS:
        hits.extend(d.rglob(f"*{target}*.jsonl"))
    if not hits:
        sys.exit(f"no transcript matching {target!r} under {[str(d) for d in SEARCH_DIRS]}")
    return max(hits, key=lambda f: f.stat().st_mtime)


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content
                         if isinstance(b, dict) and b.get("type") == "text")
    return ""


def main() -> None:
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    target = args[0]
    pattern = None
    context = 0
    limit = None
    i = 1
    while i < len(args):
        if args[i] == "--grep":
            pattern = re.compile(args[i + 1], re.I); i += 2
        elif args[i] == "--context":
            context = int(args[i + 1]); i += 2
        elif args[i] == "--max":
            limit = int(args[i + 1]); i += 2
        else:
            sys.exit(f"unknown arg {args[i]!r}")

    path = resolve(target)
    print(f"# {path}\n")

    printed = 0
    pending = None          # a matched prompt awaiting the next assistant text
    with path.open() as fh:
        for lineno, line in enumerate(fh, 1):
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue

            if rec.get("type") == "user" and (rec.get("origin") or {}).get("kind") == "human":
                body = text_of((rec.get("message") or {}).get("content")).strip()
                if not body:
                    continue
                if pattern and not pattern.search(body):
                    pending = None
                    continue
                print(f"--- line {lineno} ---")
                print(body)
                print()
                printed += 1
                pending = True if context else None
                if limit and printed >= limit and not context:
                    return
                continue

            if pending and rec.get("type") == "assistant":
                body = text_of((rec.get("message") or {}).get("content")).strip()
                if body:
                    print(f"    [reply] {body[:context]}")
                    print()
                    pending = None
                    if limit and printed >= limit:
                        return


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Rebuild files from the Write/Edit calls recorded in Claude Code transcripts.

Use it when a working tree (a scratchpad, a deleted worktree, an unsaved `.notes`
directory) is gone but the session that produced it still has its transcript.
The script replays every successful Write / Edit / MultiEdit tool call in
timestamp order and reconstructs the final content of each file.

A file is `ok` only when a Write started it inside the replayed transcripts.
A file that was only edited (its content came from disk, not from the session)
is reported as `edits-only` and is not written out, because the base text is
unknown. Edits whose recorded tool_result was an error are skipped, so a failed
edit never lands in the output.

Args:
  <transcript.jsonl | session-id>...   transcripts to replay, oldest first;
                                       a bare id is resolved under
                                       ~/.claude/projects and
                                       ~/.claude/self-improvement/lessons
  --under PREFIX   only handle paths starting with PREFIX (repeatable)
  --strip PREFIX   drop PREFIX from each path before writing under --out
  --out DIR        write the reconstructed files under DIR (default: report only)
  --force          overwrite files that already exist under --out
"""

import argparse
import json
import os
import sys

WRITE_TOOLS = {"Write"}
EDIT_TOOLS = {"Edit", "MultiEdit"}


def resolve(name):
    if os.path.exists(name):
        return name
    roots = [
        os.path.expanduser("~/.claude/projects"),
        os.path.expanduser("~/.claude/self-improvement/lessons"),
    ]
    for root in roots:
        for dirpath, _dirnames, filenames in os.walk(root):
            for fn in filenames:
                if fn.endswith(".jsonl") and name in fn:
                    return os.path.join(dirpath, fn)
    sys.exit(f"transcript not found: {name}")


def entries(path):
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                yield json.loads(line)
            except ValueError:
                continue


def apply_edit(text, old, new, replace_all):
    if old == "":
        return None, "empty old_string"
    if old not in text:
        return None, "old_string not found"
    if replace_all:
        return text.replace(old, new), None
    if text.count(old) > 1:
        return None, "old_string not unique"
    return text.replace(old, new, 1), None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("transcripts", nargs="+")
    ap.add_argument("--under", action="append", default=[])
    ap.add_argument("--strip", default="")
    ap.add_argument("--out")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    ops = []
    for name in args.transcripts:
        path = resolve(name)
        errors = set()
        recorded = []
        for d in entries(path):
            msg = d.get("message") or {}
            content = msg.get("content")
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "tool_result" and block.get("is_error"):
                    errors.add(block.get("tool_use_id"))
                if block.get("type") != "tool_use":
                    continue
                name_ = block.get("name")
                if name_ not in WRITE_TOOLS | EDIT_TOOLS:
                    continue
                recorded.append((d.get("timestamp") or "", block.get("id"), name_,
                                 block.get("input") or {}))
        ops.extend((ts, uid, tool, inp, errors) for ts, uid, tool, inp in recorded)

    ops.sort(key=lambda o: o[0])

    files = {}
    notes = {}
    for _ts, uid, tool, inp, errors in ops:
        path = inp.get("file_path") or inp.get("path")
        if not path:
            continue
        if args.under and not any(path.startswith(p) for p in args.under):
            continue
        if uid in errors:
            continue
        if tool in WRITE_TOOLS:
            files[path] = inp.get("content", "")
            notes.setdefault(path, [])
            continue
        edits = inp.get("edits") or [inp]
        for e in edits:
            if path not in files:
                notes.setdefault(path, []).append("edits-only")
                continue
            new_text, err = apply_edit(files[path], e.get("old_string", ""),
                                       e.get("new_string", ""),
                                       bool(e.get("replace_all")))
            if err:
                notes.setdefault(path, []).append(f"edit skipped: {err}")
            else:
                files[path] = new_text

    written = 0
    for path in sorted(notes):
        status = "ok" if path in files else "edits-only"
        detail = "; ".join(sorted(set(notes[path]))) if notes[path] else ""
        line = f"{status:10} {path}"
        if detail:
            line += f"   [{detail}]"
        print(line)
        if args.out and path in files:
            rel = path[len(args.strip):] if args.strip and path.startswith(args.strip) else path.lstrip("/")
            dest = os.path.join(args.out, rel)
            if os.path.exists(dest) and not args.force:
                print(f"{'exists':10} {dest} (use --force)")
                continue
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "w", encoding="utf-8") as fh:
                fh.write(files[path])
            written += 1

    print(f"\n{len(files)} reconstructed, {len(notes) - len(files)} edits-only"
          + (f", {written} written to {args.out}" if args.out else ""))


if __name__ == "__main__":
    main()

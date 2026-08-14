#!/usr/bin/env python3
"""Distill a Claude Code session .jsonl into a compact step trace.

Usage: distill-session.py <session.jsonl> [<out.txt>]

Emits one line per turn event:
  U: <user prompt, trimmed>
  A: <assistant text, trimmed>
  T: <ToolName> <short arg hint>
  S: <slash command / skill name>
Filters out system-reminders, hook output, tool results, and thinking blocks.
"""
import json
import sys
from pathlib import Path

MAX_U = 700
MAX_A = 300
MAX_ARG = 160

NOISE = ("<system-reminder", "<command-message", "Caveat: The messages below")


def trim(s, n):
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[:n] + " …"


def arg_hint(name, inp):
    if not isinstance(inp, dict):
        return ""
    for key in ("command", "file_path", "pattern", "path", "skill", "prompt",
                "description", "query", "url", "old_string"):
        if key in inp:
            return f"[{key}={trim(inp[key], MAX_ARG)}]"
    return ""


def main():
    src = Path(sys.argv[1])
    out = []
    for raw in src.open(encoding="utf-8", errors="replace"):
        raw = raw.strip()
        if not raw:
            continue
        try:
            rec = json.loads(raw)
        except json.JSONDecodeError:
            continue
        role = rec.get("type")
        msg = rec.get("message") or {}
        content = msg.get("content")
        if role == "user":
            if rec.get("isMeta") or rec.get("toolUseResult"):
                continue
            texts = []
            if isinstance(content, str):
                texts = [content]
            elif isinstance(content, list):
                texts = [b.get("text", "") for b in content
                         if isinstance(b, dict) and b.get("type") == "text"]
            for t in texts:
                t = t.strip()
                if not t or t.startswith(NOISE):
                    continue
                if t.startswith("<command-name>") or t.startswith("/"):
                    out.append("S: " + trim(t, MAX_U))
                else:
                    out.append("U: " + trim(t, MAX_U))
        elif role == "assistant" and isinstance(content, list):
            for b in content:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "text" and b.get("text", "").strip():
                    out.append("A: " + trim(b["text"], MAX_A))
                elif b.get("type") == "tool_use":
                    out.append(f"T: {b.get('name')} {arg_hint(b.get('name'), b.get('input'))}".rstrip())
    # collapse runs of identical consecutive tool lines
    dedup = []
    for line in out:
        if dedup and dedup[-1] == line:
            continue
        dedup.append(line)
    text = f"# session {src.stem}\n" + "\n".join(dedup) + "\n"
    if len(sys.argv) > 2:
        Path(sys.argv[2]).write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()

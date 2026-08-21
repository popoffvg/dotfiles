#!/usr/bin/env python3
"""Mine human user turns out of a corpus of Claude Code transcripts.

Usage:
  mine-user-corrections.py <glob-root> [--match SUBSTR] [--all] [--min-chars N]
                           [--out FILE] [--stats]

Walks every *.jsonl under <glob-root> whose path contains --match (default: any),
extracts REAL human turns (type=user, role=user, plain text), and drops:
  - tool_result blocks
  - <system-reminder> / <command-message> / <command-name> / hook wrappers
  - "Caveat:" preambles, local-command stdout
  - sidechain (subagent) turns

By default it keeps only turns carrying a CORRECTION/DIFFICULTY signal
(negation, "wrong", "again", "still", "why did you", "don't", "no,", …).
--all keeps every human turn.

Output: one record per turn, sorted by timestamp:

  ### <iso-ts> | <session-file-stem> | <signals>
  <text>

Provenance is the session file stem so any finding can be traced back.
"""
import argparse
import json
import re
import sys
from pathlib import Path

NOISE_PREFIX = (
    "<system-reminder", "<command-message", "<command-name", "<command-args",
    "<local-command-stdout", "<local-command-caveat", "<user-prompt-submit-hook",
    "Caveat: The messages below", "<task-notification", "<bash-input",
    "<bash-stdout", "<bash-stderr", "Stop hook feedback:", "PreToolUse:",
    "PostToolUse:", "SessionStart:", "[Request interrupted",
    "Another Claude session sent a message:", "[Your previous response",
    "<teammate-message", "Stop hook", "This session is being continued",
)

# A slash-command expansion pastes the whole SKILL body into the user turn.
# The human's own words are only the ARGUMENTS tail; everything above is harness text.
SKILL_BODY_MARKERS = ("Base directory for this skill:", "# Code — subcommand router")
ARGS_RE = re.compile(r"^ARGUMENTS:\s*(.*)\Z", re.S | re.M)

# Correction / difficulty signals. Ordered groups so the label says WHY it matched.
SIGNALS = {
    "negation": r"\b(no|nope|not that|not this|wrong|incorrect|nonsense|bullshit|bs)\b[,.!\s]",
    "reversal": r"\b(actually|instead|rather than|revert|roll ?back|undo|scrap|forget it|start over)\b",
    "repeat": r"\b(again|still|once more|as I said|I already (said|told)|repeat(ing)?|third time|second time)\b",
    "prohibition": r"\b(don'?t|do not|never|stop|avoid|must not|should not|shouldn'?t)\b",
    "interrogative-blame": r"\bwhy (did|are|do|is|would) you\b|\bwho (told|asked) you\b|\bwhat made you\b",
    "failure": r"\b(fail(s|ed|ing)?|broke|broken|error|crash(ed|es)?|doesn'?t work|not work(ing)?|hangs?|stuck)\b",
    "misread": r"\b(you (missed|forgot|ignored|misunderstood|misread|skipped|invented|hallucinat))\b",
    "scope": r"\b(too (much|many|broad)|out of scope|scope creep|I didn'?t ask|only asked|just asked)\b",
    "correction-verb": r"\b(fix|correct|change it|redo|rewrite|replace it)\b",
}
SIGNAL_RE = {k: re.compile(v, re.I) for k, v in SIGNALS.items()}


def text_of(msg):
    """Return the human-authored text of a user message, or None."""
    content = msg.get("content")
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return None
    parts = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "tool_result":
            return None          # tool output, not a human turn
        if block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "\n".join(parts) if parts else None


def is_noise(text):
    stripped = text.lstrip()
    if not stripped:
        return True
    return stripped.startswith(NOISE_PREFIX)


def strip_reminders(text):
    """Drop embedded system-reminder blocks but keep the human prose around them."""
    return re.sub(r"<system-reminder>.*?</system-reminder>", "", text, flags=re.S).strip()


def unwrap_skill_body(text):
    """A slash command pastes the SKILL body in. Keep only the human ARGUMENTS tail."""
    if not any(m in text[:4000] for m in SKILL_BODY_MARKERS):
        return text
    m = ARGS_RE.search(text)
    return m.group(1).strip() if m else ""


def signals_for(text):
    return [name for name, rx in SIGNAL_RE.items() if rx.search(text)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--match", default="", help="only files whose path contains this")
    ap.add_argument("--all", action="store_true", help="keep every human turn")
    ap.add_argument("--min-chars", type=int, default=8)
    ap.add_argument("--max-chars", type=int, default=4000)
    ap.add_argument("--out", default="-")
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args()

    records, files_seen, turns_seen = [], 0, 0
    for path in sorted(Path(args.root).rglob("*.jsonl")):
        if args.match and args.match not in str(path):
            continue
        files_seen += 1
        try:
            lines = path.read_text(errors="replace").splitlines()
        except OSError:
            continue
        for line in lines:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d.get("type") != "user" or d.get("isSidechain"):
                continue
            msg = d.get("message")
            if not isinstance(msg, dict) or msg.get("role") != "user":
                continue
            text = text_of(msg)
            if text is None or is_noise(text):
                continue
            text = unwrap_skill_body(strip_reminders(text))
            if len(text) < args.min_chars or is_noise(text):
                continue
            turns_seen += 1
            sigs = signals_for(text)
            if not args.all and not sigs:
                continue
            records.append((d.get("timestamp", ""), path.stem[:8], sigs,
                            text[:args.max_chars]))

    records.sort(key=lambda r: r[0])
    out = sys.stdout if args.out == "-" else open(args.out, "w")
    seen = set()
    kept = 0
    for ts, stem, sigs, text in records:
        key = " ".join(text.split())[:300]
        if key in seen:                      # same prompt resent across sessions
            continue
        seen.add(key)
        kept += 1
        print(f"### {ts} | {stem} | {','.join(sigs) or '-'}", file=out)
        print(text, file=out)
        print(file=out)
    if out is not sys.stdout:
        out.close()
    if args.stats:
        print(f"files={files_seen} human_turns={turns_seen} "
              f"matched={len(records)} unique={kept}", file=sys.stderr)


if __name__ == "__main__":
    main()

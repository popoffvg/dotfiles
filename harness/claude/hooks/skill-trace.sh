#!/usr/bin/env bash
# PreToolUse hook for the Skill tool: append one JSONL line per skill invocation.
# Log: ~/.claude/insights/skill-trace.jsonl
# Never blocks — always exits 0 so a logging failure cannot break a skill call.
set -uo pipefail

LOG="${HOME}/.claude/insights/skill-trace.jsonl"
mkdir -p "$(dirname "$LOG")" 2>/dev/null || exit 0

payload=$(cat 2>/dev/null) || exit 0
[ -z "$payload" ] && exit 0

printf '%s' "$payload" | python3 -c '
import json, sys, os, datetime
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
inp = d.get("tool_input") or {}
rec = {
    "ts": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    "skill": inp.get("skill"),
    "args": inp.get("args"),
    "cwd": d.get("cwd"),
    "session": d.get("session_id"),
    "transcript": d.get("transcript_path"),
}
with open(os.path.expanduser("~/.claude/insights/skill-trace.jsonl"), "a") as fh:
    fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
' 2>/dev/null

exit 0

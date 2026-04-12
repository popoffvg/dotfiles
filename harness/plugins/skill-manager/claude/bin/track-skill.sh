#!/usr/bin/env bash
# PostToolUse(Read) hook — detect SKILL.md reads, append skill_activate to JSONL.
# Reads hook input from stdin (JSON with tool_name, tool_input, tool_output).

set -euo pipefail

JSONL_FILE="$HOME/.pi/agent/skill-stats-session.jsonl"

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || exit 0

# Only track SKILL.md reads
if [[ "$FILE_PATH" != */SKILL.md ]]; then
  exit 0
fi

# Extract skill name from path: .../skills/<name>/SKILL.md or .../<name>/SKILL.md
SKILL_NAME=$(basename "$(dirname "$FILE_PATH")")
if [[ -z "$SKILL_NAME" ]] || [[ "$SKILL_NAME" == "." ]]; then
  exit 0
fi

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$(dirname "$JSONL_FILE")"
jq -nc --arg skill "$SKILL_NAME" --arg ts "$TS" \
  '{type:"skill_activate",skill:$skill,ts:$ts}' >> "$JSONL_FILE"

exit 0

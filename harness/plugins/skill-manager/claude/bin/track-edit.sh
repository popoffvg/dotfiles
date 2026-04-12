#!/usr/bin/env bash
# PostToolUse(Edit|Write) hook — track file edits for thrashing detection.
# Reads hook input from stdin (JSON with tool_name, tool_input).

set -euo pipefail

JSONL_FILE="$HOME/.pi/agent/skill-stats-session.jsonl"

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || exit 0

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$(dirname "$JSONL_FILE")"
jq -nc --arg path "$FILE_PATH" --arg ts "$TS" \
  '{type:"file_edit",path:$path,ts:$ts}' >> "$JSONL_FILE"

exit 0

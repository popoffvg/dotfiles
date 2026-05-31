#!/usr/bin/env bash
# UserPromptSubmit hook — count user messages, detect friction keywords.
# Reads user prompt from stdin.

set -euo pipefail

JSONL_FILE="$HOME/.pi/agent/skill-stats-session.jsonl"
mkdir -p "$(dirname "$JSONL_FILE")"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Always count user message
jq -nc --arg ts "$TS" '{type:"user_message",ts:$ts}' >> "$JSONL_FILE"

# Read user input for friction detection
INPUT=$(cat 2>/dev/null) || INPUT=""
USER_TEXT=$(echo "$INPUT" | jq -r '.user_prompt // ""' 2>/dev/null) || USER_TEXT=""

if [[ -z "$USER_TEXT" ]]; then
  exit 0
fi

# Keyword-based friction detection (case-insensitive)
LOWER_TEXT=$(echo "$USER_TEXT" | tr '[:upper:]' '[:lower:]')
FRICTION=false

for keyword in "no," "no." "wrong" "not what i" "i said" "i already" "that's not" "thats not" "try again" "still not" "you forgot" "already told" "not correct" "incorrect"; do
  if [[ "$LOWER_TEXT" == *"$keyword"* ]]; then
    FRICTION=true
    break
  fi
done

if [[ "$FRICTION" == "true" ]]; then
  jq -nc --arg ts "$TS" '{type:"friction",ts:$ts}' >> "$JSONL_FILE"
fi

exit 0

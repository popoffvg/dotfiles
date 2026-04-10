#!/usr/bin/env bash
# Phase guard hook — reads .pi/work.settings.json, blocks plan-phase mutations.
# Called by PreToolUse hook for Bash|Edit|Write.
# Reads hook input from stdin (JSON with tool_name, tool_input).

set -euo pipefail

# Find settings file
find_settings() {
  local dir="$PWD"
  if [[ -f "$dir/.pi/work.settings.json" ]]; then
    echo "$dir/.pi/work.settings.json"
    return 0
  fi
  # Scan immediate subdirs
  for sub in "$dir"/*/; do
    if [[ -f "${sub}.pi/work.settings.json" ]]; then
      echo "${sub}.pi/work.settings.json"
      return 0
    fi
  done
  return 1
}

SETTINGS_FILE=$(find_settings 2>/dev/null) || exit 0

# Read phase and status
PHASE=$(jq -r '.phase // "unknown"' "$SETTINGS_FILE" 2>/dev/null) || exit 0
STATUS=$(jq -r '.status // "active"' "$SETTINGS_FILE" 2>/dev/null) || exit 0

# Only guard in plan phase with active work
if [[ "$PHASE" != "plan" ]] || [[ "$STATUS" != "active" ]]; then
  exit 0
fi

# Parse hook input from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null) || exit 0
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // {}' 2>/dev/null) || exit 0

# Derive notes dir
TASK_DIR=$(dirname "$(dirname "$SETTINGS_FILE")")
NOTES_DIR="$TASK_DIR/_notes"

# Guard Bash commands
if [[ "$TOOL_NAME" == "Bash" ]]; then
  CMD=$(echo "$TOOL_INPUT" | jq -r '.command // ""' 2>/dev/null) || exit 0

  # Read allowed commands from settings
  ALLOWED=$(jq -r '.planAllowedCommands[]' "$SETTINGS_FILE" 2>/dev/null) || ALLOWED=""

  # Check if command starts with any allowed prefix
  ALLOWED_MATCH=false
  while IFS= read -r prefix; do
    [[ -z "$prefix" ]] && continue
    if [[ "$CMD" == "$prefix" ]] || [[ "$CMD" == "$prefix "* ]]; then
      ALLOWED_MATCH=true
      break
    fi
  done <<< "$ALLOWED"

  if [[ "$ALLOWED_MATCH" == "false" ]]; then
    echo '{"decision": "block", "reason": "Plan phase: bash commands that modify files are not allowed. Only reading/inspecting is permitted. Write your plan in _notes/ using edit/write tools."}'
    exit 0
  fi
fi

# Guard Edit/Write — only allow _notes/
if [[ "$TOOL_NAME" == "Edit" ]] || [[ "$TOOL_NAME" == "Write" ]]; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // ""' 2>/dev/null) || exit 0

  if [[ -z "$FILE_PATH" ]]; then
    exit 0
  fi

  # Resolve to absolute path
  RESOLVED=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && echo "$(pwd)/$(basename "$FILE_PATH")") || RESOLVED="$FILE_PATH"
  NOTES_RESOLVED=$(cd "$NOTES_DIR" 2>/dev/null && pwd) || NOTES_RESOLVED="$NOTES_DIR"

  if [[ "$RESOLVED" != "$NOTES_RESOLVED"* ]]; then
    echo "{\"decision\": \"block\", \"reason\": \"Plan phase: cannot modify files outside _notes/. Tried to $TOOL_NAME: $FILE_PATH. Add this to the plan instead.\"}"
    exit 0
  fi
fi

# Allowed
exit 0

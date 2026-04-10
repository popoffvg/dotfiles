#!/usr/bin/env bash
# Status line hook — reads work state and formats phase display.
# Output format: single line for Claude Code statusLine.

set -euo pipefail

# Find settings file
find_settings() {
  local dir="$PWD"
  if [[ -f "$dir/.pi/work.settings.json" ]]; then
    echo "$dir/.pi/work.settings.json"
    return 0
  fi
  for sub in "$dir"/*/; do
    if [[ -f "${sub}.pi/work.settings.json" ]]; then
      echo "${sub}.pi/work.settings.json"
      return 0
    fi
  done
  return 1
}

SETTINGS_FILE=$(find_settings 2>/dev/null) || exit 0

PHASE=$(jq -r '.phase // "unknown"' "$SETTINGS_FILE" 2>/dev/null) || exit 0
STATUS=$(jq -r '.status // "active"' "$SETTINGS_FILE" 2>/dev/null) || exit 0

if [[ "$STATUS" != "active" ]]; then
  exit 0
fi

WORK_ID=$(jq -r '.workId // ""' "$SETTINGS_FILE" 2>/dev/null) || WORK_ID=""
NAME=$(jq -r '.name // ""' "$SETTINGS_FILE" 2>/dev/null) || NAME=""

LABEL="${WORK_ID:-$NAME}"

if [[ -z "$LABEL" ]] || [[ "$LABEL" == "unnamed work" ]]; then
  echo "[${PHASE}]"
else
  echo "${LABEL} [${PHASE}]"
fi

#!/usr/bin/env bash
# PreToolUse hook: wraps bash commands with `tee` to save output to rotating log files.
# Keeps last MAX_LOGS files to avoid filling disk.
#
# Log location: $TMPDIR/claude-bash-logs/<timestamp>.log
# To re-read previous output, use Read tool on the log file instead of rerunning the command.
# List logs: ls $TMPDIR/claude-bash-logs/

set -euo pipefail

LOG_DIR="${TMPDIR:-/private/tmp/claude-501}/claude-bash-logs"
MAX_LOGS=20

mkdir -p "$LOG_DIR"

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$CMD" ]; then
  exit 0
fi

# Skip simple commands that don't produce meaningful output
case "$CMD" in
  cd\ *|true|false|exit\ *) exit 0 ;;
esac

# Skip if already wrapped with tee
if echo "$CMD" | grep -q '| tee .*/claude-bash-logs/'; then
  exit 0
fi

# Rotate: keep only the latest MAX_LOGS files
FILE_COUNT=$(ls -1 "$LOG_DIR"/*.log 2>/dev/null | wc -l | tr -d ' ')
if [ "$FILE_COUNT" -gt "$MAX_LOGS" ]; then
  ls -1t "$LOG_DIR"/*.log | tail -n +"$((MAX_LOGS + 1))" | xargs rm -f
fi

# Create timestamped log file path
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/${TIMESTAMP}.log"

# Wrap command: run in subshell, tee stdout+stderr to log file
WRAPPED="{ ${CMD} ; } 2>&1 | tee \"${LOG_FILE}\" && echo \"[log: ${LOG_FILE}]\""

ORIGINAL_INPUT=$(echo "$INPUT" | jq -c '.tool_input')
UPDATED_INPUT=$(echo "$ORIGINAL_INPUT" | jq --arg cmd "$WRAPPED" '.command = $cmd')

jq -n \
  --argjson updated "$UPDATED_INPUT" \
  --arg reason "bash-log-output: tee → ${LOG_FILE}" \
  '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "allow",
      "permissionDecisionReason": $reason,
      "updatedInput": $updated
    }
  }'

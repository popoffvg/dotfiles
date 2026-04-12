#!/usr/bin/env bash
# PostToolUse(Bash) hook — detect tool failures from exit codes.
# Reads hook input from stdin (JSON with tool_name, tool_input, tool_output).

set -euo pipefail

JSONL_FILE="$HOME/.pi/agent/skill-stats-session.jsonl"

INPUT=$(cat)

# Check for error indicators in the tool output
# tool_output.exit_code for Bash, or error patterns
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_output.exit_code // 0' 2>/dev/null) || EXIT_CODE=0
HAS_ERROR=$(echo "$INPUT" | jq -r '.tool_output.stderr // ""' 2>/dev/null) || HAS_ERROR=""

if [[ "$EXIT_CODE" != "0" ]] && [[ "$EXIT_CODE" != "null" ]]; then
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  mkdir -p "$(dirname "$JSONL_FILE")"
  jq -nc --arg ts "$TS" --arg tool "Bash" '{type:"tool_failure",tool:$tool,ts:$ts}' >> "$JSONL_FILE"
fi

exit 0

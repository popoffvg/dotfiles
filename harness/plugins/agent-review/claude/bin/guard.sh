#!/usr/bin/env bash
# Block direct Edit/Write to .vscode/agent-comments.json.
# Use the comment_update_status MCP tool instead.
set -euo pipefail

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null) || exit 0
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || exit 0

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

if [[ "$FILE_PATH" == *agent-comments.json ]]; then
  echo '{"decision": "block", "reason": "Direct edits to .vscode/agent-comments.json are not allowed. Use the comment_update_status MCP tool to change comment status."}'
  exit 0
fi

exit 0

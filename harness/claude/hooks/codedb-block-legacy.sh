#!/bin/bash
command -v jq >/dev/null 2>&1 || exit 0
command -v codedb >/dev/null 2>&1 || exit 0
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
STRIPPED=$(echo "$CMD" | sed -E 's/^[[:space:]]*(env|sudo|command|builtin|exec|nohup)[[:space:]]+//')
STRIPPED=$(echo "$STRIPPED" | sed -E 's/^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+//')
FIRST=$(echo "$STRIPPED" | awk '{print $1}')
case "$FIRST" in
  grep|rg|egrep|fgrep) echo "BLOCKED: Use mcp__codedb__codedb_search instead of $FIRST. If codedb MCP is not connected, use Bash directly." >&2; exit 2 ;;
  cat) echo "BLOCKED: Use mcp__codedb__codedb_read instead of cat. If codedb MCP is not connected, use Bash directly." >&2; exit 2 ;;
  head|tail) echo "BLOCKED: Use mcp__codedb__codedb_read with line_start/line_end instead of $FIRST. If codedb MCP is not connected, use Bash directly." >&2; exit 2 ;;
  sed|awk) echo "BLOCKED: Use mcp__codedb__codedb_edit instead of $FIRST. If codedb MCP is not connected, use Bash directly." >&2; exit 2 ;;
  find) echo "BLOCKED: Use mcp__codedb__codedb_find or mcp__codedb__codedb_glob instead of find. If codedb MCP is not connected, use Bash directly." >&2; exit 2 ;;
esac
exit 0

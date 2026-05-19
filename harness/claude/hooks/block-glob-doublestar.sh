#!/usr/bin/env bash
# Block Glob tool calls that use **/ patterns.
set -euo pipefail

INPUT=$(cat /dev/stdin)

TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
PATTERN=$(echo "$INPUT" | jq -r '.tool_input.pattern // ""')

if [[ "$TOOL" == "Glob" ]] && [[ "$PATTERN" == **"**/"** || "$PATTERN" == "**"* ]]; then
  echo "{\"decision\":\"block\",\"reason\":\"Glob with **/ pattern is prohibited. Use qmd mcp instead. Pattern: $PATTERN\"}"
  exit 0
fi

echo '{"decision":"allow"}'

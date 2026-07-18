#!/usr/bin/env bash
# PostToolUse (Edit|Write): format the ```ts blocks in a todos/TODO-N.md after
# it is authored/edited. Code-block-only; never blocks the write.
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || exit 0

[[ -z "$FILE_PATH" ]] && exit 0
case "$FILE_PATH" in
  */todos/TODO-*.md) ;;
  *) exit 0 ;;
esac
[[ -f "$FILE_PATH" ]] || exit 0

python3 "${CLAUDE_PLUGIN_ROOT}/bin/format-todo.py" "$FILE_PATH" >/dev/null 2>&1 || true
exit 0

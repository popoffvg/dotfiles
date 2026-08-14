#!/usr/bin/env bash
# PreToolUse Edit|Write guard — deny an edit that breaks a wm hard rule.
#   1. any direct edit to .vscode/agent-comments.json — use the comment_update_status MCP tool
#   2. flipping spec.md to `status: impl` while a thoughts/ question is still `status: open`
# Every other edit passes through untouched.
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || exit 0

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

block() {
  jq -n --arg reason "$1" '{decision: "block", reason: $reason}'
  exit 0
}

if [[ "$FILE_PATH" == *agent-comments.json ]]; then
  block "Direct edits to .vscode/agent-comments.json are not allowed. Use the comment_update_status MCP tool to change comment status."
fi

# --- the gate: no open question when the spec enters impl ---------------------
if [[ "$(basename "$FILE_PATH")" == "spec.md" ]]; then
  # The text this call puts into the file — Write sends content, Edit sends new_string.
  NEW_TEXT=$(echo "$INPUT" | jq -r '
    [.tool_input.content?, .tool_input.new_string?, (.tool_input.edits[]?.new_string)]
    | map(select(. != null)) | join("\n")' 2>/dev/null) || exit 0

  if grep -qE '^status:[[:space:]]*impl([[:space:]]|#|$)' <<<"$NEW_TEXT"; then
    THOUGHTS="$(dirname "$FILE_PATH")/thoughts"
    QUESTIONS="$HOME/.claude/scripts/wm-open-questions.sh"

    if [[ -d "$THOUGHTS" && -x "$QUESTIONS" ]]; then
      OPEN=$("$QUESTIONS" "$THOUGHTS" 2>&1) && RC=0 || RC=$?
      # 0 = none open (pass), 1 = at least one open (block), 2 = usage/dir error (pass).
      if ((RC == 1)); then
        block "$(printf '%s\n\n%s\n\n%s' \
          "The spec cannot enter status: impl — the gate is open questions, and $THOUGHTS still holds one." \
          "$OPEN" \
          "Flip each open question into a decision or fact note (same id, renamed file) before implementation starts. Grill the human for the answer — never resolve one yourself, and never edit the status past it.")"
      fi
    fi
  fi
fi

exit 0

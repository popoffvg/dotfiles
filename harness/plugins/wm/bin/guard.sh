#!/usr/bin/env bash
# PreToolUse Edit|Write guard — deny an edit that breaks a wm hard rule.
#   1. any direct edit to .vscode/agent-comments.json — use the comment_update_status MCP tool
#   2. flipping spec.md to `status: impl` while a thoughts/ question is still `status: open`
#   3. an `approve:` value outside the enum, or `inherit` written on spec.md
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

# The text this call puts into the file — Write sends content, Edit sends new_string.
new_text() {
  echo "$INPUT" | jq -r '
    [.tool_input.content?, .tool_input.new_string?, (.tool_input.edits[]?.new_string)]
    | map(select(. != null)) | join("\n")' 2>/dev/null
}

trim() {
  local s=$1
  s="${s#"${s%%[![:space:]]*}"}"
  printf '%s' "${s%"${s##*[![:space:]]}"}"
}

if [[ "$FILE_PATH" == *agent-comments.json ]]; then
  block "Direct edits to .vscode/agent-comments.json are not allowed. Use the comment_update_status MCP tool to change comment status."
fi

BASE=$(basename "$FILE_PATH")

# --- the gate: no open question when the spec enters impl ---------------------
if [[ "$BASE" == "spec.md" ]]; then
  NEW_TEXT=$(new_text) || exit 0

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

# --- the gate: every `approve:` value is one impl can read --------------------
# The enum and the two per-level defaults are owned by `arch:ref-write.md` § Approval.
# `bin/spec-lint.py` check B3 re-checks the TODO half at verify time; this hook is what
# stops a value impl cannot read from reaching the file in the first place.
if [[ "$BASE" == "spec.md" || "$BASE" == TODO-*.md ]]; then
  APPROVE_TEXT=$(new_text) || exit 0

  ENUM=$(
    cat <<'EOF'
The whole enum:
  increment — show the real diff after each increment and wait
  todo      — apply every increment, then show the whole diff once and wait
  none      — never stop; the review gate chain is the only review the change gets
  inherit   — TODO-N.md only: take the spec's value

Defaults: a missing key on spec.md reads as `increment`, a missing key on a TODO-N.md
reads as `inherit`. Write an override's reason as a trailing comment on the key.
Owned by arch:ref-write.md § Approval.
EOF
  )

  while IFS= read -r line; do
    value=${line#*:}
    value=${value%%\#*}
    value=${value%%—*}
    value=$(trim "$(tr -d '`"'"'" <<<"$value")")

    case "$value" in
      increment | todo | none) ;;
      inherit)
        if [[ "$BASE" == "spec.md" ]]; then
          block "$(printf '%s\n\n%s' \
            "spec.md cannot carry \`approve: inherit\` — the spec is the level with nothing to inherit from, so impl would resolve it to nothing. Pick increment, todo, or none." \
            "$ENUM")"
        fi
        ;;
      *)
        block "$(printf '%s\n\n%s' \
          "\`approve: $value\` is not a value impl can read, so this edit is refused. $BASE would carry an approval level no branch of impl:sub-impl.md Step 5 matches, and the human would silently get either every diff or none of them." \
          "$ENUM")"
        ;;
    esac
  done < <(grep -E '^approve:' <<<"$APPROVE_TEXT" || true)
fi

exit 0

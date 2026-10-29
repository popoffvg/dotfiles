#!/usr/bin/env bash
# PreToolUse Edit|Write guard — deny an edit that breaks a wm hard rule.
#   1. any direct edit to .vscode/agent-comments.json — use the comment_update_status MCP tool
#   2. flipping spec.md to `status: impl` while QUESTIONS.md has an open question, an ADR fails wm-constraints.py --check,
#      or a live ADR is not approved (wm-constraints.py --unapproved)
#   3. an `approve:` value outside the enum, or `inherit` written on spec.md
#   4. a `where:` value outside the enum, or `inherit` written on spec.md
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

# --- the gate: no open question when the spec enters impl -------------------
if [[ "$BASE" == "spec.md" ]]; then
  NEW_TEXT=$(new_text) || exit 0

  if grep -qE '^status:[[:space:]]*impl([[:space:]]|#|$)' <<<"$NEW_TEXT"; then
    ADR="$(dirname "$FILE_PATH")/adr"
    NOTES="$(dirname "$FILE_PATH")"
    QUESTIONS="$HOME/.claude/scripts/wm-open-questions.sh"

    if [[ -x "$QUESTIONS" ]]; then
      OPEN=$("$QUESTIONS" "$NOTES" 2>&1) && RC=0 || RC=$?
      # 0 = no open question (pass), 1 = at least one open (block), 2 = usage/dir error (pass).
      if ((RC == 1)); then
        block "$(printf '%s\n\n%s\n\n%s' \
          "The spec cannot enter status: impl. The gate is QUESTIONS.md, and $NOTES/QUESTIONS.md still has an open question." \
          "$OPEN" \
          "Grill the human for each answer. Write the answer as an ADR with the adr skill after the human approves it, then delete the section from QUESTIONS.md. Delete a moot question with a reason in the commit. Never answer a question yourself.")"
      fi
    fi

    CONSTRAINTS="$HOME/.claude/scripts/wm-constraints.py"

    if [[ -d "$ADR" && -x "$CONSTRAINTS" ]]; then
      REPORT=$("$CONSTRAINTS" "$ADR" --check 2>&1) && CRC=0 || CRC=$?
      if ((CRC == 3)); then
        block "$(printf '%s\n\n%s\n\n%s' \
          "The spec cannot enter status: impl. An ADR in $ADR breaks the format, so a rule is missing or wrong." \
          "$REPORT" \
          "Fix each line: a status of proposed or approved, no ## Question section, a known kind, at least one Property, and a todo: key on an implementation ADR only. Owned by arch:ref-adr-format.md.")"
      fi

      WAITING=$("$CONSTRAINTS" "$ADR" --unapproved 2>&1) && URC=0 || URC=$?
      if ((URC == 4)); then
        block "$(printf '%s\n\n%s\n\n%s' \
          "The spec cannot enter status: impl. Every live ADR in $ADR needs status: approved, and some do not." \
          "$WAITING" \
          "Ask the operator to read each ADR and set status: approved in the editor. Never set the status yourself.")"
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

# --- the gate: every `where:` value names a checkout impl can enter ------------
# The enum and the two per-level defaults are owned by `arch:ref-write.md` § Where the
# work happens. `bin/spec-lint.py` checks A6 and B3 catch one already on disk; this hook
# stops it landing.
if [[ "$BASE" == "spec.md" || "$BASE" == TODO-*.md ]]; then
  WHERE_TEXT=$(new_text) || exit 0

  WHERE_ENUM=$(
    cat <<'EOF'
The whole enum:
  in-place — write into the current checkout, on the spec's branch
  worktree — create this TODO's own worktree first, at <task folder>/todo-N, off the spec's branch, and work there
  inherit  — TODO-N.md only: take the spec's value

Defaults: a missing key on spec.md reads as `in-place`, a missing key on a TODO-N.md
reads as `inherit`. Write an override's reason as a trailing comment on the key.
Owned by arch:ref-write.md § Where the work happens.
EOF
  )

  while IFS= read -r line; do
    value=${line#*:}
    value=${value%%\#*}
    value=${value%%—*}
    value=$(trim "$(tr -d '`"'"'" <<<"$value")")

    case "$value" in
      in-place | worktree) ;;
      inherit)
        if [[ "$BASE" == "spec.md" ]]; then
          block "$(printf '%s\n\n%s' \
            "spec.md cannot carry \`where: inherit\` — the spec is the level with nothing to inherit from, so impl would resolve it to no checkout at all. Pick in-place or worktree." \
            "$WHERE_ENUM")"
        fi
        ;;
      *)
        block "$(printf '%s\n\n%s' \
          "\`where: $value\` is not a checkout impl can enter, so this edit is refused. $BASE would name a workspace no branch of impl:sub-impl.md Step 3 matches, and the work would silently land in the wrong tree." \
          "$WHERE_ENUM")"
        ;;
    esac
  done < <(grep -E '^where:' <<<"$WHERE_TEXT" || true)
fi

exit 0

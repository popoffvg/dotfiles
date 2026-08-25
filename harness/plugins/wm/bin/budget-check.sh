#!/usr/bin/env bash
# PostToolUse (Edit|Write): hold a spec artifact to the budgets its skill states.
#
# Matches both files of a ledger row — `TODO-N.md`, `TODO-N.agent.md` — plus CONSTRAINTS.md
# and spec.md. budget-check.py tells them apart and applies each one's own budgets.
#
# Why PostToolUse and not guard.sh: an Edit call carries only its new_string, so the
# resulting line count cannot be known before the write. Here the file is on disk, so the
# count is the real one for both Edit and Write. The write has landed, so this reports
# rather than prevents - and the report is a block, which makes the split the next action.
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null) || exit 0

[[ -z "$FILE_PATH" ]] && exit 0
case "$FILE_PATH" in
  */todos/TODO-*.md | */spec.md | */CONSTRAINTS.md) ;;
  *) exit 0 ;;
esac
[[ -f "$FILE_PATH" ]] || exit 0

OVER=$(python3 "${CLAUDE_PLUGIN_ROOT}/bin/budget-check.py" "$FILE_PATH" 2>/dev/null) && RC=0 || RC=$?
# 0 = within budget (pass), 1 = over budget (report), 2 = unreadable (pass).
((RC == 1)) || exit 0

jq -n --arg reason "$(printf '%s\n\n%s' "$OVER" \
  "A budget is not a style preference - it is the size at which a second deliverable becomes visible. Take the remedy the message names: split the ledger row, split the increment, or move the section to the other half of the pair. Do not compress the prose, drop a test level, shift content between the halves to fit a line count, or raise a budget.")" \
  '{decision: "block", reason: $reason}'
exit 0

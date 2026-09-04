#!/usr/bin/env bash
# Remind the caller to run the verify naming pass, the moment a verify round ends.
#
# A round ends when `spec-verify.md` is written. Phase 2 of `code:sub-verify.md` runs
# after that write, so it is the one step with nothing behind it to force it - the report
# already reads finished. This hook fires there and nowhere else.
#
# PostToolUse hook on Edit|Write. Reads the tool payload on stdin, prints the reminder to
# stdout as additional context, and always exits 0 - a reminder never blocks a write.
set -uo pipefail

PAYLOAD=$(cat 2>/dev/null || true)
case "$PAYLOAD" in
  *spec-verify.md*) ;;
  *) exit 0 ;;
esac

NOTES=$(printf '%s' "$PAYLOAD" | sed -n 's|.*"\(/[^"]*\)/spec-verify\.md".*|\1|p' | head -1)
NOTES=${NOTES:-<notes-dir>}
ROOT=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}

cat <<EOF
⚠ verify round recorded — Phase 2, the naming pass, has not run yet
  1. $ROOT/bin/term-variants.py $NOTES/todos/*.md $NOTES/spec.md
  2. wm:name-critic over the Components symbols, New terms rows, and Surface signatures
     (code:sub-verify.md § Phase 2 — the naming pass)
  A rename costs one table edit now and every call site after impl.
EOF
exit 0

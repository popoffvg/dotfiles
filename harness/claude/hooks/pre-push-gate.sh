#!/bin/bash
# Block a git push or a git-spice submit until pre-push-check.sh passed for the HEAD it pushes.
command -v jq >/dev/null 2>&1 || exit 0
INPUT=$(cat)
CMD=$(jq -r '.tool_input.command // empty' <<<"$INPUT")
CWD=$(jq -r '.cwd // empty' <<<"$INPUT")

PUSH_RE='(^|[;&|(][[:space:]]*)(git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push|gs[[:space:]]+([a-z]+[[:space:]]+)?(submit|s|bs|ss|uss|dss))([[:space:]]|$)'
grep -qE "$PUSH_RE" <<<"$CMD" || exit 0

DIR=$CWD
CD_DIR=$(sed -nE 's/^[[:space:]]*cd[[:space:]]+([^;&|[:space:]]+).*/\1/p' <<<"$CMD")
[ -n "$CD_DIR" ] && DIR=$(cd "$CWD" 2>/dev/null && eval cd "$CD_DIR" 2>/dev/null && pwd)
C_DIR=$(sed -nE 's/.*git[[:space:]]+-C[[:space:]]+([^[:space:]]+)[[:space:]]+push.*/\1/p' <<<"$CMD")
[ -n "$C_DIR" ] && DIR=$(cd "${DIR:-$CWD}" 2>/dev/null && eval cd "$C_DIR" 2>/dev/null && pwd)

STAMP=$("$HOME/.claude/scripts/pre-push-check.sh" --repo "${DIR:-$CWD}" --print-stamp 2>/dev/null) || exit 0
[ -f "$STAMP" ] && exit 0

cat >&2 <<EOF
BLOCKED: no lint and reviewrules pass for the HEAD you push (no $STAMP).
Run in the background, in the repo you push from:
  ~/.claude/scripts/pre-push-check.sh --base <PR base, for example origin/main or the git-spice base branch>
It runs the repo linter and reviewrules over <base>..HEAD. Fix every lint finding and every reviewrules FAIL, verify each WARN line, then push again.
Pass --lint '<cmd>' when the script finds no linter. Pass --skip-review '<reason>' only when the user said to skip the review.
EOF
exit 2

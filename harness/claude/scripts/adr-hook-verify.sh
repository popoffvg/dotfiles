#!/usr/bin/env bash
# Verify an installed adr-session-end hook behaves as documented, without touching
# the repo it is installed in.
#
# Builds a throwaway git fixture holding a COPY of the hook under test plus a
# synthetic transcript containing decision-shaped language, then exercises the three
# documented states:
#
#   1. no marker file            -> silent   (off by default)
#   2. .claude/adr-reminder.on   -> reminder on stderr
#   3. marker + ADR_REMINDER=off -> silent   (env overrides the marker)
#
# The fixture commits docs/adr/ so a dirty-worktree ADR does not mask the reminder.
#
# Usage: adr-hook-verify.sh <repo-with-.claude/hooks/adr-session-end.sh>
set -euo pipefail

repo="${1:-$PWD}"
hook="$repo/.claude/hooks/adr-session-end.sh"

if [ ! -x "$hook" ]; then
  printf 'not an executable hook: %s\n' "$hook" >&2
  exit 1
fi

fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT

mkdir -p "$fixture/.claude/hooks" "$fixture/docs/adr"
cp "$hook" "$fixture/.claude/hooks/adr-session-end.sh"
printf '# TEMPLATE\n' >"$fixture/docs/adr/TEMPLATE.md"
printf 'we decided to use ratatui instead of cursive, the trade-off is lock-in\n' \
  >"$fixture/transcript.jsonl"

git -C "$fixture" init -q -b main
git -C "$fixture" add -A
git -C "$fixture" -c user.email=verify@local -c user.name=verify \
  -c commit.gpgsign=false commit -qm init

payload="$(printf '{"cwd":"%s","transcript_path":"%s/transcript.jsonl"}' \
  "$fixture" "$fixture")"

# Run the fixture's hook copy and report what reached stderr.
# $1 = case label, $2 = expectation (silent|reminder), rest = env assignments
probe() {
  local label="$1" expect="$2" err rc=0
  shift 2
  err="$(env "$@" "$fixture/.claude/hooks/adr-session-end.sh" \
    <<<"$payload" 2>&1 >/dev/null)" || rc=$?

  local got=silent
  [ -n "$err" ] && got=reminder

  if [ "$got" = "$expect" ] && [ "$rc" -eq 0 ]; then
    printf 'PASS  %-28s %s\n' "$label" "$got"
    [ "$got" = reminder ] && printf '%s\n' "$err" | sed 's/^/        > /'
  else
    printf 'FAIL  %-28s got %s (exit %d), wanted %s\n' "$label" "$got" "$rc" "$expect"
    [ -n "$err" ] && printf '%s\n' "$err" | sed 's/^/        | /'
    return 1
  fi
}

status=0
probe 'no marker' silent -u ADR_REMINDER || status=1

touch "$fixture/.claude/adr-reminder.on"
probe 'marker present' reminder -u ADR_REMINDER || status=1
probe 'marker + ADR_REMINDER=off' silent ADR_REMINDER=off || status=1

printf '\nhook verified: %s\n' "$hook"
exit "$status"

#!/usr/bin/env bash
# SessionEnd hook: at the end of a session that made an architecture decision and
# recorded no ADR, remind the operator to run the `adr` skill.
#
# SessionEnd cannot block and its stdout reaches nobody — only stderr is shown to
# the user (https://code.claude.com/docs/en/hooks). So this hook writes to stderr
# and returns 0.
#
# Install: copy to <repo>/.claude/hooks/adr-session-end.sh and register in
# .claude/settings.json under hooks.SessionEnd.
#
# Off by default. Turn it on for one repo:  touch .claude/adr-reminder.on
# Turn it on for one run:                    ADR_REMINDER=on
# ADR_REMINDER=off overrides the marker file.
set -euo pipefail

payload="$(cat)"

field() {
  printf '%s' "$payload" | python3 -c '
import json,sys
try:
    print(json.load(sys.stdin).get(sys.argv[1], "") or "")
except Exception:
    print("")
' "$1"
}

[ "${ADR_REMINDER:-}" = "off" ] && exit 0

cwd="$(field cwd)"
[ -n "$cwd" ] || cwd="$PWD"
repo="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$cwd")"

# Off by default: the repo opts in with a marker file, one run opts in with the
# env var. A repo that installed the hook but never asked for it stays quiet.
[ -e "$repo/.claude/adr-reminder.on" ] || [ "${ADR_REMINDER:-}" = "on" ] || exit 0

# An ADR already written or edited in this working tree answers the reminder.
if git -C "$repo" status --porcelain -- 'docs/adr' 'docs/!archived/adr' 2>/dev/null | grep -q .; then
  exit 0
fi

transcript="$(field transcript_path)"
[ -f "$transcript" ] || exit 0

# Decision-shaped language. Deliberately narrow — a false positive trains the
# operator to ignore the reminder.
decision_re='(instead of|rather than|switch(ing)? to|migrat(e|ing) to|replac(e|ing) [^"]{1,40} with |lock[- ]?in|trade[- ]?off|we (should|will|are going to) (use|adopt|drop|standardi[sz]e)|(decide|decision|decided) (on|to|between)|architect(ure|ural) (choice|decision)|supersed)'
hits="$(grep -Eic "$decision_re" "$transcript" || true)"
[ "${hits:-0}" -gt 0 ] || exit 0

next=0001
highest="$(
  ls "$repo/docs/adr" "$repo/docs/!archived/adr" 2>/dev/null |
    grep -Eo '^[0-9]{4}' | sort -n | tail -1
)"
[ -n "$highest" ] && next="$(printf '%04d' $((10#$highest + 1)))"

cat >&2 <<EOF
ADR reminder: this session discussed an architecture decision (matched $hits
transcript lines) and no ADR was written or edited. If the choice is hard to reverse,
surprising without context, and the result of a real trade-off, run the \`adr\`
skill — it reads the session transcript and drafts $next in docs/adr/.

Transcript: $transcript
Turn this off for the repo: rm .claude/adr-reminder.on
EOF
exit 0

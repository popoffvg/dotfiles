#!/usr/bin/env bash
# Run one triage pass in a detached `claude -p` and stay quiet unless it catches
# something. The calling session never blocks, spends no turn and pays no
# tokens for the pass: the model call happens in this separate haiku process.
#
# Recursion guard: this child session fires its own Stop hook, which would
# launch another child forever. SELF_IMPROVE_TRIAGE is exported here and the
# Stop hook exits on seeing it.
#
# The lock is a directory, not a file, because mkdir is atomic on every
# filesystem. Stop fires far faster than a triage pass finishes, so without it
# the passes pile up on one transcript.
#
# Only `CATCHED` reaches the user, as a desktop notification. `SKIP` — the
# common case — leaves no trace at all.
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
plugin_root=$(cd "$script_dir/.." && pwd)
state_dir=${SELF_IMPROVE_STATE_DIR:-$HOME/.claude/self-improvement/state}

if [ $# -ne 2 ]; then
  printf 'usage: %s <transcript.jsonl> <since-line>\n' "$(basename "$0")" >&2
  exit 2
fi

transcript=$1
since=$2
key=$(basename "$transcript" .jsonl)

mkdir -p "$state_dir"
lock="$state_dir/$key.triage.lock"
mkdir "$lock" 2>/dev/null || exit 0
trap 'rmdir "$lock" 2>/dev/null || true' EXIT

read -r -d '' prompt <<EOF || true
Follow the procedure in $plugin_root/skills/capture-lesson/references/triage.md.

plugin root: $plugin_root
transcript: $transcript
since-line: $since

Return SKIP or CATCHED <archived-transcript-path> and nothing else.
EOF

export SELF_IMPROVE_TRIAGE=1

verdict=$(claude -p "$prompt" \
  --model haiku \
  --allowedTools Bash Read \
  --permission-mode acceptEdits \
  2>/dev/null | tr -d '\r' | tail -n 1) || exit 0

case "$verdict" in
  CATCHED*)
    archive=${verdict#CATCHED }
    topic=$(sed -n 's/^- \*\*Topic:\*\* *//p' "$archive.env.md" 2>/dev/null | head -n 1)
    [ -n "$topic" ] || topic=$(basename "$archive")
    scope=$(basename "$(dirname "$archive")")
    osascript -e "display notification \"$topic\" with title \"Lesson caught ($scope)\"" \
      >/dev/null 2>&1 || true
    ;;
esac

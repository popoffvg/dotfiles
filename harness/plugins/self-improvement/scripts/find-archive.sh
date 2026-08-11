#!/usr/bin/env bash
# Print the archived copy of a session, or exit 1 when the session has none.
#
# This is the "already marked interesting" test the Stop hook branches on: a
# session with a copy in the archive is re-synced with no model call, a session
# without one is classified first.
#
# The session id is the transcript's basename, and it is the tail of every
# archived filename (`<date>-<slug>-<session-id>.jsonl`), so the id survives the
# date and slug prefix. Scoped copies sit one level down (lessons/global,
# lessons/project); archives written before scopes existed sit flat in lessons/.
# Both count as archived — depth 2 covers them together.
set -euo pipefail

archive_dir=${SELF_IMPROVE_LESSONS_DIR:-$HOME/.claude/self-improvement/lessons}

if [ $# -ne 1 ]; then
  printf 'usage: %s <transcript.jsonl>\n' "$(basename "$0")" >&2
  exit 2
fi

key=$(basename "$1" .jsonl)

found=$(find "$archive_dir" -maxdepth 2 -type f -name "*$key.jsonl" 2>/dev/null | sort | head -1)

[ -n "$found" ] || exit 1
printf '%s\n' "$found"

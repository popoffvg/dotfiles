#!/usr/bin/env bash
# Append one result to the inbox. `inbox-add.sh <kind> <session-id> <headline> [path]`
#
# The plugin's whole announcement path. A scan runs detached, minutes or hours
# after the session that produced the lesson, so there is no session to speak
# into at the moment the result exists — the result waits on disk until the next
# SessionStart hook reads it out (inbox-read.sh).
#
# Append-only, one line, and short on purpose: a lone write to an O_APPEND fd
# under PIPE_BUF is atomic, which is what lets a detached scan append while a
# starting session reads without either taking a lock.
#
# The caller is a scan pass whose real work is already committed to disk when it
# gets here, so this never fails the caller: the record and the suggestion
# document stand on their own, and a lost inbox line costs an announcement.
set -euo pipefail

# shellcheck source=lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

kind=${1:-}
session=${2:-}
headline=${3:-}
path=${4:-}

[ -n "$kind" ] || exit 0

mkdir -p "$(dirname "$inbox_path")" 2>/dev/null || exit 0

jq -c -n --arg at "$(date -u +%FT%TZ)" --arg kind "$kind" --arg session "$session" \
  --arg headline "$headline" --arg path "$path" \
  '{at: $at, kind: $kind, session: $session, headline: $headline, path: $path}' \
  >> "$inbox_path" 2>/dev/null || true
exit 0

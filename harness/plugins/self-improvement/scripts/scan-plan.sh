#!/usr/bin/env bash
# Join the two lists and print what the scan should do. Decides only — spends no
# model call, writes no record, so it is safe to run any time to see the queue
# (the TUI reads exactly this).
#
#   <action>  <session-id>  <transcript-or-->  <from-line>  <why>
#
# The four branches, one per state of the join:
#
#   live, no record        score … 0        new     never judged; read it whole
#   live, record, grown    score … <mark>   grown   read only the lines past the
#                                                   watermark, not the session
#   live, record, same     -                fresh   nothing typed since the last
#                                                   pass; never opened
#   record, no live,       reap             gone    Claude Code dropped the
#   never archived                                  transcript; that record was
#                                                   derived state and follows it
#   record, no live,       -                archived the transcript was copied out
#   archived                                        when it scored, so the record
#                                                   is kept and stays suggestable
#
# A fifth row exists that is not a branch of the join: `wait`, a session written
# to within the idle window. It is still being typed into, so judging it now
# would spend a call on half a thought. The next scan takes it.
#
# `grown` is a byte comparison, not a line one: the transcript is append-only, so
# a size equal to the one the last pass recorded proves nothing was added and the
# file is never opened. That is what keeps a scan over 1000+ sessions cheap.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

live=$(mktemp)
rec=$(mktemp)
trap 'rm -f "$live" "$rec"' EXIT

"$scripts_dir/sessions-list.sh" > "$live"
"$scripts_dir/records-list.sh" > "$rec"

# Left side: every live session, newest first (sessions-list.sh already sorts).
#
# The side a line came from is decided by FILENAME, not by the usual
# `NR == FNR`: on a machine with no records yet the first file is empty, and
# then NR == FNR is true for every line of the *second* file — every live
# session would be read as a record and the plan would come out blank.
awk -F'\t' -v OFS='\t' -v idle_limit="$min_idle_seconds" -v recfile="$rec" '
  FILENAME == recfile { mark[$1] = $3; seen[$1] = $4; next }
  {
    id = $1; path = $2; bytes = $3; idle = $4
    if (!(id in mark))            { action = "score"; from = 0;        why = "new" }
    else if (bytes + 0 > seen[id] + 0) { action = "score"; from = mark[id]; why = "grown" }
    else                          { action = "-";     from = mark[id]; why = "fresh" }
    if (action == "score" && idle + 0 < idle_limit) { action = "wait" }
    print action, id, path, from, why
  }
' "$rec" "$live"

# Right side: a record whose session Claude Code no longer has.
#
# Reaping is conditional on there being no archive. A record with one is not
# derived state: the archived transcript outlives ~/.claude/projects, the record
# is the index into it, and a kept session still needs its suggestion pass —
# deleting the record here would strand evidence that was copied out precisely so
# it would survive. Those rows come back as `archived`, and stay visible.
awk -F'\t' -v OFS='\t' -v livefile="$live" '
  FILENAME == livefile { live[$1] = 1; next }
  !($1 in live) {
    mark = ($3 == "" ? 0 : $3)
    if ($8 == "") print "reap", $1, "-", mark, "gone"
    else          print "-", $1, $8, mark, "archived"
  }
' "$live" "$rec"

#!/usr/bin/env bash
# One scan pass: read the plan, reap what is gone, score what is dirty, exit.
#
#   scan.sh                score up to SELF_IMPROVE_SCAN_MAX sessions (default 5),
#                          then suggest on up to SELF_IMPROVE_SUGGEST_MAX kept
#                          ones (default 2)
#   scan.sh --all          no budget on either stage — the catch-up run
#   scan.sh --no-suggest   score only
#   scan.sh --dry-run      print the plan and change nothing
#
# This script *is* the daemon. It holds nothing in memory, is safe to kill at any
# point, and resumes from the records on the next call — which is what lets a
# SessionStart hook be the whole scheduler. Nothing here needs to run at a
# particular time; it only needs to run eventually.
#
# The budget counts model calls, not sessions: a session whose new bytes turned
# out to be tool traffic (score-session.sh exit 3) is handled for free and does
# not spend from it. Sessions arrive newest-first, so a budget costs latency on
# the backlog, never coverage.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

dry_run=false
budget=$scan_max
suggest_budget=$suggest_max
for arg in "$@"; do
  case "$arg" in
    --all)          budget=1000000; suggest_budget=1000000 ;;
    --no-suggest)   suggest_budget=0 ;;
    --dry-run)      dry_run=true ;;
    *) printf 'unknown flag: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

if $dry_run; then
  exec "$scripts_dir/scan-plan.sh"
fi

# A directory is the lock because mkdir is atomic on every filesystem, and the
# pid inside it is what makes the lock recoverable: a scan killed mid-pass would
# otherwise leave a lock no later scan could ever take.
mkdir -p "$self_improve_root"
lock="$self_improve_root/scan.lock"
if ! mkdir "$lock" 2>/dev/null; then
  holder=$(cat "$lock/pid" 2>/dev/null || printf '')
  if [ -n "$holder" ] && kill -0 "$holder" 2>/dev/null; then
    log "scan: already running (pid $holder)"
    exit 0
  fi
  log "scan: taking over stale lock (pid ${holder:-unknown})"
  rm -rf "$lock"
  mkdir "$lock" 2>/dev/null || exit 0
fi
printf '%s' "$$" > "$lock/pid"
trap 'rm -rf "$lock"' EXIT

plan=$(mktemp)
trap 'rm -rf "$lock"; rm -f "$plan"' EXIT
"$scripts_dir/scan-plan.sh" > "$plan"

reaped=0
scored=0
quiet=0
examined=0

# Reap first, and without a budget: dropping a record whose session is gone is a
# file deletion, and leaving them in place would let the records outnumber the
# sessions they describe.
while IFS=$'\t' read -r action id _path _from _why; do
  [ "$action" = reap ] || continue
  rm -f "$(record_path "$id")"
  reaped=$((reaped + 1))
done < "$plan"

while IFS=$'\t' read -r action id path from _why; do
  [ "$action" = score ] || continue
  [ "$scored" -lt "$budget" ] || break
  [ "$examined" -lt "$candidate_max" ] || break
  examined=$((examined + 1))

  rc=0
  "$scripts_dir/score-session.sh" "$id" "$path" "$from" || rc=$?
  case "$rc" in
    0) scored=$((scored + 1)) ;;
    3) quiet=$((quiet + 1)) ;;
    *) log "scan: score-session failed for $id (rc=$rc)" ;;
  esac
done < "$plan"

# Second stage: for sessions that scored high enough to keep, say what to do
# about them. Its own budget, and deliberately after all the scoring — a scan
# that runs out of time has still advanced every watermark, and a suggestion is
# worth the same tomorrow as today.
#
# Candidates are records, not plan rows: a session kept by an earlier scan and
# never suggested on is still a candidate, so a `--all` catch-up leaves nothing
# permanently unsuggested.
suggested=0
if [ "$suggest_budget" -gt 0 ]; then
  while IFS=$'\t' read -r id score verdict; do
    [ "$suggested" -lt "$suggest_budget" ] || break
    [ "$score" -ge "$keep_score" ] || continue
    [ -z "$verdict" ] || continue
    "$scripts_dir/suggest-session.sh" "$id" >/dev/null 2>&1 || log "scan: suggest failed for $id"
    suggested=$((suggested + 1))
  done < <("$scripts_dir/records-list.sh" \
    | awk -F'\t' -v OFS='\t' '{print $1, $5, $7}' \
    | sort -t"$(printf '\t')" -k2,2nr)
fi

pending=$(awk -F'\t' '$1 == "score"' "$plan" | wc -l | tr -d ' ')
log "scan: scored=$scored quiet=$quiet reaped=$reaped suggested=$suggested pending=$((pending - examined))"

#!/usr/bin/env bash
# Shared paths and helpers for the self-improvement scan. Sourced, never run.
#
# Four directories, all under one root so a machine's whole scoring state moves
# or resets as a unit:
#   sessions/  one JSON record per session — the watermark and the score.
#   lessons/   full transcript copies, written only for sessions that scored at
#              or above the keep threshold. This is what /dream harvests.
#   suggestions/ one markdown proposal per kept session: where that lesson would
#              land in the harness as it exists today. Suggestions only — no pass
#              in this plugin edits a skill or a doc.
#   log/       scan.log, appended by every pass.
#   state/     dead: `<id>.checked-line` files from the Stop-hook era. Nothing
#              reads them. They are not seeded into the new records on purpose —
#              they recorded "these prompts were classified for scope", and a
#              score is a different judgment, so those sessions are worth one
#              fresh pass. Kept only so no history is deleted behind the user.
# Every path is env-overridable so the eval harness can point the whole thing at
# a temp dir.
#
# shellcheck disable=SC2034  # every variable here is read by a sourcing script

self_improve_root=${SELF_IMPROVE_ROOT:-$HOME/.claude/self-improvement}
records_dir=${SELF_IMPROVE_RECORDS_DIR:-$self_improve_root/sessions}
lessons_dir=${SELF_IMPROVE_LESSONS_DIR:-$self_improve_root/lessons}
suggestions_dir=${SELF_IMPROVE_SUGGESTIONS_DIR:-$self_improve_root/suggestions}
log_dir=${SELF_IMPROVE_LOG_DIR:-$self_improve_root/log}
projects_dir=${SELF_IMPROVE_PROJECTS_DIR:-$HOME/.claude/projects}

# A session is scored once it has been quiet this long, so a pass never spends a
# model call on a transcript the user is still typing into.
min_idle_seconds=${SELF_IMPROVE_MIN_IDLE:-300}
# Model calls per scan. The first scan on a fresh machine faces every session
# ever recorded (1000+ here); without a cap it would spend hundreds of calls in
# one go. Newest-first ordering means the cap costs latency, never coverage.
scan_max=${SELF_IMPROVE_SCAN_MAX:-5}
# Candidates that get a jq pass to see whether the new bytes hold a human
# prompt. Cheap next to a model call, not free — bounded too.
candidate_max=${SELF_IMPROVE_CANDIDATE_MAX:-40}
# Score at or above which the transcript is copied into lessons/ for /dream, and
# a harness suggestion is written.
keep_score=${SELF_IMPROVE_KEEP_SCORE:-6}
# Suggestion passes per scan. Its own budget, well under the scoring one: a
# suggestion reads the whole harness inventory and runs on the stronger model, so
# it costs several scoring passes and only ever applies to a kept session.
suggest_max=${SELF_IMPROVE_SUGGEST_MAX:-2}
# The suggestion pass judges a lesson against 90+ existing triggers and drafts the
# change. Scoring is high-volume and mechanical; this is low-volume and the part
# whose quality the user actually reads.
suggest_model=${SELF_IMPROVE_SUGGEST_MODEL:-sonnet}

plugin_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
scripts_dir="$plugin_root/scripts"

log() {
  mkdir -p "$log_dir"
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >> "$log_dir/scan.log"
}

record_path() { printf '%s/%s.json\n' "$records_dir" "$1"; }

suggestion_path() { printf '%s/%s.md\n' "$suggestions_dir" "$1"; }

# Filter: human-turns.sh output → the model-facing form. Drops the
# `--- line N <timestamp>` headers the script writes for human readers, leaving
# the typed text and a bare `---` between prompts.
#
# Every pass that hands session content to a model pipes through this, so "the
# model sees only what the user typed" is one filter in one place rather than a
# rule each caller has to remember. Callers that need the line numbers read them
# from the unfiltered output first — the watermark does.
strip_reader_marks() { sed 's/^--- line [0-9]* .*$/---/'; }

# Read one field of a record, printing the fallback when the record or the field
# is missing — so callers never branch on existence themselves.
record_get() {
  local id=$1 field=$2 fallback=${3:-}
  jq -r --arg fb "$fallback" ".$field // \$fb" "$(record_path "$id")" 2>/dev/null \
    || printf '%s\n' "$fallback"
}

# Replace a record atomically. The TUI reads these files while scans write them;
# a partial write would show up there as a parse error.
record_write() {
  local id=$1 json=$2 dest
  dest=$(record_path "$id")
  mkdir -p "$records_dir"
  printf '%s\n' "$json" > "$dest.tmp.$$"
  mv "$dest.tmp.$$" "$dest"
}

# Bytes of a file, 0 when it is gone. `wc -c` pads on macOS.
bytes_of() { wc -c < "$1" 2>/dev/null | tr -d ' ' || printf '0'; }

# Seconds since a file was last written. Both stat dialects, because this runs
# on macOS today and Linux the day the repo is stowed there.
idle_seconds() {
  local mtime now
  mtime=$(stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || printf '0')
  now=$(date +%s)
  printf '%s\n' "$((now - mtime))"
}

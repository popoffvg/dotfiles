#!/usr/bin/env bash
# Print the statusline segment for the lesson store: `lessons: <pending>/<total>`.
#
# One lesson is one kept transcript — the `.jsonl` copy. The `.env.md` beside it
# is that lesson's environment note, not a second lesson, so only the
# transcripts are counted.
#
# Two numbers, because only one of them is work. `pending` counts the scoped
# copies (`lessons/global`, `lessons/project`, and the flat pre-scope archives) —
# the transcripts /dream still has to harvest. `total` adds `lessons/harvested`,
# the ones already turned into a skill. A single total would keep climbing while
# the backlog was being cleared, which is the opposite of what the user reads a
# statusline for.
#
# Silent when the store is empty or missing: a segment that says nothing beats
# one that says zero on a fresh machine.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ -d "$lessons_dir" ] || exit 0

count_lessons() {
  find "$lessons_dir" -maxdepth 2 -type f -name '*.jsonl' "$@" 2>/dev/null \
    | wc -l | tr -d ' '
}

total=$(count_lessons)
[ "$total" -gt 0 ] 2>/dev/null || exit 0

pending=$(count_lessons -not -path "$lessons_dir/harvested/*")

printf 'lessons: %s/%s\n' "$pending" "$total"

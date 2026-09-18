#!/usr/bin/env bash
# Write the clustering input for the pending lessons and print its path.
#
#   <session-id> | <score> | <scope> | <verdict> | <lesson headline> | <target>
#
# One line per pending lesson, small enough that a whole batch fits in one
# subagent prompt. The headline and the target come from the suggestion the scan
# already wrote — the lesson in one sentence, judged against the harness — so a
# clustering pass never has to open 80 transcripts. A lesson with no suggestion
# yet falls back to its session title, marked `(no suggestion pass)` so the
# reader can weigh it lower.
#
# Usage: lessons-dump.sh [dest]   (default: a temp file)
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

dest=${1:-$(mktemp -t lessons-dump)}
scripts=$(dirname "${BASH_SOURCE[0]}")

: > "$dest"
while IFS=$'\t' read -r score _status _scope date title id verdict; do
  file="$suggestions_dir/$id.md"
  if [ -f "$file" ]; then
    headline=$(grep -m1 '^# ' "$file" | sed 's/^# //')
    target=$(grep -m1 '^- \*\*Target:\*\*' "$file" \
      | sed -e 's/^- \*\*Target:\*\* *//' -e "s|$HOME|~|" -e 's/`//g')
  else
    headline="(no suggestion pass) $title"
    target="-"
  fi
  printf '%s | %s | %s | %s | %s | %s\n' \
    "$id" "$score" "${date:-?}" "$verdict" "$headline" "$target" >> "$dest"
done < <("$scripts/lessons-list.sh" --pending --tsv)

printf '%s\n' "$dest"

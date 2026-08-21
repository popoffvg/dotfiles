#!/usr/bin/env bash
# List every live session Claude Code has on disk, newest first.
#
#   <session-id>  <transcript-path>  <bytes>  <idle-seconds>
#
# The claude side of the scan's join. `bytes` is what makes the join cheap: a
# transcript is append-only, so a size equal to the one the last pass recorded
# means nothing new to judge and the file never has to be opened.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ -d "$projects_dir" ] || exit 0

# One stat per file rather than a `find -printf` (absent on BSD find), then sort
# on mtime so the newest session is the first candidate a capped scan takes.
find "$projects_dir" -type f -name '*.jsonl' 2>/dev/null | while read -r path; do
  mtime=$(stat -f %m "$path" 2>/dev/null || stat -c %Y "$path" 2>/dev/null || printf '0')
  printf '%s\t%s\t%s\t%s\n' "$mtime" "$(basename "$path" .jsonl)" "$path" "$(bytes_of "$path")"
done \
  | sort -rn \
  | while IFS=$'\t' read -r mtime id path bytes; do
      printf '%s\t%s\t%s\t%s\n' "$id" "$path" "$bytes" "$(( $(date +%s) - mtime ))"
    done

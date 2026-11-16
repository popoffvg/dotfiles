#!/usr/bin/env bash
# Show `git log -L <start>,<end>:<file>` for the lines under the cursor or selection,
# stripped of diff metadata, in a Zed tab that shows a loading line until git log ends.
# Called from the Zed task "git: line history"; reads ZED_FILE / ZED_ROW / ZED_SELECTED_TEXT.
set -uo pipefail

file_path=${1:-${ZED_FILE:-}}
start_line=${2:-${ZED_ROW:-1}}

if [[ -n ${3:-} ]]; then
  end_line=$3
elif [[ -n ${ZED_SELECTED_TEXT:-} ]]; then
  selected_lines=$(printf '%s\n' "$ZED_SELECTED_TEXT" | wc -l | tr -d ' ')
  end_line=$((start_line + selected_lines - 1))
else
  end_line=$start_line
fi

if [[ -z $file_path || ! -f $file_path ]]; then
  echo "git-line-history: no such file: ${file_path:-<unset>}" >&2
  exit 1
fi

cd "$(dirname "$file_path")" || exit 1
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "git-line-history: $file_path is not inside a git repository" >&2
  exit 1
fi

raw_log=$(mktemp -t git-line-history.raw)
history_diff=$(mktemp -t git-line-history).diff
history_draft=$history_diff.draft
trap 'rm -f "$raw_log" "$history_draft"' EXIT

# Zed reloads an open, unedited buffer when its file changes on disk.
show_in_tab() {
  printf '%s\n' "$@" >"$history_draft"
  mv -f "$history_draft" "$history_diff"
}

show_in_tab "Loading line history of ${file_path}:${start_line}-${end_line} ..."
"$HOME/.claude/scripts/open-file.sh" "$history_diff" >/dev/null

if ! git log --date=format:'%Y-%m-%d %H:%M:%S' \
  -L "${start_line},${end_line}:${file_path}" >"$raw_log" 2>&1; then
  show_in_tab "git-line-history: git log failed" "" "$(cat "$raw_log")"
  cat "$raw_log" >&2
  exit 1
fi

awk '
  /^commit / {
    if (seen) print "\n--------------------------------------------------\n"
    seen = 1
    print
    next
  }
  /^diff --git|^index |^--- a\/|^\+\+\+ b\/|^@@ .* @@/ { next }
  seen { print }
' "$raw_log" >"$history_draft"

if [[ ! -s $history_draft ]]; then
  show_in_tab "git-line-history: no commits touch ${file_path}:${start_line}-${end_line}"
  exit 0
fi
mv -f "$history_draft" "$history_diff"

find "$(dirname "$(mktemp -u)")" -maxdepth 1 -name 'git-line-history.*' \
  -not -name "$(basename "$history_diff")" -mtime +1 -delete 2>/dev/null
exit 0

#!/usr/bin/env bash
# Show `git log -L <start>,<end>:<file>` for the lines under the cursor or selection,
# stripped of diff metadata, and open it in Zed with diff highlighting.
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
trap 'rm -f "$raw_log"' EXIT

if ! git log --date=format:'%Y-%m-%d %H:%M:%S' \
  -L "${start_line},${end_line}:${file_path}" >"$raw_log" 2>&1; then
  echo "git-line-history: git log failed" >&2
  cat "$raw_log" >&2
  rm -f "$history_diff"
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
' "$raw_log" >"$history_diff"

if [[ ! -s $history_diff ]]; then
  echo "git-line-history: no commits touch ${file_path}:${start_line}-${end_line}"
  rm -f "$history_diff"
  exit 0
fi

find "$(dirname "$(mktemp -u)")" -maxdepth 1 -name 'git-line-history.*' \
  -not -name "$(basename "$history_diff")" -mtime +1 -delete 2>/dev/null

exec "$HOME/.claude/scripts/open-file.sh" "$history_diff"

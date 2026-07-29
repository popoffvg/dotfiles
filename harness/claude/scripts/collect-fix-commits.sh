#!/usr/bin/env bash
# Collect bug-fix-looking commits from every git repo under a root directory.
# Usage: collect-fix-commits.sh <root-dir> <since-date> [out-dir]
# Writes <out-dir>/<repo>.log per repo (only if it has matching commits) and prints a summary.
set -uo pipefail

ROOT="${1:?root dir required}"
SINCE="${2:?since date required, e.g. 2026-01-27}"
OUT="${3:-$PWD/fix-commits}"

mkdir -p "$OUT"

for repo in "$ROOT"/*/; do
  name="$(basename "$repo")"
  [ -d "$repo/.git" ] || continue
  log="$(git -C "$repo" log --since="$SINCE" --no-merges \
        --pretty=format:'%h|%ad|%s%n%w(0,4,4)%b' --date=short 2>/dev/null \
        | grep -iE '^[0-9a-f]{7,}\|.*(fix|bug|broken|crash|error|fail|regress|hotfix|patch|incorrect|wrong|missing|revert|workaround)' )"
  if [ -n "$log" ]; then
    printf '%s\n' "$log" > "$OUT/$name.log"
    printf '%-50s %s\n' "$name" "$(printf '%s\n' "$log" | wc -l | tr -d ' ')"
  fi
done

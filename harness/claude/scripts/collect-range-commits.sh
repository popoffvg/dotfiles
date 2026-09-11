#!/usr/bin/env bash
# Collect commits in the old..new range recorded by repos-update.sh, per repo.
# Usage: collect-range-commits.sh <root-dir> <update.tsv> <out-dir>
# Writes <out-dir>/<repo>.log for every UPDATED repo, plus a manifest.
set -uo pipefail

ROOT="${1:?root dir required}"
UPD="${2:?update.tsv required}"
OUT="${3:?out dir required}"
mkdir -p "$OUT"

: > "$OUT/_manifest.txt"
while IFS=$'\t' read -r repo status old new n; do
  [ "$status" = UPDATED ] || continue
  d="$ROOT/$repo"
  [ -d "$d/.git" ] || continue
  git -C "$d" log --no-merges --reverse \
      --pretty=format:'%h|%ad|%an|%s%n%w(0,4,4)%b' --date=short "$old..$new" \
      > "$OUT/$repo.log" 2>/dev/null
  printf '%s\t%s\t%s..%s\n' "$repo" "$n" "$old" "$new" >> "$OUT/_manifest.txt"
done < <(tail -n +2 "$UPD")

wc -l "$OUT"/*.log | tail -1

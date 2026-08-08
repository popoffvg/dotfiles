#!/usr/bin/env bash
# qmd-collection-size-bench.sh — what does a narrower qmd collection cost to update?
#
# Indexes ONE directory as a throwaway collection and times `qmd update` on it,
# so you can compare against the full-vault collection before changing shared config.
#
# Read-only with respect to the indexed directory. Adds a temporary collection to
# the qmd index and removes it on exit (including on failure).
#
# Usage:  qmd-collection-size-bench.sh <dir-to-index> [collection-name]

set -uo pipefail

DIR="${1:?usage: $0 <dir-to-index> [collection-name]}"
COLL="${2:-qmdsizeprobe}"

cleanup() {
  echo "--- cleanup ---"
  qmd collection remove "$COLL" >/dev/null 2>&1 && echo "removed collection $COLL"
}
trap cleanup EXIT

# strip carriage-return progress spam, keep the summary lines
summary() { tr '\r' '\n' | grep -E "Indexed:|Cleaned|✓" || true; }

echo "dir:   $DIR"
echo "files: $(find "$DIR" -name '*.md' | wc -l) md, $(du -sh "$DIR" | cut -f1)"
echo

echo "=== initial index ==="
{ time qmd collection add "$DIR" --name "$COLL" --mask '**/*.md' 2>&1 | summary ; } 2>&1

echo
echo "=== qmd update, nothing changed (run 1) ==="
{ time qmd update 2>&1 | summary ; } 2>&1

echo
echo "=== qmd update, nothing changed (run 2) ==="
{ time qmd update 2>&1 | summary ; } 2>&1

echo
echo "=== search latency on this collection ==="
for q in "sparse index" "tombstone"; do
  t0=$(date +%s%N)
  n=$(qmd search "$q" -c "$COLL" --files -n 5 2>/dev/null | grep -c . || true)
  echo "  \"$q\": $(( ($(date +%s%N) - t0) / 1000000 ))ms, $n hits"
done

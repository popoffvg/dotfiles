#!/usr/bin/env bash
# qmd-vs-rg-bench.sh — compare qmd BM25 search against ripgrep for vault term lookup.
#
# Answers: for "does a note for term X already exist, and what are the near-matches?",
# how do the two compare on latency and on what they return?
#
# Read-only. Touches no index and writes nothing.
#
# Usage:  qmd-vs-rg-bench.sh <notes-dir> [collection] [term ...]
#         ssh host 'bash -s' < qmd-vs-rg-bench.sh -- <notes-dir> [collection] [term...]

set -uo pipefail

NOTES="${1:?usage: $0 <notes-dir> [collection] [term...]}"
COLL="${2:-z-core}"
shift 2 2>/dev/null || shift 1
TERMS=("$@")
[ ${#TERMS[@]} -eq 0 ] && TERMS=("sparse index" "write amplification" "skip list" "tombstone" "raft")

ms_since() { echo "$((($(date +%s%N) - $1) / 1000000))ms"; }

echo "notes-dir: $NOTES  ($(find "$NOTES" -name '*.md' | wc -l) md files, $(du -sh "$NOTES" | cut -f1))"
echo "collection: $COLL"
echo

for term in "${TERMS[@]}"; do
  echo "########## \"$term\" ##########"

  t0=$(date +%s%N)
  qout=$(qmd search "$term" -c "$COLL" --files -n 5 2>/dev/null)
  qt=$(ms_since "$t0")
  qn=$(printf '%s' "$qout" | grep -c . || true)

  # rg: does a 20-notes note declare this as its title or an alias?
  # Frontmatter lines look like:  title: Sparse index   /   aliases: ["LSM", ...]
  t0=$(date +%s%N)
  rout=$(rg -i --no-heading -l -e "^title:.*${term}" -e "^aliases:.*${term}" "$NOTES" 2>/dev/null)
  rt=$(ms_since "$t0")
  rn=$(printf '%s' "$rout" | grep -c . || true)

  # rg: full-text mention anywhere in the notes dir (the broad net)
  t0=$(date +%s%N)
  fn=$(rg -i -l "$term" "$NOTES" 2>/dev/null | grep -c . || true)
  ft=$(ms_since "$t0")

  printf '  qmd search      %6s  %2s hits\n' "$qt" "$qn"
  printf '  rg title/alias  %6s  %2s hits\n' "$rt" "$rn"
  printf '  rg full-text    %6s  %2s hits\n' "$ft" "$fn"

  echo "  --- qmd top hits ---"
  printf '%s\n' "$qout" | head -5 | sed 's/^/    /'
  echo "  --- rg title/alias hits ---"
  printf '%s\n' "$rout" | head -5 | sed "s|$NOTES/|    |"
  echo
done

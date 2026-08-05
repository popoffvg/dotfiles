#!/usr/bin/env bash
# Aggregate `## bio-terms` and `## modeling-approaches` lines from block extraction
# files into two TSV-ish streams for vault authoring.
#
# Usage: vault-aggregate-terms.sh <extract-dir> <out-dir>
set -euo pipefail

EXTRACT_DIR="${1:?extract dir required}"
OUT_DIR="${2:?out dir required}"
mkdir -p "$OUT_DIR"

: > "$OUT_DIR/terms.raw.tsv"
: > "$OUT_DIR/approaches.raw.tsv"

for f in "$EXTRACT_DIR"/*.md; do
  block="$(basename "$f" .md)"
  awk -v blk="$block" '
    /^## /            { sect = $0; next }
    /^[[:space:]]*$/  { next }
    sect == "## bio-terms" && $0 !~ /^none$/ {
      print blk "\t" $0 >> "'"$OUT_DIR"'/terms.raw.tsv"
    }
    sect == "## modeling-approaches" && $0 !~ /^none$/ && /^- / {
      print blk "\t" $0 >> "'"$OUT_DIR"'/approaches.raw.tsv"
    }
  ' "$f"
done

# term name is the text before the first " | "
cut -f2 "$OUT_DIR/terms.raw.tsv" | sed 's/ *|.*//' | sed 's/^ *//; s/ *$//' \
  | sort | uniq -c | sort -rn > "$OUT_DIR/terms.freq.txt"

# approach name is the text inside the first backticks
cut -f2 "$OUT_DIR/approaches.raw.tsv" \
  | sed -n 's/^- *`\([^`]*\)`.*/\1/p' \
  | sort | uniq -c | sort -rn > "$OUT_DIR/approaches.freq.txt"

wc -l "$OUT_DIR/terms.raw.tsv" "$OUT_DIR/approaches.raw.tsv" \
      "$OUT_DIR/terms.freq.txt" "$OUT_DIR/approaches.freq.txt"

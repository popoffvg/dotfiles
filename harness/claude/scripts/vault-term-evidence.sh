#!/usr/bin/env bash
# Show bio-terms evidence lines for one canonical term.
# Usage: vault-term-evidence.sh <scratchpad-dir> "<Term>"
# Reads <scratchpad>/agg/terms.canonical.tsv and <scratchpad>/tmp-aa/bioterms_all.tsv
set -euo pipefail
S="$1"; TERM_NAME="$2"
row=$(awk -F'\t' -v t="$TERM_NAME" '$1==t' "$S/agg/terms.canonical.tsv")
[ -n "$row" ] || { echo "no canonical row for $TERM_NAME" >&2; exit 1; }
aliases=$(printf '%s' "$row" | cut -f3)
blocks=$(printf '%s' "$row" | cut -f4)
pat="$TERM_NAME"
if [ "$aliases" != "-" ]; then pat="$pat|$aliases"; fi
printf '%s\n' "$blocks" | tr '|' '\n' | while read -r b; do
  [ -n "$b" ] || continue
  awk -F'\t' -v b="$b" '$1==b' "$S/tmp-aa/bioterms_all.tsv" | grep -Ei -- "$pat" || true
done

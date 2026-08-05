#!/usr/bin/env bash
# Join raw <term, block> pairs with a hand-written canonical mapping.
# Usage: vault-canonicalize-terms.sh <agg-dir>
#   <agg-dir>/pairs.tsv   : <raw term>\t<block>
#   <agg-dir>/assign.tsv  : <raw term>\t<Canonical1;Canonical2>  |  <raw term>\tDROP:<reason>
#   <agg-dir>/canon.tsv   : <canonical>\t<category>\t<aliases or ->
# Writes <agg-dir>/terms.canonical.tsv and <agg-dir>/terms.dropped.txt
# Exits non-zero and reports if any raw term is unassigned, any assigned
# canonical is missing from canon.tsv, or any canon.tsv row is never used.
set -euo pipefail

AGG="${1:?usage: vault-canonicalize-terms.sh <agg-dir>}"
PAIRS="$AGG/pairs.tsv"
ASSIGN="$AGG/assign.tsv"
CANON="$AGG/canon.tsv"

for f in "$PAIRS" "$ASSIGN" "$CANON"; do
  [ -f "$f" ] || { echo "missing: $f" >&2; exit 2; }
done

awk -F'\t' -v out="$AGG/terms.canonical.tsv" -v dropped="$AGG/terms.dropped.txt" '
FILENAME == ARGV[1] { cat[$1] = $2; alias[$1] = $3; order[++nc] = $1; next }
FILENAME == ARGV[2] { assign[$1] = $2; next }
{
  term = $1; block = $2
  if (!(term in assign)) { unassigned[term] = 1; next }
  a = assign[term]
  if (a ~ /^DROP:/) { sub(/^DROP:/, "", a); drop[term] = a; next }
  n = split(a, parts, ";")
  for (i = 1; i <= n; i++) {
    c = parts[i]
    if (!(c in cat)) { unknown[c] = 1; continue }
    used[c] = 1
    key = c SUBSEP block
    if (!(key in seen)) { seen[key] = 1; blocks[c] = (c in blocks) ? blocks[c] "|" block : block }
  }
}
END {
  for (i = 1; i <= nc; i++) {
    c = order[i]
    if (!(c in used)) { printf "UNUSED canonical: %s\n", c > "/dev/stderr"; err = 1; next }
    printf "%s\t%s\t%s\t%s\n", c, cat[c], alias[c], blocks[c] > out
  }
  for (t in unassigned) { printf "UNASSIGNED raw term: %s\n", t > "/dev/stderr"; err = 1 }
  for (c in unknown)    { printf "UNKNOWN canonical: %s\n", c > "/dev/stderr"; err = 1 }
  for (t in drop)       { printf "%s — %s\n", t, drop[t] > dropped }
  exit err ? 1 : 0
}
' "$CANON" "$ASSIGN" "$PAIRS"

sort -o "$AGG/terms.dropped.txt" "$AGG/terms.dropped.txt"
perl -i -F'\t' -lane '$F[3] = join "|", sort split /\|/, $F[3]; print join "\t", @F' "$AGG/terms.canonical.tsv"
echo "canonical: $(wc -l < "$AGG/terms.canonical.tsv")  dropped: $(wc -l < "$AGG/terms.dropped.txt")"

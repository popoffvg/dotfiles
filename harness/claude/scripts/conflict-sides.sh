#!/usr/bin/env bash
# Split a file containing diff3 conflict markers into its three sides.
# Args: <file> <out-dir>
# Writes <out-dir>/<basename>.ours, .base, .theirs — each the whole file with
# every conflict resolved to that one side. Idempotent; a file with no markers
# yields three identical copies.
set -euo pipefail

file=${1:?usage: conflict-sides.sh <file> <out-dir>}
outdir=${2:?usage: conflict-sides.sh <file> <out-dir>}
mkdir -p "$outdir"
base=$(basename "$file")

for side in ours base theirs; do
  awk -v side="$side" '
    /^<<<<<<< / { where = "ours";   next }
    /^\|\|\|\|\|\|\| / { where = "base";   next }
    /^=======$/ { if (where != "") { where = "theirs"; next } }
    /^>>>>>>> / { where = ""; next }
    { if (where == "" || where == side) print }
  ' "$file" >"$outdir/$base.$side"
done

echo "$outdir/$base.ours"
echo "$outdir/$base.base"
echo "$outdir/$base.theirs"

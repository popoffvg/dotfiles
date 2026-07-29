#!/usr/bin/env bash
# Diff two block-conformance-scan.sh TSVs: per-column totals before/after, and
# per-block changed cells. Usage: conformance-diff.sh <before.tsv> <after.tsv>
set -uo pipefail
B="${1:?before.tsv}"; A="${2:?after.tsv}"

echo "=== per-column totals (blocks with a truthy/non-zero value) ==="
totals() {
  awk -F'\t' 'NR==1{for(i=2;i<=NF;i++)h[i]=$i;next}
    {for(i=2;i<=NF;i++){v=$i; if(v ~ /^[0-9]+$/){ if(v>0) s[i]++ } else if(v=="V3"){s[i]++}}}
    END{for(i=2;i<=NF;i++) printf "%s\t%d\n", h[i], s[i]+0}' "$1"
}
join -t$'\t' <(totals "$B" | sort) <(totals "$A" | sort) \
  | awk -F'\t' '{d=$3-$2; printf "%-20s %4d -> %4d  %s\n", $1, $2, $3, (d==0?"":(d>0?"+" d:d))}' \
  | sort -t'>' -k2

echo
echo "=== per-block changed cells ==="
awk -F'\t' '
  NR==FNR { if(FNR==1){for(i=1;i<=NF;i++)h[i]=$i; next} for(i=2;i<=NF;i++) o[$1,i]=$i; seen[$1]=1; next }
  FNR==1 { next }
  {
    if(!($1 in seen)) { print "NEW BLOCK: " $1; next }
    for(i=2;i<=NF;i++) if(o[$1,i] != $i) printf "%-42s %-18s %s -> %s\n", $1, h[i], o[$1,i], $i
  }' "$B" "$A"

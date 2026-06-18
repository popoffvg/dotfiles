#!/usr/bin/env bash
# Generate a synthetic paired-end FASTQ.gz sample for import/sample-matcher tests.
# Names files <SAMPLE>_1.sub.fastq.gz / <SAMPLE>_2.sub.fastq.gz so a
# {{Sample}}_{{R}}.sub.fastq.gz matcher binds. Reads are random ACGT, fixed-len.
# Idempotent: overwrites existing output.
#
# Usage: gen-test-fastq.sh <outdir> [sample=TEST0001] [count=100] [r1len=26] [r2len=98]
set -euo pipefail

outdir="${1:?usage: gen-test-fastq.sh <outdir> [sample] [count] [r1len] [r2len]}"
sample="${2:-TEST0001}"
count="${3:-100}"
r1len="${4:-26}"
r2len="${5:-98}"

mkdir -p "$outdir"

gen_read() { # $1=len
  perl -e '
    my $len = $ARGV[0];
    my @b = ("A","C","G","T");
    my $s = ""; $s .= $b[int(rand(4))] for 1..$len;
    print $s;
  ' "$1"
}

write_fq() { # $1=read-num(1/2) $2=len
  local rnum="$1" len="$2"
  local out="$outdir/${sample}_${rnum}.sub.fastq.gz"
  {
    for i in $(seq 1 "$count"); do
      printf '@%s.%d synthetic length=%d\n' "$sample" "$i" "$len"
      gen_read "$len"; printf '\n+\n'
      printf 'E%.0s' $(seq 1 "$len"); printf '\n'
    done
  } | gzip -c > "$out"
  echo "$out"
}

write_fq 1 "$r1len"
write_fq 2 "$r2len"

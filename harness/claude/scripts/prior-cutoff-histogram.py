#!/usr/bin/env python3
"""Distribution of the wild-type prior probability over a Sapiens *.prior.tsv.

Usage: prior-cutoff-histogram.py <prior.tsv> <residues.json> [cutoff]

Prints, per chain, the quantiles of exp(prior[wild_type]) and how many framework
positions fall below the cutoff. That count is exactly the number of edits the
humanization objective emits for that chain.
"""
import csv, json, math, sys
from collections import defaultdict

prior_path, residues_path = sys.argv[1], sys.argv[2]
cutoff = float(sys.argv[3]) if len(sys.argv) > 3 else 0.05

wt = {}
for r in json.load(open(residues_path)):
    wt[(r["chain"], str(r["imgt"]))] = r["wildType"]

per_chain = defaultdict(list)
for row in csv.DictReader(open(prior_path), delimiter="\t"):
    key = (row["chain"], row["imgt"])
    aa = wt.get(key)
    if aa is None or aa not in row:
        continue
    per_chain[row["chain"]].append((row["imgt"], math.exp(float(row[aa]))))

for chain, pairs in sorted(per_chain.items()):
    values = sorted(p for _, p in pairs)
    n = len(values)
    q = lambda f: values[min(n - 1, int(f * n))]
    below = [(i, p) for i, p in pairs if p < cutoff]
    print(f"chain {chain}: {n} framework positions scored")
    print(f"  exp(p_wt) min={values[0]:.4f} p10={q(.1):.4f} median={q(.5):.4f} p90={q(.9):.4f} max={values[-1]:.4f}")
    print(f"  below cutoff {cutoff}: {len(below)} -> {', '.join(i for i, _ in below) or 'none'}")

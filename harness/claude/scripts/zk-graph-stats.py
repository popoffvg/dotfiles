#!/usr/bin/env python3
"""Analyze wikilink graph topology of a zettelkasten vault: degree distribution,
orphans, dead links, connected components, hub concentration."""
import sys, re, collections
from pathlib import Path

LAYERS = ["00-inbox", "10-sources", "20-notes", "30-maps", "40-journal"]
LINK = re.compile(r'\[\[([^\]|#]+)')


def main(vault):
    v = Path(vault)
    files = []
    for L in LAYERS:
        files += list((v / L).rglob("*.md"))
    idx = {}
    for f in files:
        rel = str(f.relative_to(v))
        idx.setdefault(f.stem.lower(), rel)
        idx[rel.lower()] = rel
        idx[rel[:-3].lower()] = rel
    out = collections.defaultdict(set)
    dead = collections.Counter()
    nlinks = 0
    for f in files:
        rel = str(f.relative_to(v))
        try:
            txt = f.read_text(errors="ignore")
        except Exception:
            continue
        for m in LINK.findall(txt):
            t = m.strip().lower()
            nlinks += 1
            tgt = idx.get(t) or idx.get(t.replace(" ", "-"))
            if tgt and tgt != rel:
                out[rel].add(tgt)
            elif not tgt:
                dead[m.strip()] += 1
    allf = [str(f.relative_to(v)) for f in files]
    ind = collections.Counter()
    for s, ts in out.items():
        for t in ts:
            ind[t] += 1
    adj = collections.defaultdict(set)
    for s, ts in out.items():
        for t in ts:
            adj[s].add(t)
            adj[t].add(s)
    seen, comps = set(), []
    for n in allf:
        if n in seen:
            continue
        stack, c = [n], []
        seen.add(n)
        while stack:
            x = stack.pop()
            c.append(x)
            for y in adj[x]:
                if y not in seen:
                    seen.add(y)
                    stack.append(y)
        comps.append(c)
    comps.sort(key=len, reverse=True)

    def layer(p):
        return p.split("/")[0]

    print(f"notes(graph)      : {len(allf)}")
    print(f"wikilinks total   : {nlinks}")
    print(f"resolved edges    : {sum(len(x) for x in out.values())}")
    print(f"dead links        : {sum(dead.values())} ({len(dead)} distinct)")
    iso = [n for n in allf if not adj[n]]
    print(f"ISOLATED (deg 0)  : {len(iso)}  = {100*len(iso)/len(allf):.1f}%")
    print(f"components        : {len(comps)}; largest={len(comps[0])} ({100*len(comps[0])/len(allf):.1f}%)")
    print(f"  next sizes      : {[len(c) for c in comps[1:11]]}")
    sizes = collections.Counter(len(c) for c in comps)
    print(f"  size histogram  : {dict(sorted(sizes.items())[:8])}")
    print("\n-- isolation by layer --")
    for L in LAYERS:
        tot = [n for n in allf if layer(n) == L]
        if not tot:
            continue
        z = [n for n in tot if not adj[n]]
        deg = sum(len(adj[n]) for n in tot) / len(tot)
        print(f"{L:12} n={len(tot):5}  isolated={len(z):5} ({100*len(z)/len(tot):5.1f}%)  avg_deg={deg:.2f}")
    print("\n-- cross-layer edge matrix (src -> dst) --")
    mat = collections.Counter()
    for s, ts in out.items():
        for t in ts:
            mat[(layer(s), layer(t))] += 1
    for (a, b), c in mat.most_common(20):
        print(f"  {c:6}  {a} -> {b}")
    print("\n-- top 15 in-degree hubs --")
    for p, c in ind.most_common(15):
        print(f"  {c:5}  {p}")
    print("\n-- top 15 out-degree --")
    for p, ts in sorted(out.items(), key=lambda x: -len(x[1]))[:15]:
        print(f"  {len(ts):5}  {p}")
    print("\n-- top 20 dead link targets --")
    for t, c in dead.most_common(20):
        print(f"  {c:5}  {t}")


main(sys.argv[1] if len(sys.argv) > 1 else ".")

#!/usr/bin/env python3
"""Probe why a zettelkasten graph fails to form clusters.

Measures the 20-notes-only subgraph: degree, clustering coefficient, and the
effect of removing super-hubs (which merge would-be clusters into one blob).
"""
import sys, re, collections, random
from pathlib import Path

LINK = re.compile(r'\[\[([^\]|#]+)')
LAYERS = ["00-inbox", "10-sources", "20-notes", "30-maps", "40-journal"]


def build(vault):
    v = Path(vault)
    files = []
    for L in LAYERS:
        files += list((v / L).rglob("*.md"))
    idx = {}
    for f in files:
        rel = str(f.relative_to(v))
        idx.setdefault(f.stem.lower(), rel)
        idx[rel[:-3].lower()] = rel
    out = collections.defaultdict(set)
    for f in files:
        rel = str(f.relative_to(v))
        try:
            txt = f.read_text(errors="ignore")
        except Exception:
            continue
        for m in LINK.findall(txt):
            t = m.strip().lower()
            tgt = idx.get(t) or idx.get(t.replace(" ", "-"))
            if tgt and tgt != rel:
                out[rel].add(tgt)
    return [str(f.relative_to(v)) for f in files], out


def undirected(nodes, out, keep):
    ns = set(n for n in nodes if keep(n))
    adj = collections.defaultdict(set)
    for s, ts in out.items():
        if s not in ns:
            continue
        for t in ts:
            if t in ns:
                adj[s].add(t)
                adj[t].add(s)
    return ns, adj


def comps(ns, adj):
    seen, cs = set(), []
    for n in ns:
        if n in seen:
            continue
        st, c = [n], []
        seen.add(n)
        while st:
            x = st.pop()
            c.append(x)
            for y in adj[x]:
                if y not in seen:
                    seen.add(y)
                    st.append(y)
        cs.append(c)
    return sorted(cs, key=len, reverse=True)


def cc(ns, adj, sample=1500):
    pool = [n for n in ns if len(adj[n]) >= 2]
    if not pool:
        return 0.0, 0
    random.seed(0)
    s = random.sample(pool, min(sample, len(pool)))
    tot = 0.0
    for n in s:
        nb = list(adj[n])
        if len(nb) > 60:
            nb = random.sample(nb, 60)
        k = len(nb)
        links = sum(1 for i in range(k) for j in range(i + 1, k) if nb[j] in adj[nb[i]])
        tot += 2.0 * links / (k * (k - 1)) if k > 1 else 0
    return tot / len(s), len(pool)


def report(title, ns, adj):
    cs = comps(ns, adj)
    iso = sum(1 for n in ns if not adj[n])
    c, npool = cc(ns, adj)
    deg = sum(len(adj[n]) for n in ns) / max(1, len(ns))
    print(f"\n### {title}")
    print(f"  nodes={len(ns)} avg_deg={deg:.2f} isolated={iso} ({100*iso/max(1,len(ns)):.1f}%)")
    print(f"  components={len(cs)} largest={len(cs[0])} ({100*len(cs[0])/max(1,len(ns)):.1f}%) next={[len(x) for x in cs[1:8]]}")
    print(f"  clustering coeff (sampled, n={npool}) = {c:.4f}   <-- triangle density")


def main(vault):
    nodes, out = build(vault)

    ns, adj = undirected(nodes, out, lambda n: True)
    report("FULL graph (all layers)", ns, adj)

    ns2, adj2 = undirected(nodes, out, lambda n: n.startswith("20-notes/"))
    report("ZETTEL-ONLY subgraph (20-notes <-> 20-notes)", ns2, adj2)

    # hub removal on full graph
    ind = collections.Counter()
    for s, ts in out.items():
        for t in ts:
            ind[t] += 1
    for k in (5, 20, 50):
        hubs = set(p for p, _ in ind.most_common(k))
        ns3, adj3 = undirected(nodes, out, lambda n: n not in hubs)
        report(f"FULL graph minus top-{k} hubs", ns3, adj3)

    print("\n-- degree distribution, zettel-only --")
    d = collections.Counter(len(adj2[n]) for n in ns2)
    buckets = collections.Counter()
    for k, v in d.items():
        b = 0 if k == 0 else (1 if k == 1 else (2 if k <= 3 else (4 if k <= 7 else (8 if k <= 15 else 16))))
        buckets[b] += v
    names = {0: "0 (orphan)", 1: "1", 2: "2-3", 4: "4-7", 8: "8-15", 16: "16+"}
    for b in sorted(buckets):
        print(f"  deg {names[b]:12} {buckets[b]:5}  {100*buckets[b]/len(ns2):5.1f}%")


main(sys.argv[1] if len(sys.argv) > 1 else ".")

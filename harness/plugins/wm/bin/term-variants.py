#!/usr/bin/env python3
"""Report backticked identifiers in a wm notes corpus that appear in more than one
spelling differing only by case or separator (idp / idP / id_p). Prototype detector."""
import re, sys, collections, pathlib

TOK = re.compile(r'`([A-Za-z][A-Za-z0-9_.]{2,40})`')

def key(t): return t.lower().replace('_', '').replace('.', '')

def main(paths):
    seen = collections.defaultdict(lambda: collections.defaultdict(list))
    for p in paths:
        for n, line in enumerate(pathlib.Path(p).read_text(errors='replace').splitlines(), 1):
            for t in TOK.findall(line):
                seen[key(t)][t].append(f"{p}:{n}")
    groups = {k: v for k, v in seen.items() if len(v) > 1}
    for k, v in sorted(groups.items()):
        print(f"{k}: " + " | ".join(f"{s} x{len(l)} ({l[0]})" for s, l in v.items()))
    print(f"\n{len(groups)} variant groups over {len(seen)} identifiers", file=sys.stderr)
    return 1 if groups else 0

sys.exit(main(sys.argv[1:]))

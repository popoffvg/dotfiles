#!/usr/bin/env python3
"""Check relative markdown links and their #anchors. Args: FILE_OR_DIR... Exit 1 on a broken link."""
import re, sys, pathlib

LINK = re.compile(r'\]\(([^)\s]+)\)')
FENCE = re.compile(r'^\s*(```|~~~)')

def slug(heading):
    s = heading.strip().lower()
    s = re.sub(r'[^\w\- ]', '', s)
    return s.replace(' ', '-')

def anchors(path, cache={}):
    if path not in cache:
        found, counts, fenced = set(), {}, False
        for line in path.read_text(encoding='utf-8').splitlines():
            if FENCE.match(line):
                fenced = not fenced
                continue
            m = None if fenced else re.match(r'^#{1,6}\s+(.*)', line)
            if m:
                base = slug(re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', m.group(1)))
                n = counts.get(base, 0)
                counts[base] = n + 1
                found.add(base if n == 0 else f'{base}-{n}')
        cache[path] = found
    return cache[path]

def files(args):
    for a in args:
        p = pathlib.Path(a)
        yield from (sorted(p.rglob('*.md')) + sorted(p.rglob('*.feature'))) if p.is_dir() else [p]

bad = 0
for f in files(sys.argv[1:] or ['.']):
    fenced = False
    for no, line in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
        if FENCE.match(line):
            fenced = not fenced
            continue
        if fenced:
            continue
        for target in LINK.findall(line):
            if re.match(r'^[a-z]+:', target):
                continue
            path, _, frag = target.partition('#')
            dest = (f.parent / path).resolve() if path else f.resolve()
            if not dest.exists():
                print(f'{f}:{no}: missing file {target}'); bad += 1
            elif frag and dest.is_file() and dest.suffix == '.md' and frag not in anchors(dest):
                print(f'{f}:{no}: missing anchor {target}'); bad += 1
sys.exit(1 if bad else 0)

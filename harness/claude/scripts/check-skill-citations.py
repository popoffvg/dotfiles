#!/usr/bin/env python3
"""Verify every cross-file citation in a Claude Code plugin's markdown resolves.

Checks the citation forms the wm house style uses:
  `<skill>:<file>.md` [§ Heading]   -> a file under skills/<skill>/ (or the plugin root)
  `<file>.md` § Heading             -> a file in the same skill, resolved nearest-first
  [text](relative/path.md)          -> a real path on disk

A bare `file.md` with no heading and no match anywhere in the plugin is treated as a
notes-dir artifact (TODO-N.md, LESSONS.md, spec.md in a work dir) and skipped: only a
citation that names a skill, or pins a heading, is claimed to live in the plugin.

Usage: check-skill-citations.py <plugin-root> [--quiet]
Exit 1 when anything fails to resolve.
"""
import re, sys, pathlib

root = pathlib.Path(sys.argv[1]).resolve()
quiet = "--quiet" in sys.argv
md = [p for p in root.rglob("*.md") if ".git" not in p.parts]
skills_dir = root / "skills"
known_skills = {p.name for p in skills_dir.iterdir() if p.is_dir()} if skills_dir.is_dir() else set()

# Artifacts that live outside the plugin: a work notes dir, or the harness' own always-loaded
# files. A citation naming one of these is never a claim about a file in the plugin.
EXTERNAL = re.compile(r"^(TODO-[\w.]+|LESSONS\.md|impl-learnings\.md|CODE_STYLE\.md|PATTERNS\.md|CLAUDE\.md|RULES\.md|CONCEPTS\.md|verify-TODO[\w.-]*|\d{3}-[\w-]+\.md)$")

heads: dict[pathlib.Path, list[str]] = {}
def headings(p):
    if p not in heads:
        try:
            heads[p] = [re.sub(r"^#+\s+", "", l).strip().lower()
                        for l in p.read_text().splitlines() if l.startswith("#")]
        except OSError:
            heads[p] = []
    return heads[p]

def head_ok(p, cited):
    """A cited heading matches when its first words prefix a real heading, or vice versa.
    Citations wrap across lines, so only the leading words are reliable."""
    c = " ".join(cited.lower().split()).rstrip(".,;:")
    lead = " ".join(c.split()[:4])
    for h in headings(p):
        h_lead = " ".join(h.split()[:4])
        if h.startswith(c) or c.startswith(h.split(" — ")[0]) or h_lead == lead:
            return True
    return False

def find(name, frm, skill=None):
    hits = [p for p in md if p.name == name]
    if skill and skill in known_skills:
        scoped = [p for p in hits if skills_dir / skill in p.parents]
        return scoped[0] if scoped else None
    if not hits:
        return None
    for base in (frm.parent, *frm.parents):
        local = [p for p in hits if p.parent == base or base in p.parents]
        if local:
            return local[0]
    return hits[0]

CITE = re.compile(r"`(?:([a-z0-9-]+):)?((?:[\w./-]+/)?[\w.-]+\.md)`[ \n]*(?:§\s*([^.`\n)|]+))?")
LINK = re.compile(r"\[[^\]]*\]\((?!https?:)([^)#]+\.md)(?:#[^)]*)?\)")

fails = []
for f in md:
    text = f.read_text()
    for skill, path, sect in CITE.findall(text):
        name = pathlib.Path(path).name
        if EXTERNAL.match(name) and skill not in known_skills:
            continue
        claimed = bool(skill and skill in known_skills) or bool(sect.strip())
        tgt = find(name, f, skill if skill in known_skills else None)
        if tgt is None:
            if claimed:
                where = f"skill '{skill}'" if skill in known_skills else "the plugin"
                fails.append((f, f"`{skill + ':' if skill else ''}{path}` -> not in {where}"))
            continue
        if sect.strip() and not head_ok(tgt, sect):
            fails.append((f, f"`{path}` § {' '.join(sect.split())} -> no such heading in {tgt.relative_to(root)}"))
    for rel in LINK.findall(text):
        if EXTERNAL.match(pathlib.Path(rel).name):
            continue  # a link to a notes-dir artifact, which resolves where the artifact is written
        if not (f.parent / rel).exists():
            fails.append((f, f"link ({rel}) -> missing"))

for f, msg in sorted((str(a.relative_to(root)), b) for a, b in fails):
    print(f"FAIL {f}: {msg}")
if not quiet:
    print(f"\n{len(md)} files, {len(fails)} unresolved citations")
sys.exit(1 if fails else 0)

#!/usr/bin/env python3
"""Append "## Depends on" / "## Affects" bullets to wm thought notes, idempotently.

Usage: wm-backlink-thoughts.py <thoughts-dir> <edge-file>

Edge-file lines:  <note-id>|<section>|<target-id>|<annotation>
  note-id / target-id  the NNN- filename prefix
  section              a heading name, e.g. "Depends on" or "Affects"
Blank lines and #-comments are skipped.

Also syncs each edited note's frontmatter `links:` list to every [[wikilink]] in
its body. A bullet already present in its section is left alone, so reruns are safe.
"""

import re
import sys
from collections import defaultdict
from pathlib import Path

SECTION_RE = re.compile(r"^## ", re.M)
WIKILINK_RE = re.compile(r"\[\[([^\]|]+)\]\]")


def resolve(d: Path, note_id: str) -> Path:
    hits = sorted(d.glob(f"{note_id}-*.md"))
    if not hits:
        sys.exit(f"no note with id {note_id} in {d}")
    return hits[0]


def section_bounds(lines, section):
    """Return (start, end) line indices of a section's body, or None."""
    header = f"## {section}"
    try:
        start = next(i for i, ln in enumerate(lines) if ln.rstrip() == header)
    except StopIteration:
        return None
    end = len(lines)
    for i in range(start + 1, len(lines)):
        if lines[i].startswith("## "):
            end = i
            break
    return start + 1, end


def sync_links_frontmatter(text: str) -> str:
    """Rewrite the frontmatter links: list from the wikilinks in the body."""
    if not text.startswith("---\n"):
        return text
    close = text.find("\n---\n", 4)
    if close == -1:
        return text
    fm, body = text[4:close + 1], text[close + 5:]

    slugs = sorted(set(WIKILINK_RE.findall(body)))
    block = "links: []\n" if not slugs else "links:\n" + "".join(
        f'  - "[[{s}]]"\n' for s in slugs)

    fm_new, n = re.subn(r"^links:(?:\s*\[\]\s*|\s*\n(?:  - .*\n)*)", block, fm, flags=re.M)
    if n == 0:
        fm_new = fm + block
    return "---\n" + fm_new + "---\n" + body


def main() -> None:
    d = Path(sys.argv[1])
    edges = Path(sys.argv[2]).read_text().splitlines()

    # (file, section) -> [bullet, ...], preserving edge-file order
    todo = defaultdict(list)
    for raw in edges:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        note_id, section, target_id, annot = (p.strip() for p in line.split("|", 3))
        slug = resolve(d, target_id).stem
        todo[(resolve(d, note_id), section)].append((slug, f"- [[{slug}]] — {annot}"))

    added = 0
    touched = set()
    for (path, section), bullets in todo.items():
        lines = path.read_text().splitlines(keepends=True)
        bounds = section_bounds(lines, section)

        if bounds is None:
            body = [b for _, b in bullets]
            if lines and not lines[-1].endswith("\n"):
                lines[-1] += "\n"
            lines += [f"\n## {section}\n"] + [b + "\n" for b in body]
            added += len(body)
        else:
            start, end = bounds
            existing = "".join(lines[start:end])
            fresh = [b + "\n" for slug, b in bullets if f"[[{slug}]]" not in existing]
            if not fresh:
                continue
            insert = end
            while insert > start and not lines[insert - 1].strip():
                insert -= 1
            lines[insert:insert] = fresh
            added += len(fresh)

        path.write_text(sync_links_frontmatter("".join(lines)))
        touched.add(path)

    # frontmatter sync for notes that gained no bullet but link inline
    for path in sorted(d.glob("*.md")):
        if path in touched:
            continue
        text = path.read_text()
        new = sync_links_frontmatter(text)
        if new != text:
            path.write_text(new)
            touched.add(path)

    print(f"added {added} bullet(s) across {len(touched)} note(s)")


if __name__ == "__main__":
    main()

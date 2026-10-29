#!/usr/bin/env python3
"""Print the index of a wm ADR dir: one line per ADR with number, kind, title, path.

Read the index, then open only the ADRs whose title bears on the task.

Exit 0 = at least one ADR printed · 1 = no ADR matched · 2 = usage or missing dir.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

DEFAULT_DIRS = (".notes/adr", "_notes/adr", "adr")


def resolve_dir(arg: str | None) -> Path:
    if arg:
        p = Path(arg)
        if p.name != "adr" and (p / "adr").is_dir():
            p = p / "adr"
        if not p.is_dir():
            sys.exit(f"wm-adr-index: not a directory: {p}")
        return p
    for candidate in DEFAULT_DIRS:
        p = Path(candidate)
        if p.is_dir():
            return p
    sys.exit(f"wm-adr-index: no adr dir (tried {', '.join(DEFAULT_DIRS)})")


def split(text: str) -> tuple[dict[str, str], list[str]]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, lines
    fm: dict[str, str] = {}
    for i, line in enumerate(lines[1:], 1):
        if line.strip() == "---":
            return fm, lines[i + 1:]
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*?)\s*(?:#.*)?$", line)
        if m:
            fm[m.group(1)] = m.group(2).strip("\"'")
    return fm, []


def paragraph(body: list[str]) -> str:
    """The first paragraph after the title and before the first `##` heading."""
    out: list[str] = []
    for line in body:
        if line.startswith("## "):
            break
        if line.startswith("# ") or line.lstrip().startswith(("<!--", ">")):
            continue
        if not line.strip():
            if out:
                break
            continue
        out.append(line.strip())
    return " ".join(out)


def section(body: list[str], name: str) -> str:
    out: list[str] = []
    inside = False
    for line in body:
        if line.startswith("## "):
            inside = line[3:].strip() == name
            continue
        if inside and line.strip():
            out.append(line.strip().lstrip("> ").strip())
    return " ".join(out)


def load(path: Path) -> dict[str, object]:
    fm, body = split(path.read_text(encoding="utf-8", errors="replace"))
    title = next((l[2:].strip() for l in body if l.startswith("# ")), "")
    return {
        "id": f"ADR-{path.stem.split('-', 1)[0]}",
        "kind": fm.get("kind", ""),
        "todo": fm.get("todo", ""),
        "source": fm.get("source", ""),
        "updated": fm.get("updated", ""),
        "title": title,
        "summary": paragraph(body),
        "properties": section(body, "Properties"),
        "path": str(path),
        "archived": path.parent.name == "archived",
    }


def records(dirpath: Path, archived: bool) -> list[dict[str, object]]:
    files = sorted(f for f in dirpath.glob("[0-9]*.md") if f.is_file())
    if archived:
        files += sorted(f for f in (dirpath / "archived").glob("[0-9]*.md") if f.is_file())
    return [load(f) for f in files]


def text_matches(adr: dict[str, object], pattern: re.Pattern[str] | None) -> bool:
    if pattern is None:
        return True
    keys = ("id", "kind", "todo", "title", "summary", "properties")
    haystack = " ".join([str(adr[k]) for k in keys] + [Path(str(adr["path"])).stem])
    return bool(pattern.search(haystack))


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="wm-adr-index.py",
        description="Index of a wm ADR dir: number, kind, title, path.",
        epilog="Tool index — every .notes tool and its flags: wm:TOOLS.md",
    )
    ap.add_argument("dir", nargs="?", help=f"adr dir or notes dir (default: first of {', '.join(DEFAULT_DIRS)})")
    ap.add_argument("-m", "--match", help="case-insensitive regex over id, kind, title, paragraph, Properties, slug")
    ap.add_argument("-k", "--kind", action="append", default=[], help="keep only this kind (repeatable)")
    ap.add_argument("--todo", help="keep only ADRs whose frontmatter `todo:` is this TODO (e.g. TODO-2)")
    ap.add_argument("--archived", action="store_true", help="include adr/archived/")
    ap.add_argument("--files", action="store_true", help="print matching paths only, one per line")
    ap.add_argument("--json", action="store_true", help="print matching ADRs as one JSON array")
    args = ap.parse_args()

    dirpath = resolve_dir(args.dir)
    try:
        pattern = re.compile(args.match, re.IGNORECASE) if args.match else None
    except re.error as exc:
        sys.exit(f"wm-adr-index: bad --match regex: {exc}")

    rows = records(dirpath, args.archived)
    if args.kind:
        rows = [a for a in rows if a["kind"] in args.kind]
    if args.todo:
        rows = [a for a in rows if a["todo"] == args.todo]
    rows = [a for a in rows if text_matches(a, pattern)]

    if args.json:
        print(json.dumps(rows, indent=2))
    elif args.files:
        for a in rows:
            print(a["path"])
    elif not rows:
        print(f"no ADR matched in {dirpath}")
    else:
        for a in rows:
            flags = "".join([" [archived]" if a["archived"] else "", f" [{a['todo']}]" if a["todo"] else ""])
            print(f"{a['id']}  {a['kind']:<14} {a['title'] or '<no title>'}{flags}  {a['path']}")
        print("---")
        print(f"{len(rows)} ADR(s). Open only the ones whose title covers your task.")

    return 0 if rows else 1


if __name__ == "__main__":
    sys.exit(main())

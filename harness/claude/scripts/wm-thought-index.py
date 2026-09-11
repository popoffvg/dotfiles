#!/usr/bin/env python3
"""Print the metadata index of a wm thought graph — one row per note, description included.

The entry point into `thoughts/`: read the index, pick the notes whose description
matches the task at hand, then open only those. Reading every note is the thing this
replaces (`arch:ref-note-format.md` § Finding the thought for your task).

Exit 0 = at least one note printed · 1 = no note matched · 2 = usage or missing dir.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

DEFAULT_DIRS = (".notes/thoughts", "_notes/thoughts", "thoughts")
SCALAR_KEYS = ("type", "id", "status", "date", "source", "todo", "superseded_by", "replaces")


def resolve_dir(arg: str | None) -> Path:
    if arg:
        p = Path(arg)
        if not p.is_dir():
            sys.exit(f"wm-thought-index: not a directory: {p}")
        return p
    for candidate in DEFAULT_DIRS:
        p = Path(candidate)
        if p.is_dir():
            return p
    sys.exit(f"wm-thought-index: no thoughts dir (tried {', '.join(DEFAULT_DIRS)})")


def frontmatter(text: str) -> dict[str, object]:
    """Parse the leading `---` block. Handles single-line scalars, quoted values,
    folded/literal blocks (`>` / `|`), and inline `[a, b]` lists."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    body: list[str] = []
    for line in lines[1:]:
        if line.strip() == "---":
            break
        body.append(line)

    fm: dict[str, object] = {}
    key: str | None = None
    block: list[str] = []
    for line in body:
        if key is not None:
            # inside a folded/literal block: any indented (or blank) line continues it
            if not line.strip() or line[:1] in (" ", "\t"):
                block.append(line.strip())
                continue
            fm[key] = " ".join(w for w in block if w)
            key, block = None, []
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*?)\s*(?:#.*)?$", line)
        if not m:
            continue
        name, value = m.group(1), m.group(2)
        if value in (">", "|", ">-", "|-"):
            key, block = name, []
            continue
        fm[name] = unquote(value)
    if key is not None:
        fm[key] = " ".join(w for w in block if w)
    return fm


def unquote(value: str) -> object:
    value = value.strip()
    if value.startswith("[") and value.endswith("]"):
        return [unquote(v) for v in value[1:-1].split(",") if v.strip()]
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def title_of(text: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def load(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8", errors="replace")
    fm = frontmatter(text)
    tags = fm.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    stem = path.stem
    return {
        "id": str(fm.get("id") or stem.split("-", 1)[0]),
        "type": str(fm.get("type") or ""),
        "status": str(fm.get("status") or ""),
        "todo": str(fm.get("todo") or ""),
        "tags": [str(t) for t in tags],
        "title": title_of(text),
        "description": str(fm.get("description") or ""),
        "path": str(path),
        "archived": path.parent.name == "archived",
    }


def notes(dirpath: Path, archived: bool) -> list[dict[str, object]]:
    files = sorted(f for f in dirpath.glob("*.md") if f.is_file())
    if archived:
        files += sorted(f for f in (dirpath / "archived").glob("*.md") if f.is_file())
    return [load(f) for f in files]


def matches(note: dict[str, object], pattern: re.Pattern[str] | None) -> bool:
    if pattern is None:
        return True
    haystack = " ".join(
        [
            str(note["id"]),
            str(note["type"]),
            str(note["title"]),
            str(note["description"]),
            " ".join(note["tags"]),  # type: ignore[arg-type]
            Path(str(note["path"])).stem,
        ]
    )
    return bool(pattern.search(haystack))


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="wm-thought-index.py",
        description="Metadata index of a wm thought graph: id, type, status, tags, title, description.",
        epilog="Tool index — every .notes tool and its flags: wm:TOOLS.md",
    )
    ap.add_argument("dir", nargs="?", help=f"thoughts dir (default: first of {', '.join(DEFAULT_DIRS)})")
    ap.add_argument("-m", "--match", help="case-insensitive regex over id, type, tags, title, description, slug")
    ap.add_argument("-t", "--type", action="append", default=[], help="keep only this type (repeatable)")
    ap.add_argument("-s", "--status", action="append", default=[], help="keep only this status (repeatable)")
    ap.add_argument("--todo", help="keep only notes whose frontmatter `todo:` is this TODO (e.g. TODO-2)")
    ap.add_argument("--archived", action="store_true", help="include thoughts/archived/ notes")
    ap.add_argument("--files", action="store_true", help="print matching paths only, one per line")
    ap.add_argument("--missing-description", action="store_true", help="keep only notes with no description")
    ap.add_argument("--json", action="store_true", help="print matching notes as one JSON array")
    args = ap.parse_args()

    dirpath = resolve_dir(args.dir)
    try:
        pattern = re.compile(args.match, re.IGNORECASE) if args.match else None
    except re.error as exc:
        sys.exit(f"wm-thought-index: bad --match regex: {exc}")

    rows = notes(dirpath, args.archived)
    if args.type:
        rows = [n for n in rows if n["type"] in args.type]
    if args.status:
        rows = [n for n in rows if n["status"] in args.status]
    if args.todo:
        rows = [n for n in rows if n["todo"] == args.todo]
    if args.missing_description:
        rows = [n for n in rows if not n["description"]]
    rows = [n for n in rows if matches(n, pattern)]

    if args.json:
        print(json.dumps(rows, indent=2))
    elif args.files:
        for n in rows:
            print(n["path"])
    elif not rows:
        print(f"no thought matched in {dirpath}")
    else:
        for n in rows:
            tags = ",".join(n["tags"]) or "-"  # type: ignore[arg-type]
            flags = "".join(
                [" [archived]" if n["archived"] else "", f" [{n['todo']}]" if n["todo"] else ""]
            )
            print(f"{n['id']}  {n['type']:<14} {n['status']:<9} {tags:<24} {n['title'] or '<no title>'}{flags}")
            print(f"      {n['description'] or '!! no description — add one (ref-note-format.md § Frontmatter)'}")
            print(f"      {n['path']}")
        print("---")
        print(f"{len(rows)} thought(s) — open only the ones whose description covers your task")

    return 0 if rows else 1


if __name__ == "__main__":
    sys.exit(main())

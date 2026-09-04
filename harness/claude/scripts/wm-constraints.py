#!/usr/bin/env python3
"""Generate the constraint set of a wm corpus from its thought graph.

Every live approved `decision` / `impl-decision` note is one rule; its frontmatter
`description` is the rule text and its `NNN` is the rule id. There is no
`CONSTRAINTS.md` to maintain: a superseded decision leaves `thoughts/`, so it
leaves the constraint set in the same move.

Exit 0 = at least one rule printed · 1 = no rule matched · 2 = usage or missing dir
· 3 = --check found a qualifying note with no description.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

DEFAULT_DIRS = (".notes/thoughts", "_notes/thoughts", "thoughts")
RULE_TYPES = ("decision", "impl-decision")


def resolve_dir(arg: str | None) -> Path:
    if arg:
        p = Path(arg)
        if p.name != "thoughts" and (p / "thoughts").is_dir():
            p = p / "thoughts"
        if not p.is_dir():
            sys.exit(f"wm-constraints: not a directory: {p}")
        return p
    for candidate in DEFAULT_DIRS:
        p = Path(candidate)
        if p.is_dir():
            return p
    sys.exit(f"wm-constraints: no thoughts dir (tried {', '.join(DEFAULT_DIRS)})")


def frontmatter(text: str) -> dict[str, object]:
    """Parse the leading `---` block: single-line scalars, quoted values,
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


def load(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    fm = frontmatter(text)
    return {
        "id": str(fm.get("id") or path.stem.split("-", 1)[0]),
        "type": str(fm.get("type") or ""),
        "status": str(fm.get("status") or "approved"),
        "source": str(fm.get("source") or ""),
        "todo": str(fm.get("todo") or ""),
        "title": title_of(text),
        "rule": " ".join(str(fm.get("description") or "").split()),
        "origin": path.stem,
        "path": str(path),
    }


def rules(dirpath: Path, types: list[str]) -> list[dict[str, str]]:
    rows = [load(f) for f in sorted(dirpath.glob("*.md")) if f.is_file()]
    rows = [r for r in rows if r["type"] in types and r["status"] == "approved"]
    return sorted(rows, key=lambda r: r["id"])


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="wm-constraints.py",
        description="The rules a wm corpus obeys, generated from its live approved decision notes.",
    )
    ap.add_argument("dir", nargs="?", help=f"thoughts dir or notes dir (default: first of {', '.join(DEFAULT_DIRS)})")
    ap.add_argument("-m", "--match", help="case-insensitive regex over id, rule, title, slug")
    ap.add_argument(
        "-t", "--type", action="append", default=[],
        help=f"note type to treat as a rule, repeatable (default: {', '.join(RULE_TYPES)})",
    )
    ap.add_argument("--todo", help="drop rules scoped to a different TODO; keeps unscoped ones (e.g. TODO-2)")
    ap.add_argument("--json", action="store_true", help="print the rules as one JSON array")
    ap.add_argument("--check", action="store_true", help="report qualifying notes with no description, exit 3 if any")
    args = ap.parse_args()

    dirpath = resolve_dir(args.dir)
    try:
        pattern = re.compile(args.match, re.IGNORECASE) if args.match else None
    except re.error as exc:
        sys.exit(f"wm-constraints: bad --match regex: {exc}")

    rows = rules(dirpath, args.type or list(RULE_TYPES))

    if args.check:
        broken = [r for r in rows if not r["rule"]]
        for r in broken:
            print(f"D{r['id']}  no description — the rule has no text: {r['path']}")
        if broken:
            print(f"--- {len(broken)} rule(s) with no text (arch:ref-note-format.md § Frontmatter)")
            return 3
        print(f"all {len(rows)} rule(s) carry a description")
        return 0

    if args.todo:
        # Drop a row only when it is scoped to a DIFFERENT todo. A note carrying no `todo:`
        # key is corpus-wide and always binds — silently dropping it would hide a rule.
        rows = [r for r in rows if not r["todo"] or r["todo"] == args.todo]
    if pattern:
        rows = [
            r for r in rows
            if pattern.search(" ".join([r["id"], r["rule"], r["title"], r["origin"]]))
        ]

    if args.json:
        print(json.dumps(rows, indent=2))
        return 0 if rows else 1

    if not rows:
        print(f"no constraint in {dirpath} — no live approved decision note carries one")
        return 1

    print("| # | Constraint | Origin |")
    print("|---|------------|--------|")
    for r in rows:
        rule = r["rule"] or "!! no description — add one (arch:ref-note-format.md § Frontmatter)"
        scope = f" [{r['todo']}]" if r["todo"] else ""
        auto = " [auto]" if r["source"] == "auto" else ""
        print(f"| D{r['id']} | {rule}{scope}{auto} | [[{r['origin']}]] |")
    print()
    print(f"{len(rows)} rule(s) from {dirpath} — every one binds the code; `[auto]` nobody approved, read those first")
    return 0


if __name__ == "__main__":
    sys.exit(main())

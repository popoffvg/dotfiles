#!/usr/bin/env python3
"""Generate the rules of a wm corpus from the Properties of its live ADRs.

One rule per Property line `- Pn. ...` of an ADR in `<notes-dir>/adr/`. Every live ADR
binds. The rule id is `ADR-NNNN/Pn` and the rule text is the Property.
A dropped Property and an archived ADR give no rule.

The `status` key is `proposed` or `approved`; a missing key reads as `proposed`. Only the
operator sets `approved`. `--unapproved` lists the live ADRs that are not approved: no TODO is
implemented while one exists.

Exit 0 = at least one rule printed, or --unapproved found none · 1 = no rule matched · 2 = usage
or missing dir · 3 = --check found an ADR that breaks the format · 4 = --unapproved found one.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

DEFAULT_DIRS = (".notes/adr", "_notes/adr", "adr")
KINDS = ("architecture", "feature", "implementation")
STATUSES = ("proposed", "approved")
PROPERTY = re.compile(r"^-\s+P(\d+)\.\s*(.*)$")
DROPPED = re.compile(r"^\(dropped\b", re.IGNORECASE)


def resolve_dir(arg: str | None) -> Path:
    if arg:
        p = Path(arg)
        if p.name != "adr" and (p / "adr").is_dir():
            p = p / "adr"
        if not p.is_dir():
            sys.exit(f"wm-constraints: not a directory: {p}")
        return p
    for candidate in DEFAULT_DIRS:
        p = Path(candidate)
        if p.is_dir():
            return p
    sys.exit(f"wm-constraints: no adr dir (tried {', '.join(DEFAULT_DIRS)})")


def frontmatter(text: str) -> dict[str, str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    fm: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*?)\s*(?:#.*)?$", line)
        if m:
            fm[m.group(1)] = m.group(2).strip("\"'")
    return fm


def section(text: str, name: str) -> list[str]:
    out: list[str] = []
    inside = False
    for line in text.splitlines():
        if line.startswith("## "):
            inside = line[3:].strip() == name
            continue
        if inside:
            out.append(line)
    return out


def properties(text: str) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for line in section(text, "Properties"):
        m = PROPERTY.match(line.strip())
        if m:
            body = m.group(2).strip()
            out.append({"n": int(m.group(1)), "text": body, "dropped": bool(DROPPED.match(body))})
        elif out and line[:1] in (" ", "\t") and line.strip() and not line.strip().startswith(">"):
            out[-1]["text"] = f"{out[-1]['text']} {line.strip()}"
    return out


def title_of(text: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def load(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8", errors="replace")
    fm = frontmatter(text)
    number = path.stem.split("-", 1)[0]
    return {
        "adr": f"ADR-{number}",
        "status": fm.get("status", "proposed"),
        "has_question": any(l.strip() == "## Question" for l in text.splitlines()),
        "kind": fm.get("kind", ""),
        "source": fm.get("source", ""),
        "todo": fm.get("todo", ""),
        "title": title_of(text),
        "properties": properties(text),
        "origin": path.name,
        "path": str(path),
    }


def adrs(dirpath: Path) -> list[dict[str, object]]:
    return [load(f) for f in sorted(dirpath.glob("[0-9]*.md")) if f.is_file()]


def rules(records: list[dict[str, object]]) -> list[dict[str, str]]:
    out = []
    for a in records:
        for p in a["properties"]:  # type: ignore[union-attr]
            if p["dropped"]:
                continue
            out.append({
                "id": f"{a['adr']}/P{p['n']}",
                "adr": str(a["adr"]),
                "property": f"P{p['n']}",
                "kind": str(a["kind"]),
                "source": str(a["source"]),
                "status": str(a["status"]),
                "todo": str(a["todo"]),
                "title": str(a["title"]),
                "rule": str(p["text"]),
                "origin": str(a["origin"]),
                "path": str(a["path"]),
            })
    return out


def problems(records: list[dict[str, object]]) -> list[str]:
    out = []
    for a in records:
        where = f"{a['adr']}  {a['path']}"
        kind, todo = str(a["kind"]), str(a["todo"])
        if a["status"] not in STATUSES:
            out.append(f"{where}: status {a['status']!r} is not proposed or approved")
        if a["has_question"]:
            out.append(f"{where}: has a ## Question section; an open question lives in QUESTIONS.md")
        if kind not in KINDS:
            out.append(f"{where}: kind {kind!r} is not architecture, feature, or implementation")
        live = [p for p in a["properties"] if not p["dropped"]]  # type: ignore[union-attr]
        if not live:
            out.append(f"{where}: no Property, so it gives no rule")
        if kind == "implementation" and not todo:
            out.append(f"{where}: kind implementation with no todo: key")
        if kind in KINDS and kind != "implementation" and todo:
            out.append(f"{where}: kind {kind} with a todo: key, only an implementation ADR names a TODO")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="wm-constraints.py",
        description="The rules a wm corpus obeys: one per Property of a live ADR.",
        epilog="Tool index — every .notes tool and its flags: wm:TOOLS.md",
    )
    ap.add_argument("dir", nargs="?", help=f"adr dir or notes dir (default: first of {', '.join(DEFAULT_DIRS)})")
    ap.add_argument("-m", "--match", help="case-insensitive regex over rule id, rule text, ADR title, file name")
    ap.add_argument("--todo", help="keep architecture and feature rules, and implementation rules of this TODO (e.g. TODO-2)")
    ap.add_argument("--json", action="store_true", help="print the rules as one JSON array")
    ap.add_argument("--check", action="store_true", help="report ADRs that break the format or give no rule; exit 3 if any")
    ap.add_argument("--unapproved", action="store_true", help="list the live ADRs the operator has not approved; exit 4 if any")
    args = ap.parse_args()

    dirpath = resolve_dir(args.dir)
    try:
        pattern = re.compile(args.match, re.IGNORECASE) if args.match else None
    except re.error as exc:
        sys.exit(f"wm-constraints: bad --match regex: {exc}")

    records = adrs(dirpath)
    rows = rules(records)

    if args.check:
        found = problems(records)
        for line in found:
            print(line)
        if found:
            print(f"--- {len(found)} problem(s) in {dirpath} (arch:ref-adr-format.md)")
            return 3
        print(f"all {len(records)} live ADR(s) in {dirpath} pass, {len(rows)} rule(s)")
        return 0

    if args.unapproved:
        waiting = [a for a in records if a["status"] != "approved"]
        for a in waiting:
            print(f"{a['adr']}  status: {a['status']}  {a['title']}  {a['path']}")
        if waiting:
            print(
                f"--- {len(waiting)} ADR(s) in {dirpath} wait for the operator. Only the operator sets"
                " `status: approved`; no TODO is implemented until every live ADR has it."
            )
            return 4
        print(f"all {len(records)} live ADR(s) in {dirpath} are approved")
        return 0

    if args.todo:
        rows = [r for r in rows if r["kind"] != "implementation" or r["todo"] == args.todo]
    if pattern:
        rows = [r for r in rows if pattern.search(" ".join([r["id"], r["rule"], r["title"], r["origin"]]))]

    if args.json:
        print(json.dumps(rows, indent=2))
        return 0 if rows else 1

    if not rows:
        print(f"no rule in {dirpath}: no live ADR has a Property that matches")
        return 1

    print("| Rule | Constraint | Origin |")
    print("|------|------------|--------|")
    for r in rows:
        scope = f" [{r['todo']}]" if r["todo"] else ""
        auto = " [auto]" if r["source"] == "auto" else ""
        proposed = " [proposed]" if r["status"] != "approved" else ""
        print(f"| {r['id']} | {r['rule']}{scope}{auto}{proposed} | [{r['adr']}]({r['origin']}) |")
    print()
    print(f"{len(rows)} rule(s) from {dirpath}. Every one binds the code. `[auto]` means no operator was asked: read those first.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

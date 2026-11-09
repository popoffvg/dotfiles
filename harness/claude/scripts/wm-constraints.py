#!/usr/bin/env python3
"""Generate the rules of a wm corpus from the Properties of its live ADRs.

One rule per row `| Pn | <Property> | <If broken> | <Recovers by> |` of the Properties table of an ADR
in `<notes-dir>/adr/`. Every live ADR binds. The rule id is `ADR-NNNN/Pn` and the rule text is the
Property. An archived ADR gives no rule.

`--check` also reads the Property gate of each ADR: `adr/gates/<same file name>`, one row per Property
with Observables, Assumptions, Theorem, Counterexample, and Verdict.

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
KINDS = ("architecture", "feature")
MAX_PROPERTIES = 6
STATUSES = ("proposed", "approved")
PROPERTY_ID = re.compile(r"^P(\d+)\.?$")
CELL_SPLIT = re.compile(r"(?<!\\)\|")
TABLE_RULE = re.compile(r"^[\s:-]*$")
MARK = re.compile(r"^\[(keep|new)\]\s")
MAX_PROPERTY_WORDS = 25
RECOVERIES = ("retry", "restart", "a human", "itself")
EVIDENCE = re.compile(r"\]\(|https?://|\b[\w/-]+\.(?:go|py|ts|js|rs|sh|md|ya?ml|json)\b|:\d+\b|\btoday on\b", re.IGNORECASE)
GATE_DIR = "gates"
GATE_CELLS = ("Observables", "Assumptions", "Theorem", "Counterexample", "Verdict")
QUANTIFIER = re.compile(r"[∀∃]")


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


def table(lines: list[str]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    header: list[str] = []
    for line in lines:
        text = line.strip()
        if not text.startswith("|"):
            header = []
            continue
        parts = CELL_SPLIT.split(text)
        cells = [c.replace("\\|", "|").strip() for c in (parts[1:-1] if text.endswith("|") else parts[1:])]
        if not header:
            header = cells
        elif not all(TABLE_RULE.match(c) for c in cells):
            rows.append(dict(zip(header, cells)))
    return rows


def numbered(rows: list[dict[str, str]]) -> dict[int, dict[str, str]]:
    out = {}
    for row in rows:
        m = PROPERTY_ID.match(row.get("Id", ""))
        if m:
            out[int(m.group(1))] = row
    return out


def title_of(text: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def gate_of(path: Path) -> dict[int, dict[str, str]] | None:
    gate = path.parent / GATE_DIR / path.name
    if not gate.is_file():
        return None
    return numbered(table(gate.read_text(encoding="utf-8", errors="replace").splitlines()))


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
        "properties": numbered(table(section(text, "Properties"))),
        "gate": gate_of(path),
        "origin": path.name,
        "path": str(path),
    }


def adrs(dirpath: Path) -> list[dict[str, object]]:
    return [load(f) for f in sorted(dirpath.glob("[0-9]*.md")) if f.is_file()]


def rules(records: list[dict[str, object]]) -> list[dict[str, str]]:
    out = []
    for a in records:
        for n, row in a["properties"].items():  # type: ignore[union-attr]
            out.append({
                "id": f"{a['adr']}/P{n}",
                "adr": str(a["adr"]),
                "property": f"P{n}",
                "kind": str(a["kind"]),
                "source": str(a["source"]),
                "status": str(a["status"]),
                "title": str(a["title"]),
                "rule": row.get("Property", ""),
                "origin": str(a["origin"]),
                "path": str(a["path"]),
            })
    return out


def problems(records: list[dict[str, object]]) -> list[str]:
    out = []
    for a in records:
        where = f"{a['adr']}  {a['path']}"
        kind = str(a["kind"])
        if a["status"] not in STATUSES:
            out.append(f"{where}: status {a['status']!r} is not proposed or approved")
        if a["has_question"]:
            out.append(f"{where}: has a ## Question section; an open question lives in QUESTIONS.md")
        if kind not in KINDS:
            out.append(f"{where}: kind {kind!r} is not architecture or feature")
        live = a["properties"]
        if not live:
            out.append(f"{where}: no Property, so it gives no rule")
        if len(live) > MAX_PROPERTIES:
            out.append(f"{where}: {len(live)} Properties, at most {MAX_PROPERTIES}; split the ADR or move the rest to the spec")
        if a["todo"]:
            out.append(f"{where}: has a todo: key; an ADR binds every TODO, so a choice inside one TODO goes in that TODO")
        out += [f"{where}: {p}" for p in table_problems(live)]  # type: ignore[arg-type]
        out += [f"{where}: {p}" for p in gate_problems(live, a["gate"])]  # type: ignore[arg-type]
    return out


def table_problems(live: dict[int, dict[str, str]]) -> list[str]:
    out = []
    seen_new = False
    for n, row in live.items():
        text = row.get("Property", "")
        mark = MARK.match(text)
        if not mark:
            out.append(f"P{n} does not start with [keep] or [new]")
        elif mark.group(1) == "new":
            seen_new = True
        elif seen_new:
            out.append(f"P{n} is [keep] after a [new] row; list the [keep] rows first")
        if len(text.split()) > MAX_PROPERTY_WORDS:
            out.append(f"P{n} has {len(text.split())} words, at most {MAX_PROPERTY_WORDS}")
        evidence = EVIDENCE.search(text)
        if evidence:
            out.append(f"P{n} carries evidence {evidence.group(0)!r}; move it to the decision paragraph")
        if not row.get("If broken"):
            out.append(f"P{n} has an empty If broken cell")
        if row.get("Recovers by") not in RECOVERIES:
            out.append(f"P{n} Recovers by {row.get('Recovers by')!r} is not {', '.join(RECOVERIES)}")
    return out


def gate_problems(live: dict[int, dict[str, str]], gate: dict[int, dict[str, str]] | None) -> list[str]:
    if gate is None:
        return [f"no Property gate file {GATE_DIR}/<same file name>"]
    out = [f"gate row P{n} has no live Property" for n in sorted(set(gate) - set(live))]
    for n in live:
        row = gate.get(n)
        if row is None:
            out.append(f"P{n} has no Property gate row")
            continue
        empty = [c for c in GATE_CELLS if not row.get(c)]
        if empty:
            out.append(f"P{n} gate row has empty {', '.join(empty)}")
        theorem = row.get("Theorem", "")
        if theorem and not (QUANTIFIER.search(theorem) and "→" in theorem):
            out.append(f"P{n} gate Theorem needs a ∀ or ∃ quantifier and a → hypothesis")
        if row.get("Verdict") not in (None, "", "Pass"):
            out.append(f"P{n} gate Verdict is {row.get('Verdict')!r}, not Pass; rewrite or move the Property")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="wm-constraints.py",
        description="The rules a wm corpus obeys: one per Property of a live ADR.",
        epilog="Tool index — every .notes tool and its flags: wm:TOOLS.md",
    )
    ap.add_argument("dir", nargs="?", help=f"adr dir or notes dir (default: first of {', '.join(DEFAULT_DIRS)})")
    ap.add_argument("-m", "--match", help="case-insensitive regex over rule id, rule text, ADR title, file name")
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
        auto = " [auto]" if r["source"] == "auto" else ""
        proposed = " [proposed]" if r["status"] != "approved" else ""
        print(f"| {r['id']} | {r['rule']}{auto}{proposed} | [{r['adr']}]({r['origin']}) |")
    print()
    print(f"{len(rows)} rule(s) from {dirpath}. Every one binds the code. `[auto]` means no operator was asked: read those first.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

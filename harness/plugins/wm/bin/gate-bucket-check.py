#!/usr/bin/env python3
"""Move each misfiled Failure of a comment or name gate report to Nits, and fix the Result line.

A haiku gate files a nit rule under Failures, and each such row costs one fixup round.
The bucket is a property of the rule, so this script decides it and the gate does not.

Usage: gate-bucket-check.py <report.md> [--gate comment|name]
Rewrites the report in place. Prints the Result line and the moved count.
Exit 0 on PASS, 1 on FAIL, 2 on a report it cannot read.
"""

import re
import sys
from pathlib import Path

COMMENT_FAILURE_RULES = (
    "deletion test", "repeats the code", "narrates the code", "the ban", "task link",
    "ticket", "spec slug", "named version", "restated platform", "stale fact", "claudism",
)
COMMENT_NIT_RULES = (
    "property test", "paragraph test", "framing", "sentence shape", "sixty", "60-word",
    "word cap", "twenty-five", "25 words", "one fact per sentence", "backward reference",
    "em-dash", "subject in the first", "lead with the constraint", "gloss",
    "simple technical english", "b1", "active voice", "present tense", "common word",
    "grammatical",
)
NAME_FAILURE_SMELLS = (
    "lying name", "missing unit", "boundary unclear", "negated", "double-negative",
    "non-predicate boolean", "synonym drift", "homonym",
)
NAME_NIT_SMELLS = (
    "vague qualifier", "technical term", "abbreviation", "type-encoded", "hungarian",
    "collection number", "cardinality", "tense", "pass both gates",
)
RESULT = re.compile(r"Result:\s*\**\s*(PASS|FAIL)")


def gate_of(text: str) -> str:
    if "[COMMENT]" in text:
        return "comment"
    if "[NAME]" in text:
        return "name"
    return ""


def fields(row: str) -> list[str]:
    return [f.strip(" *`") for f in row.lstrip("- ").split(" — ")]


def has_any(text: str, keys: tuple[str, ...]) -> bool:
    low = text.lower()
    return any(k in low for k in keys)


def is_nit(row: str, gate: str) -> bool:
    parts = fields(row)
    if gate == "comment":
        rule = parts[1] if len(parts) > 1 else ""
        return not has_any(rule, COMMENT_FAILURE_RULES) and has_any(rule, COMMENT_NIT_RULES)
    smell = parts[2] if len(parts) > 2 else ""
    return not has_any(smell, NAME_FAILURE_SMELLS) and has_any(smell, NAME_NIT_SMELLS)


def split_rows(section: list[str]) -> tuple[list[str], list[list[str]]]:
    head, rows = [], []
    for line in section:
        if line.startswith("- "):
            rows.append([line])
        elif rows and line.strip() and line.startswith((" ", "\t")):
            rows[-1].append(line)
        elif not rows:
            head.append(line)
    return head, rows


def find_section(lines: list[str], title: str) -> tuple[int, int]:
    start = next((i for i, l in enumerate(lines) if l.startswith(f"## {title}")), -1)
    if start < 0:
        return -1, -1
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    return start, end


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__.strip())
        return 2
    path = Path(args[0])
    try:
        text = path.read_text()
    except OSError as err:
        print(f"gate-bucket-check: cannot read {path}: {err}")
        return 2
    gate = args[2] if len(args) > 2 and args[1] == "--gate" else gate_of(text)
    if gate not in ("comment", "name"):
        print(f"gate-bucket-check: {path} is neither a [COMMENT] nor a [NAME] report")
        return 2

    lines = text.split("\n")
    fs, fe = find_section(lines, "Failures")
    kept, moved = [], []
    if fs >= 0:
        _, rows = split_rows(lines[fs + 1:fe])
        for row in rows:
            (moved if is_nit(row[0], gate) else kept).append(row)

    if moved:
        failures = [lines[fs], *[l for r in kept for l in r], ""] if kept else []
        lines[fs:fe] = failures
        ns, ne = find_section(lines, "Nits")
        tagged = [l for r in moved for l in [r[0] + " (moved from Failures: nit rule)", *r[1:]]]
        if ns < 0:
            lines += ["## Nits           (optional, non-blocking)", *tagged, ""]
        else:
            body_end = ne
            while body_end > ns + 1 and not lines[body_end - 1].strip():
                body_end -= 1
            lines[body_end:body_end] = tagged

    verdict = "FAIL" if kept else "PASS"
    out = RESULT.sub(f"Result: {verdict}", "\n".join(lines), count=1)
    path.write_text(out)
    print(f"Result: {verdict}\nmoved: {len(moved)}")
    return 1 if kept else 0


if __name__ == "__main__":
    sys.exit(main())

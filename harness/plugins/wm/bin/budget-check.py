#!/usr/bin/env python3
"""Count a wm spec artifact against the budgets its skill states, and name the split.

The budgets are written as prose and as checklist rows in `arch:sub-todo.md`,
`arch:tpl-todo.md` and `arch:ref-write.md`. A checklist row is ticked by the model that
wrote the file, so a body can pass review at three times its budget. This script is the
same rule, counted.

Checked, by file kind:

  todos/TODO-N.md   body <= 512 lines            (arch:sub-todo.md - Budget)
                    <= 10 increments             (arch:sub-todo.md - Sizing)
                    each diff <= 150 changed lines, unless the increment declares a
                    `**Compile floor:**` and stubs what it defers
                    ## Components <= 5 rows, when the section is present
                    ## Changes is an increment sequence at all

  spec.md           <= 200 lines                 (arch:ref-write.md - Spec-Readiness)

Every message names the remedy the skill states, which is always to split - never to
compress, and never to raise the budget.

usage: budget-check.py <file>
Exit code: 0 within budget or not a checked file - 1 over budget - 2 unreadable.
"""
import os
import re
import sys

TODO_BODY_LINES = 512
SPEC_LINES = 200
MAX_INCREMENTS = 10
MAX_DIFF_LINES = 150
MAX_COMPONENT_ROWS = 5

H2 = re.compile(r"^## +(.+?)\s*$")
INCREMENT = re.compile(r"^### +(\d+)\. +(.+?)\s*$")
DIFF_OPEN = re.compile(r"^```diff\s*$")
COMPILE_FLOOR = re.compile(r"^\s*[-*]\s*\*\*Compile floor:?\*\*")
STUB_MARKER = re.compile(r"AGENT:\s*implement in increment\s+(\d+)")
TABLE_ROW = re.compile(r"^\|")
TABLE_RULE = re.compile(r"^\|[\s:|-]+\|?\s*$")


def strip_frontmatter(lines):
    """The body is what a budget counts - the YAML block above it is not prose."""
    if not lines or lines[0].strip() != "---":
        return lines
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return lines[i + 1 :]
    return lines


def sections(lines):
    """Map every H2 title to its line span, so a count can be scoped to one section."""
    found = {}
    current, start = None, 0
    for i, line in enumerate(lines):
        m = H2.match(line)
        if not m:
            continue
        if current is not None:
            found[current] = (start, i)
        current, start = m.group(1), i + 1
    if current is not None:
        found[current] = (start, len(lines))
    return found


def diff_blocks(lines):
    """Yield (owning_increment, changed_line_count, at_compile_floor, stub_count) per ```diff.

    The increment is what the author has to split, so it is what the message names. An
    increment may exceed the diff budget when the smallest change that still compiles is
    larger than it - the repo building is an invariant, the budget is not. That case must
    declare itself with a `**Compile floor:**` bullet, or the gate cannot tell it apart from
    an increment nobody split. A floor with no stubs has not been found, only asserted.
    """
    owner = "the increment before any `### n.` heading"
    floor = False
    i = 0
    while i < len(lines):
        m = INCREMENT.match(lines[i])
        if m:
            owner = f"increment {m.group(1)} ({m.group(2)})"
            floor = False
            i += 1
            continue
        if COMPILE_FLOOR.match(lines[i]):
            floor = True
            i += 1
            continue
        if not DIFF_OPEN.match(lines[i]):
            i += 1
            continue
        changed = 0
        stubs = 0
        i += 1
        while i < len(lines) and not lines[i].strip().startswith("```"):
            line = lines[i]
            if line.startswith(("+++", "---")):
                i += 1
                continue
            if line.startswith(("+", "-")):
                changed += 1
                if STUB_MARKER.search(line):
                    stubs += 1
            i += 1
        yield owner, changed, floor, stubs
        i += 1


def check_todo(lines, violations):
    body = strip_frontmatter(lines)
    if len(body) > TODO_BODY_LINES:
        violations.append(
            f"body is {len(body)} lines, budget is {TODO_BODY_LINES} "
            f"({len(body) / TODO_BODY_LINES:.1f}x over). Over budget means the TODO carries "
            "more than one deliverable: split it into two ledger rows (TODO-N.1, TODO-N.2). "
            "Never shrink the diffs, drop the Autotest, or compress the prose to fit."
        )

    found = sections(body)
    if "Changes" not in found:
        return

    start, end = found["Changes"]
    changes = body[start:end]
    increments = [m for m in (INCREMENT.match(x) for x in changes) if m]

    # A `## Changes` with no `### n.` heading is a format question, not a budget one - the
    # `verify` audit and the pre-save checklist own it. Counting is silent where there is
    # nothing to count, so this gate only ever reports a real overrun.
    if not increments:
        pass
    elif len(increments) > MAX_INCREMENTS:
        violations.append(
            f"`## Changes` has {len(increments)} increments, budget is {MAX_INCREMENTS}. "
            "The TODO is too big: split the TODO."
        )
    else:
        numbers = [int(m.group(1)) for m in increments]
        if numbers != list(range(1, len(numbers) + 1)):
            violations.append(
                f"increment numbers are {numbers} - they must run contiguously from 1."
            )

    for owner, changed, floor, stubs in diff_blocks(changes):
        if changed <= MAX_DIFF_LINES:
            continue
        if not floor:
            violations.append(
                f"the diff in {owner} changes {changed} lines, budget is "
                f"{MAX_DIFF_LINES}. Split the increment - or, if {MAX_DIFF_LINES} lines cannot "
                "compile, cut it down to the smallest change that does and add a "
                "`**Compile floor:**` bullet saying why."
            )
        elif stubs == 0:
            violations.append(
                f"{owner} declares a **Compile floor** at {changed} lines but stubs nothing. "
                "A floor takes only what the compiler demands: stub every body you can and "
                "mark each one `AGENT: implement in increment <n>`. With no stub, this is an "
                "unsplit increment with a reason attached."
            )

    if "Components" in found:
        c_start, c_end = found["Components"]
        rows = [
            x
            for x in body[c_start:c_end]
            if TABLE_ROW.match(x) and not TABLE_RULE.match(x)
        ]
        # the header row is not a component
        if len(rows) - 1 > MAX_COMPONENT_ROWS:
            violations.append(
                f"`## Components` has {len(rows) - 1} rows, budget is "
                f"{MAX_COMPONENT_ROWS}. A component that fits no brick owns more than one "
                "responsibility: split it."
            )


def check_spec(lines, violations):
    body = strip_frontmatter(lines)
    if len(body) > SPEC_LINES:
        violations.append(
            f"spec.md is {len(body)} lines, budget is {SPEC_LINES} "
            f"({len(body) / SPEC_LINES:.1f}x over). Move detail to `thoughts/` or split "
            "the spec. Never shrink the ledger."
        )


def kind_of(path):
    """Only a wm notes artifact is checked - any other spec.md in the repo is not ours."""
    base = os.path.basename(path)
    d = os.path.dirname(os.path.abspath(path))
    if os.path.basename(d) == "todos" and base.startswith("TODO-") and base.endswith(".md"):
        return "todo"
    if base == "spec.md" and (
        os.path.isdir(os.path.join(d, "thoughts")) or os.path.isdir(os.path.join(d, "todos"))
    ):
        return "spec"
    return None


def main():
    if len(sys.argv) < 2:
        print(__doc__.strip().splitlines()[-2], file=sys.stderr)
        return 2

    path = sys.argv[1]
    kind = kind_of(path)
    if kind is None:
        return 0

    try:
        with open(path, "r") as f:
            lines = f.read().splitlines()
    except OSError as e:
        print(f"budget-check: cannot read {path}: {e}", file=sys.stderr)
        return 2

    violations = []
    if kind == "todo":
        check_todo(lines, violations)
    else:
        check_spec(lines, violations)

    if not violations:
        return 0

    print(f"{path} is over budget:")
    for v in violations:
        print(f"  - {v}")
    return 1


if __name__ == "__main__":
    sys.exit(main())

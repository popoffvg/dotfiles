#!/usr/bin/env python3
"""Count a wm spec artifact against the budgets its skill states, and name the split.

The budgets are written as prose and as checklist rows in `arch:sub-todo.md`,
`arch:examples/todo.md`, `arch:examples/todo-agent.md` and `arch:ref-write.md`. A checklist row is
ticked by the model that wrote the file, so a body can pass review at three times its
budget. This script is the same rule, counted.

One ledger row is three files split by audience: the human half, the agent half, and the
test file (`arch:sub-todo.md` § One ledger row, three files). The rules both halves obey live outside the pair, in `thoughts/`, and are
printed by `wm-constraints.py` - there is no rules file to check. Each file is checked against its own budgets, and each is checked for
sections that belong to another - a misplaced section means the split was never made.

Checked, by file kind:

  todos/TODO-N.md         human half - carries every diff, one per increment, in
                          ## Increments
                          ## Autotest is not here - it is the test file's
                          body <= 200 lines            (arch:sub-todo.md - Budget)
                          ## New terms, ## Components and ## Increments are UNCOUNTED -
                          the rosters are unlimited, the increments are counted by shape
                          increments numbered `### <c>.<i>.`, both contiguous from 1
                          each commit's increments end with `---` and `### Commit <c>`,
                          which carries **Title:**, **Body:** and **Proves:**
                          <= 4 commits, <= 10 increments per commit
                          no `## Commit` H2 - each commit has its own H3
                          each increment carries a **Surprises:** bullet
                          each increment carries a non-empty **Extends:** bullet
                          each increment diff <= 150 changed lines, unless that
                          increment declares a `**Compile floor:**`
                          no ```diff outside ## Increments
                          no agent-half section present (Constraints, Changes, Files,
                          Pre-reads, Manual test, Gotchas)

  todos/TODO-N.agent.md   agent half - NO line budget, by design
                          NO ```diff block anywhere - every diff is in an increment
                          of the human half's ## Increments
                          no frontmatter (status lives in the human half alone)
                          no human-half section present (Outcome, New terms,
                          Components, Increments, Autotest, Commit)
                          no ## Constraints - todos/CLAUDE.md names wm-constraints.py

  todos/TODO-N.test.md    test file - ## Autotest alone, NO line budget, by design
                          no frontmatter
                          no section that belongs to either half

  spec.md                 <= 200 lines                 (arch:ref-write.md - Spec-Readiness)

Not checked here: whether a diff carries a BODY rather than a surface (a shell script, a
function body, a fixture - `arch:sub-todo.md` § A diff carries the surface, not a body).
That is a judgment, not a count; it is graded by `wm:evals/` and audited by `/code verify`.
This script counts only what is countable, so every message it prints is a real overrun.

Every message names the remedy the skill states, which is always to split or to move -
never to compress, and never to raise the budget.

usage: budget-check.py <file>
Exit code: 0 within budget or not a checked file - 1 over budget - 2 unreadable.
Tool index — every .notes tool and its flags: wm:TOOLS.md
"""
import os
import re
import sys

TODO_HUMAN_LINES = 200
SPEC_LINES = 200
MAX_INCREMENTS = 10
MAX_COMMITS = 4
MAX_DIFF_LINES = 150

# Rosters, not prose: one row per term and one per symbol. A TODO that legitimately touches
# many symbols is not two deliverables, so neither section is counted against the body budget.
# `## Increments` is bounded by its commit and increment counts instead (`arch:sub-todo.md` - Budget).
UNCOUNTED_SECTIONS = ("New terms", "Components", "Increments")

# Which half owns each H2. A heading found in the other half is the whole finding: the
# author wrote one file where the contract asks for two.
HUMAN_SECTIONS = {
    "Outcome",
    "New terms",
    "Components",
    "Increments",
    "Surface",
    "Flow changes",
    "Commit",
    "Deviations",
}
TEST_SECTIONS = {"Autotest"}
AGENT_SECTIONS = {
    "Constraints",
    "Changes",
    "Files",
    "Pre-reads",
    "Pre-reads (MUST read before editing)",
    "Manual test",
    "Gotchas",
}

H2 = re.compile(r"^## +(.+?)\s*$")
INCREMENT = re.compile(r"^### +(\d+)\.(\d+)\. +(.+?)\s*$")
ONE_LEVEL_INCREMENT = re.compile(r"^### +(\d+)\. +(.+?)\s*$")
COMMIT_HEAD = re.compile(r"^### +Commit +(\d+)\s*$")
COMMIT_FIELD = re.compile(r"^\*\*(Title|Body|Proves):\*\*")
RULE_LINE = re.compile(r"^-{3,}\s*$")
DIFF_OPEN = re.compile(r"^```diff\s*$")
COMPILE_FLOOR = re.compile(r"^\s*[-*]\s*\*\*Compile floor:?\*\*")
SURPRISES_BULLET = re.compile(r"^\s*[-*]\s*\*\*Surprises:?\*\*")
EXTENDS_BULLET = re.compile(r"^\s*[-*]\s*\*\*Extends:?\*\*\s*\S")
WIKILINK = re.compile(r"\[\[([^\]|]+?)\s*(?:\|[^\]]*)?\]\]")
# A doc origin: a markdown link plus the `read <date>` that pins which version was used.
READ_DATE = re.compile(r"\bread\s+\d{4}-\d{2}-\d{2}")
MD_LINK = re.compile(r"\[[^\]]+\]\([^)]+\)")


def has_frontmatter(lines):
    return bool(lines) and lines[0].strip() == "---"


def strip_frontmatter(lines):
    """The body is what a budget counts - the YAML block above it is not prose."""
    if not has_frontmatter(lines):
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


def misplaced(found, wrong_sections, here, there):
    """One violation per section written into the wrong file of the row."""
    out = []
    for name in found:
        if name in wrong_sections:
            out.append(
                f"`## {name}` belongs in the {there}, not the {here}. One ledger row is "
                "three files, each with its own reader: move the section to the file "
                "that owns it and leave a link, never a copy (`arch:sub-todo.md` § Required "
                "elements)."
            )
    return out


def diff_blocks(lines):
    """Yield (changed_line_count, at_compile_floor) per ```diff in one increment.

    An increment may exceed the diff budget when the smallest surface that still compiles is
    larger than it. That case must declare itself with a `**Compile floor:**` bullet, or the
    gate cannot tell it apart from a diff carrying a body nobody removed.
    """
    floor = any(COMPILE_FLOOR.match(x) for x in lines)
    i = 0
    while i < len(lines):
        if not DIFF_OPEN.match(lines[i]):
            i += 1
            continue
        changed = 0
        i += 1
        while i < len(lines) and not lines[i].strip().startswith("```"):
            line = lines[i]
            if line.startswith(("+", "-")) and not line.startswith(("+++", "---")):
                changed += 1
            i += 1
        yield changed, floor
        i += 1


def h3_spans(lines):
    """Yield (kind, match, start, end) for each increment or commit H3 in an Increments section.

    kind is "increment" or "commit"; a block ends at the next H3 of either kind.
    """
    marks = []
    for i, x in enumerate(lines):
        m = INCREMENT.match(x)
        if m:
            marks.append(("increment", m, i))
            continue
        m = COMMIT_HEAD.match(x)
        if m:
            marks.append(("commit", m, i))
    for k, (kind, m, i) in enumerate(marks):
        end = marks[k + 1][2] if k + 1 < len(marks) else len(lines)
        yield kind, m, i, end


def check_commits(section, violations):
    """Increments `<c>.<i>` grouped into commits, each closed by `---` and `### Commit <c>`."""
    groups, open_group = [], None
    for kind, m, start, end in h3_spans(section):
        if kind == "increment":
            c, i = int(m.group(1)), int(m.group(2))
            if open_group is None or open_group["c"] != c:
                if open_group is not None:
                    violations.append(
                        f"commit {open_group['c']} has no `### Commit {open_group['c']}` section "
                        f"before increment {c}.{i}. Close each commit's increments with a `---` "
                        "line and its `### Commit <c>` section (`arch:examples/todo.md` - Increments)."
                    )
                    groups.append(open_group)
                open_group = {"c": c, "inc": []}
            open_group["inc"].append(i)
            continue
        c = int(m.group(1))
        if open_group is None:
            violations.append(f"`### Commit {c}` closes no increments - delete it or move it after them.")
            continue
        if c != open_group["c"]:
            violations.append(
                f"`### Commit {c}` closes the increments of commit {open_group['c']} - "
                "number it after the increments it closes."
            )
        before = [x for x in section[:start] if x.strip()]
        if not before or not RULE_LINE.match(before[-1]):
            violations.append(f"`### Commit {c}` has no `---` line right before it.")
        fields = {f.group(1) for f in (COMMIT_FIELD.match(x) for x in section[start:end]) if f}
        for name in ("Title", "Body", "Proves"):
            if name not in fields:
                violations.append(
                    f"`### Commit {c}` carries no **{name}:** line. A commit section has a Title, "
                    "a Body, and a Proves line (`arch:examples/todo.md` - Increments)."
                )
        groups.append(open_group)
        open_group = None
    if open_group is not None:
        violations.append(
            f"the increments of commit {open_group['c']} end with no `### Commit "
            f"{open_group['c']}` section. Close them with a `---` line and the section."
        )
        groups.append(open_group)

    commits = [g["c"] for g in groups]
    if commits != list(range(1, len(commits) + 1)):
        violations.append(f"commit numbers are {commits} - they must run contiguously from 1.")
    if len(commits) > MAX_COMMITS:
        violations.append(
            f"`## Increments` has {len(commits)} commits, budget is {MAX_COMMITS}. The TODO is "
            "too big: split the ledger row."
        )
    for g in groups:
        if len(g["inc"]) > MAX_INCREMENTS:
            violations.append(
                f"commit {g['c']} has {len(g['inc'])} increments, budget is {MAX_INCREMENTS}. "
                "Cut a second commit, or split the ledger row. Do not merge increments."
            )
        if g["inc"] != list(range(1, len(g["inc"]) + 1)):
            violations.append(
                f"the increments of commit {g['c']} are numbered {g['inc']} - they must run "
                "contiguously from 1."
            )


def counted_length(body, found):
    """Body lines the budget counts - the unlimited rosters are excluded."""
    skipped = 0
    for name in UNCOUNTED_SECTIONS:
        if name in found:
            start, end = found[name]
            skipped += end - start + 1
    return len(body) - skipped


def check_todo_human(lines, violations, path):
    body = strip_frontmatter(lines)
    found = sections(body)
    counted = counted_length(body, found)
    if counted > TODO_HUMAN_LINES:
        violations.append(
            f"the human half is {counted} counted lines, budget is {TODO_HUMAN_LINES} "
            f"({counted / TODO_HUMAN_LINES:.1f}x over; `## New terms`, `## Components` and "
            "`## Increments` are not counted). This budget is a ceiling, set far above what "
            "Outcome and Flow changes need on a real row - so reaching it means the ledger "
            "row carries two deliverables. Split the ledger row. Never compress the prose to "
            "fit, and never move content to the agent half: the halves are split by "
            "audience, not by size."
        )

    violations.extend(
        misplaced(found, AGENT_SECTIONS, "human half", "agent half (`TODO-N.agent.md`)")
    )
    violations.extend(
        misplaced(found, TEST_SECTIONS, "human half", "test file (`TODO-N.test.md`)")
    )
    if "Commit" in found:
        violations.append(
            "the human half carries a `## Commit` section. Each commit has its own "
            "`### Commit <c>` section inside `## Increments`, after a `---` line that closes "
            "its increments (`arch:examples/todo.md` - Increments)."
        )
    if "Surface" in found:
        violations.append(
            "the human half carries a `## Surface` section. The diff is split by increment: "
            "each `### <c>.<i>.` under `## Increments` carries the part of the diff it lands "
            "(`arch:sub-todo.md` - Increments). Move each diff under its increment."
        )

    i_start, i_end = found.get("Increments", (0, 0))
    stray = sum(
        1 for k, x in enumerate(body) if DIFF_OPEN.match(x) and not i_start <= k < i_end
    )
    if stray:
        violations.append(
            f"the human half carries {stray} ```diff block(s) outside `## Increments`. Every "
            "diff belongs to the increment that lands it (`arch:sub-todo.md` - Increments)."
        )

    if "Increments" not in found:
        violations.append(
            "the human half has no `## Increments`. It is the section the reviewer approves: "
            "an ordered increment sequence, numbered `<c>.<i>`, each with its own diff, "
            "grouped into commits "
            "(`arch:sub-todo.md` - Increments)."
        )
        return

    section = body[i_start:i_end]
    for x in section:
        m = ONE_LEVEL_INCREMENT.match(x)
        if m:
            violations.append(
                f"increment `### {m.group(1)}. {m.group(2)}` has a one-level number. Number "
                "each increment `<c>.<i>` - its commit, then its place in that commit."
            )
    check_commits(section, violations)
    increments = [
        (f"{m.group(1)}.{m.group(2)}", m.group(3), start, end)
        for kind, m, start, end in h3_spans(section) if kind == "increment"
    ]

    for number, title, start, end in increments:
        block = section[start:end]
        if not any(SURPRISES_BULLET.match(x) for x in block):
            violations.append(
                f"increment {number} ({title}) carries no **Surprises:** bullet. List one to "
                "three details a reader would otherwise find only in the code, or "
                "`none — <reason>` (`arch:examples/todo.md` - Increments)."
            )
        if not any(EXTENDS_BULLET.match(x) for x in block):
            violations.append(
                f"increment {number} ({title}) carries no **Extends:** bullet. Name the existing "
                "symbol this increment grows, or write `new — checked <A>, <B>: <why none fits>` "
                "(`arch:examples/todo.md` - Increments)."
            )
        for changed, floor in diff_blocks(block):
            if changed <= MAX_DIFF_LINES or floor:
                continue
            violations.append(
                f"the diff of increment {number} ({title}) changes {changed} lines, budget "
                f"is {MAX_DIFF_LINES}. First check for a body - a function body, loop, shell "
                "script, query, or fixture is never surface, and deleting one usually takes "
                "the increment under the budget on its own (`arch:sub-todo.md` - A diff "
                "carries the surface, not a body). If every line is real surface, split the "
                "increment, or add a `**Compile floor:**` bullet under its diff saying why."
            )


def check_todo_agent(lines, violations, path):
    # No line budget by design: ten increments at their compile floor is a long file, and
    # the size that matters here is the increment, not the file.
    if has_frontmatter(lines):
        violations.append(
            "the agent half carries a `---` frontmatter block. The pair has one `status`, "
            "in `TODO-N.md` - a status written twice is a status that disagrees with itself "
            "(`arch:ref-write.md` § Status). Delete the block."
        )

    body = strip_frontmatter(lines)
    found = sections(body)
    violations.extend(
        misplaced(found, HUMAN_SECTIONS, "agent half", "human half (`TODO-N.md`)")
    )
    violations.extend(
        misplaced(found, TEST_SECTIONS, "agent half", "test file (`TODO-N.test.md`)")
    )
    if "Constraints" in found:
        violations.append(
            "the agent half carries `## Constraints`. Delete it: `todos/CLAUDE.md` names "
            "`~/.claude/scripts/wm-constraints.py` once, so no TODO file repeats the command."
        )

    diffs = sum(1 for x in body if DIFF_OPEN.match(x))
    if diffs:
        violations.append(
            f"the agent half carries {diffs} ```diff block(s). It must carry none: every diff "
            "lives in `TODO-N.md` `## Increments`, under the increment that lands it, where "
            "the human approves it (`arch:sub-todo.md` - Increments)."
        )

    if "Changes" in found:
        violations.append(
            "the agent half carries `## Changes`. The increments live in `TODO-N.md` "
            "`## Increments`, each with its own diff; the agent half maps them to paths in "
            "`## Files` (`arch:sub-todo.md` - Increments)."
        )


def check_todo_test(lines, violations, path):
    # No line budget by design: one case per promise the Outcome makes, however many.
    if has_frontmatter(lines):
        violations.append(
            "the test file carries a `---` frontmatter block. `status` lives in `TODO-N.md` "
            "alone (`arch:ref-write.md` § Status). Delete the block."
        )
    found = sections(strip_frontmatter(lines))
    violations.extend(misplaced(found, HUMAN_SECTIONS, "test file", "human half (`TODO-N.md`)"))
    violations.extend(misplaced(found, AGENT_SECTIONS, "test file", "agent half (`TODO-N.agent.md`)"))


def check_spec(lines, violations, path):
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
    if os.path.basename(d) == "todos" and base.startswith("TODO-"):
        if base.endswith(".agent.md"):
            return "todo-agent"
        if base.endswith(".test.md"):
            return "todo-test"
        if base.endswith(".md"):
            return "todo"
        return None
    if base == "spec.md" and (
        os.path.isdir(os.path.join(d, "thoughts")) or os.path.isdir(os.path.join(d, "todos"))
    ):
        return "spec"
    return None


CHECKS = {
    "todo": check_todo_human,
    "todo-agent": check_todo_agent,
    "todo-test": check_todo_test,
    "spec": check_spec,
}


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
    CHECKS[kind](lines, violations, path)

    if not violations:
        return 0

    print(f"{path} is over budget:")
    for v in violations:
        print(f"  - {v}")
    return 1


if __name__ == "__main__":
    sys.exit(main())

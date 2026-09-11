#!/usr/bin/env python3
"""Migrate a single-file wm TODO body into the TODO pair the contract now defines.

`arch:sub-todo.md` § One ledger row, two files splits every TODO by audience. This script
performs that cut on a body written before the split:

  todos/TODO-N.md         Outcome, New terms,      the human's gate read, walked with the
                          Components, Surface,     repo closed; the 550-line budget is
                          Autotest, Commit         counted on it. `Surface` is the one diff
                                                   in the pair and STAYS here.

  todos/TODO-N.agent.md   Constraints, Changes     the implementer's half; no line budget,
                          (the increments), Files, no frontmatter — `status` stays in the
                          Pre-reads, Manual test,  human half, since a status written
                          Definition of done       twice disagrees with itself

Why a script and not a one-off edit: the cut is mechanical, it is the same cut for every
row in the ledger, and doing it by hand on a long markdown file silently drops a section.
Idempotent — re-running on an already-split body is a no-op.

What this does NOT do: turn the increments into prose. A pre-split `## Changes` carries a
```diff per increment, and the contract now puts the diff in the human half's `## Surface`
while an increment says only what to do. This script moves the section; a human or a `todo`
re-author has to hoist the surface out of those diffs and replace each with a **Do:** bullet.
The `budget-check` hook will block the migrated agent half until that happens - by design,
since a silent pass would leave the diff in the wrong half. Run `/code verify` after, which
also catches the bodies a pre-split diff often pasted.

usage: wm-todo-split-agent.py <todos/TODO-N.md> [more...] [--dry-run]
Exit: 0 split or already split - 1 nothing to move / bad input - 2 unreadable.
Tool index — every .notes tool and its flags: wm:TOOLS.md
"""
import re
import sys
from pathlib import Path

# The agent half's elements, in the order sub-todo.md lists them. `Constraints` leads
# because it bounds every increment below it; `Changes` is the section the half exists for,
# and the reason the half has no line budget.
AGENT_SECTIONS = (
    "Constraints",
    "Changes",
    "Files",
    "Pre-reads",
    "Manual test",
    "Definition of done",
)

H2 = re.compile(r"^## +(.+?)\s*$")
# The pre-split template drew the cut as an HTML comment between Commit and Files. Once the
# sections below it are gone the marker points at nothing, so it goes with them.
SCAFFOLD_MARKER = re.compile(r"^<!--.*scaffolding.*-->\s*$", re.IGNORECASE)


def is_agent_heading(title: str) -> bool:
    """`Pre-reads (MUST read before editing)` must match on its stem."""
    return any(title == s or title.startswith(s) for s in AGENT_SECTIONS)


def split(text: str):
    """Return (human_text, agent_body, moved_titles). Frontmatter stays with the human half."""
    lines = text.splitlines()
    spans, current, start = [], None, 0
    for i, line in enumerate(lines):
        m = H2.match(line)
        if not m:
            continue
        if current is not None:
            spans.append((current, start, i))
        current, start = m.group(1), i
    if current is not None:
        spans.append((current, start, len(lines)))

    keep_mask = [not SCAFFOLD_MARKER.match(l) for l in lines]
    agent_chunks, moved = [], []
    for title, s, e in spans:
        if not is_agent_heading(title):
            continue
        moved.append(title)
        agent_chunks.append("\n".join(lines[s:e]).rstrip())
        for j in range(s, e):
            keep_mask[j] = False

    human = "\n".join(l for l, k in zip(lines, keep_mask) if k).rstrip() + "\n"
    return human, "\n\n".join(agent_chunks).rstrip() + "\n", moved


def main(argv):
    dry = "--dry-run" in argv
    paths = [Path(a) for a in argv if not a.startswith("--")]
    if not paths:
        print(__doc__.strip().splitlines()[-2], file=sys.stderr)
        return 1

    rc = 0
    for path in paths:
        try:
            text = path.read_text()
        except OSError as exc:
            print(f"{path}: unreadable: {exc}", file=sys.stderr)
            return 2

        agent_path = path.with_suffix(".agent.md")
        human, agent_body, moved = split(text)
        if not moved:
            state = "already split" if agent_path.exists() else "nothing to move"
            print(f"{path}: {state}")
            rc = rc or (0 if agent_path.exists() else 1)
            continue

        title = path.stem
        # Both link lines are verbatim from arch:tpl-todo.md / arch:tpl-todo-agent.md —
        # one link per half, and no second copy of anything.
        pointer = f"\n---\n\n**Increments:** [{agent_path.name}]({agent_path.name})\n"
        header = (
            f"# {title} — increments\n\n"
            f"**Design:** [{path.name}]({path.name}) — Outcome, Components, Autotest, "
            f"Commit.\n\n"
        )

        if dry:
            print(f"{path}: would move {', '.join(moved)} -> {agent_path.name}")
            continue

        path.write_text(human + pointer)
        agent_path.write_text(header + agent_body)
        print(f"{path}: moved {', '.join(moved)} -> {agent_path.name}")
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

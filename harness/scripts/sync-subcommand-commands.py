#!/usr/bin/env python3
"""Write one command file per row of every router's `<router>:help.md` roster.

The roster table is the only list of a router's subcommands; this script derives
`commands/<router>:<sub>.md` from it and deletes the derived files whose row is gone.
A command file without the `generated-by` key is hand-written and never touched.

Usage: sync-subcommand-commands.py [--check]
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "plugins"
MARKER = "generated-by: harness/scripts/sync-subcommand-commands.py"
ROSTER_HEADERS = {"subcommand", "mode"}
ROW = re.compile(r"^\|\s*`([a-z][a-z0-9-]*)`[^|]*\|\s*(.+?)\s*\|\s*$")
DESCRIPTION_LIMIT = 200


def roster(help_file):
    """Return (header word, [(sub, does)]) from the first roster table."""
    rows, header = [], None
    for line in help_file.read_text().splitlines():
        if header is None:
            cells = [c.strip().lower() for c in line.strip().strip("|").split("|")]
            if line.startswith("|") and cells[0] in ROSTER_HEADERS:
                header = cells[0]
            continue
        if not line.startswith("|"):
            break
        match = ROW.match(line)
        if match and match.group(1) != "help":
            rows.append((match.group(1), match.group(2)))
    return header, rows


def first_sentence(does):
    text = does.replace("**", "")
    sentence = re.split(r"(?<=[.!?])\s", text, maxsplit=1)[0]
    if len(sentence) > DESCRIPTION_LIMIT:
        sentence = sentence[: DESCRIPTION_LIMIT - 1].rstrip() + "…"
    return sentence


def command_text(router, sub, header, does):
    return (
        "---\n"
        f"name: {router}:{sub}\n"
        f"description: {json.dumps(first_sentence(does), ensure_ascii=False)}\n"
        f"{MARKER}\n"
        "---\n\n"
        f"Load the `{router}` skill and run its `{sub}` {header} with these arguments: $ARGUMENTS\n"
    )


def is_generated(path):
    return MARKER in path.read_text()


def sync(check):
    stale = []
    for help_file in sorted(ROOT.glob("*/commands/*:help.md")):
        router = help_file.name.removesuffix(":help.md")
        header, rows = roster(help_file)
        if header is None:
            continue
        commands = help_file.parent
        wanted = {}
        for sub, does in rows:
            wanted[commands / f"{router}:{sub}.md"] = command_text(router, sub, header, does)
        for path, text in wanted.items():
            if path.exists() and not is_generated(path):
                continue
            if not path.exists() or path.read_text() != text:
                stale.append(f"write {path}")
                if not check:
                    path.write_text(text)
        for path in commands.glob(f"{router}:*.md"):
            if path not in wanted and path != help_file and is_generated(path):
                stale.append(f"delete {path}")
                if not check:
                    path.unlink()
    for line in stale:
        print(line)
    return 1 if check and stale else 0


if __name__ == "__main__":
    sys.exit(sync("--check" in sys.argv[1:]))

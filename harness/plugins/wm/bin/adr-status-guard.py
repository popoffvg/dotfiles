#!/usr/bin/env python3
"""PreToolUse (Edit|Write|Bash) guard: only the operator changes the status of an ADR.

An ADR in <notes-dir>/adr/ carries `status: proposed` or `status: approved`; a missing key reads
as `proposed`. The operator sets `approved` in an editor, outside the agent's tools.
  Edit|Write: block a change of the status, and any edit of an ADR that is approved.
  Bash: block a command that names an ADR file or adr/ together with `status`, and a command
        that names an approved ADR file. A shell command can still reach an ADR in a way this
        check does not see; wm-constraints.py --unapproved stays the gate before impl.
Prints a block decision as JSON; exits 0 in every case.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ADR_FILE = re.compile(r"(^|/)adr/(archived/)?\d{4}-[^/]*\.md$")
STATUS_LINE = re.compile(r"^status:\s*([^\s#]*)", re.MULTILINE)

HOW = (
    "Only the operator changes the status of an ADR (arch:ref-adr-format.md § Status). "
    "Ask the operator: to approve a proposed ADR, or to set an approved ADR back to "
    "`status: proposed` before you change it."
)


def block(reason: str) -> None:
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


def status_of(text: str) -> str:
    fm = text[3:].split("\n---", 1)[0] if text.startswith("---") else ""
    m = STATUS_LINE.search(fm)
    return (m.group(1).strip("\"'") if m else "") or "proposed"


def after_edit(before: str, tool: dict) -> str:
    edits = tool.get("edits") or [tool]
    text = before
    for e in edits:
        old, new = e.get("old_string", ""), e.get("new_string", "")
        if not old:
            continue
        text = text.replace(old, new) if e.get("replace_all") else text.replace(old, new, 1)
    return text


def guard_file(name: str, tool: dict) -> None:
    path = Path(tool.get("file_path", ""))
    if not ADR_FILE.search(str(path)):
        return
    before = path.read_text(encoding="utf-8", errors="replace") if path.is_file() else ""
    old_status = status_of(before) if before else "proposed"
    if old_status == "approved":
        block(f"{path.name} is approved, so the agent does not edit it. {HOW}")
    after = tool.get("content", "") if name == "Write" else after_edit(before, tool)
    new_status = status_of(after)
    if new_status != old_status:
        block(f"This edit changes the status of {path.name} from {old_status} to {new_status}. {HOW}")


def notes_dirs(cwd: str) -> list[Path]:
    here = Path(cwd).resolve()
    for d in [here, *here.parents]:
        if (d / ".notes").is_dir():
            return [d / ".notes"]
    return []


def approved_files(cwd: str) -> list[Path]:
    out: list[Path] = []
    for notes in notes_dirs(cwd):
        for f in list(notes.glob("**/adr/[0-9]*.md")) + list(notes.glob("**/adr/archived/[0-9]*.md")):
            if status_of(f.read_text(encoding="utf-8", errors="replace")) == "approved":
                out.append(f)
    return out


def guard_bash(tool: dict, cwd: str) -> None:
    cmd = tool.get("command", "")
    if "adr" not in cmd:
        return
    if re.search(r"\bstatus\b", cmd) and re.search(r"adr/|\d{4}-[\w-]+\.md", cmd):
        if re.search(r"(-i\b|-pi\b|>|\btee\b|\bmv\b|\bcp\b|write_text|\.write\()", cmd):
            block(f"This command writes `status` into an ADR. {HOW}")
    if not re.search(r"(-i\b|-pi\b|>|\btee\b|\bmv\b|\bcp\b|\brm\b|write_text|\.write\(|rename-token)", cmd):
        return
    for f in approved_files(cwd):
        if f.name in cmd or f.stem.split("-", 1)[0] + "-" in cmd:
            block(f"This command can change {f.name}, which is approved. {HOW}")


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return
    name, tool = data.get("tool_name", ""), data.get("tool_input") or {}
    if name in ("Edit", "Write", "MultiEdit"):
        guard_file(name, tool)
    elif name == "Bash":
        guard_bash(tool, data.get("cwd") or ".")


if __name__ == "__main__":
    main()

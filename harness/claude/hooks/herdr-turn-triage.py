#!/usr/bin/env python3
"""Turn triage: the session model tags its final reply with `triage: done|wait|question`.

UserPromptSubmit asks for the tag in every session. Inside herdr it also clears the pane token
`triage`, and Stop writes the tag to that token; herdr-zed.sh turns it into the tab icon. A reply
with no tag counts as done.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

SOURCE = "herdr-turn-triage"
TOKEN = "triage"
FALLBACK = "done"
TAG_RE = re.compile(r"^\W*triage:\s*(done|wait|question)\W*$", re.IGNORECASE)

RULE = (
    "End your final reply of this turn with one last line `triage: <state>`, where <state> is:\n"
    "question - you ask the user something, offer options, or need a decision, a confirmation, "
    "or information before the work can continue;\n"
    "wait - the turn ends but the work goes on without the user: a background task, agent, or "
    "workflow still runs and will resume this session when it exits;\n"
    "done - the work stopped: the request is answered, or files changed or a step failed.\n"
    "If question applies, write question. Else if wait applies, write wait. Else write done."
)


def set_token(pane_id: str, value: str | None) -> None:
    flag = ["--clear-token", TOKEN] if value is None else ["--token", f"{TOKEN}={value}"]
    subprocess.run(
        ["herdr", "pane", "report-metadata", pane_id, "--source", SOURCE, "--agent", "claude", *flag],
        capture_output=True,
        timeout=5,
        check=False,
    )


def last_reply(transcript_path: str | None) -> str:
    if not transcript_path:
        return ""
    try:
        lines = Path(transcript_path).read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return ""
    for line in reversed(lines):
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(entry, dict) or entry.get("type") != "assistant" or entry.get("isSidechain"):
            continue
        content = entry.get("message", {}).get("content")
        if isinstance(content, list):
            text = "\n".join(i.get("text", "") for i in content if isinstance(i, dict) and i.get("type") == "text")
            if text.strip():
                return text
    return ""


def read_tag(reply: str) -> str:
    tail = [line for line in reply.splitlines() if line.strip()][-3:]
    for line in reversed(tail):
        match = TAG_RE.match(line.strip())
        if match:
            return match.group(1).lower()
    return FALLBACK


def main() -> int:
    try:
        hook_input = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return 0
    if hook_input.get("agent_id"):
        return 0
    # The rule goes to every session: the harness-dev turn ledger reads the tag outside herdr too.
    pane_id = os.environ.get("HERDR_PANE_ID")
    in_herdr = os.environ.get("HERDR_ENV") == "1" and pane_id and os.environ.get("HERDR_SOCKET_PATH")

    if hook_input.get("hook_event_name") == "Stop":
        if in_herdr:
            reply = hook_input.get("last_assistant_message") or last_reply(hook_input.get("transcript_path"))
            set_token(pane_id, read_tag(reply))
        return 0

    if in_herdr:
        set_token(pane_id, None)
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": RULE}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())

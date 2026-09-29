#!/usr/bin/env python3
"""Turn triage: the session model tags its final reply with `triage: done|review|question`.

UserPromptSubmit asks for the tag and clears the herdr pane token `triage`. Stop reads the tag
and writes it to that token; herdr-zed.sh turns it into the tab icon. A reply with no tag
counts as review.
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
FALLBACK = "review"
TAG_RE = re.compile(r"^\W*triage:\s*(done|review|question)\W*$", re.IGNORECASE)

RULE = (
    "End your final reply of this turn with one last line `triage: <state>`, where <state> is:\n"
    "question - you ask the user something, offer options, or need a decision, a confirmation, "
    "or information before the work can continue;\n"
    "review - the work stopped and the user must look at it: files changed, a result to check, "
    "a failed or blocked step, or work only partly done;\n"
    "done - the request is fully answered or finished, and nothing needs a check or a reply.\n"
    "If question applies, write question. Else if review applies, write review."
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
    pane_id = os.environ.get("HERDR_PANE_ID")
    if os.environ.get("HERDR_ENV") != "1" or not pane_id or not os.environ.get("HERDR_SOCKET_PATH"):
        return 0
    if hook_input.get("agent_id"):
        return 0

    if hook_input.get("hook_event_name") == "Stop":
        reply = hook_input.get("last_assistant_message") or last_reply(hook_input.get("transcript_path"))
        set_token(pane_id, read_tag(reply))
        return 0

    set_token(pane_id, None)
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": RULE}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())

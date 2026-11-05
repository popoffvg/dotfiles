#!/usr/bin/env python3
"""Turn triage: the session model tags its final reply with `triage: done|wait|question`.

UserPromptSubmit asks for the tag in every session. When CLAUDE_TURN_STATE names a file, every
event writes the turn state and the transcript path to it: `working` at UserPromptSubmit, the tag
at Stop, `untagged` at SessionStart and after a reply with no tag. A permission prompt writes
`permission`, and the next tool result or denial puts `working` back. zed-title.sh reads that file.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

TAG_RE = re.compile(r"^\W*triage:\s*(done|wait|question)\W*$", re.IGNORECASE)

TOOL_DONE_EVENTS = ("PostToolUse", "PostToolUseFailure", "PermissionDenied")

RULE = (
    "End your final reply of this turn with one last line `triage: <state>`, where <state> is:\n"
    "question - you ask the user something, offer options, or need a decision, a confirmation, "
    "or information before the work can continue;\n"
    "wait - the turn ends but the work goes on without the user: a background task, agent, or "
    "workflow still runs and will resume this session when it exits;\n"
    "done - the work stopped: the request is answered, or files changed or a step failed.\n"
    "If question applies, write question. Else if wait applies, write wait. Else write done.\n"
    "With question, the line just above the triage line MUST repeat the question in full, as one "
    "direct sentence that ends with `?` — even when the reply asked it before."
)


def read_state() -> dict:
    path = os.environ.get("CLAUDE_TURN_STATE")
    if not path:
        return {}
    try:
        state = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return state if isinstance(state, dict) else {}


def write_state(state: str, transcript_path: str | None) -> None:
    path = os.environ.get("CLAUDE_TURN_STATE")
    if not path:
        return
    target = Path(path)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = target.with_suffix(".partial")
        partial.write_text(json.dumps({"state": state, "transcript": transcript_path or ""}), encoding="utf-8")
        partial.replace(target)
    except OSError:
        pass


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


def read_tag(reply: str) -> str | None:
    tail = [line for line in reply.splitlines() if line.strip()][-3:]
    for line in reversed(tail):
        match = TAG_RE.match(line.strip())
        if match:
            return match.group(1).lower()
    return None


def main() -> int:
    try:
        hook_input = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return 0
    event = hook_input.get("hook_event_name")

    # A subagent can ask for a permission too, so these events skip no agent. They keep the
    # transcript already in the file, because a subagent event names its own transcript.
    if event == "Notification":
        if hook_input.get("notification_type") == "permission_prompt":
            write_state("permission", read_state().get("transcript"))
        return 0
    if event in TOOL_DONE_EVENTS:
        current = read_state()
        # A background agent runs tools after Stop; only an open prompt goes back to working.
        if current.get("state") == "permission":
            write_state("working", current.get("transcript"))
        return 0

    if hook_input.get("agent_id"):
        return 0
    transcript_path = hook_input.get("transcript_path")

    if event == "SessionStart":
        write_state("untagged", transcript_path)
        return 0

    if event == "Stop":
        reply = hook_input.get("last_assistant_message") or last_reply(transcript_path)
        write_state(read_tag(reply) or "untagged", transcript_path)
        return 0

    write_state("working", transcript_path)
    # The rule goes to every session: the harness-dev turn ledger reads the tag too.
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": RULE}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())

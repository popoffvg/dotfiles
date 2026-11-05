#!/usr/bin/env python3
"""Turn ledger: one row per main-agent turn in ~/.claude/harness-dev/turns/<session>.jsonl.

UserPromptSubmit saves the prompt as the session's pending turn and records its pastes. Stop joins
the pending turn with the reply: the `triage:` tag, an AskUserQuestion call, a stop with no work.
No model runs here. The paste nudge ships off and turns on by env: HARNESS_DEV_PASTE_NUDGE=1.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paste_groups import record_pastes  # noqa: E402

DATA = Path(os.environ.get("HARNESS_DEV_DATA", Path.home() / ".claude" / "harness-dev"))
PROMPT_CAP = 4000
REPLY_TAIL = 1500
TASK_START_CHARS = 200
NUDGE_MIN_PASTES = 3
NUDGE_MIN_SESSIONS = 2

TRIAGE_TAG = re.compile(r"^\W*triage:\s*(done|wait|question)\W*$", re.I)
TASK_NOTIFICATION = "<task-notification>"
WORK_TOOLS = {"Edit", "Write", "NotebookEdit", "Agent", "Workflow"}

def nudge_text(match: dict) -> str:
    return (f"The operator pasted this instruction block {match['count']} times in {match['sessions']} sessions "
            f"({', '.join(match['dates'][-4:])}). After the task, offer to turn it into a skill whose arguments "
            f"are the parts that change between pastes.")


def state_path(session: str) -> Path:
    return DATA / "state" / f"{session}.json"


def load_state(session: str) -> dict:
    try:
        return json.loads(state_path(session).read_text())
    except (OSError, json.JSONDecodeError):
        return {"turns": 0, "last_triage": None, "pending": None}


def save_state(session: str, state: dict) -> None:
    path = state_path(session)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state))


def repo_of(cwd: str) -> str:
    try:
        top = subprocess.run(["git", "-C", cwd, "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=2).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        top = ""
    return Path(top or cwd).name


def on_prompt(hook: dict) -> None:
    session, prompt = hook["session_id"], hook.get("prompt") or ""
    state = load_state(session)
    task_start = not prompt.lstrip().startswith(TASK_NOTIFICATION) and (
        state["turns"] == 0 or state["last_triage"] == "done" or len(prompt) >= TASK_START_CHARS)
    DATA.mkdir(parents=True, exist_ok=True)
    pastes = record_pastes(DATA / "pastes.jsonl", session, prompt)
    transcript = hook.get("transcript_path") or ""
    state["pending"] = {
        "turn": state["turns"], "ts": int(time.time()), "cwd": hook.get("cwd") or "",
        "prompt": prompt[:PROMPT_CAP], "prompt_chars": len(prompt), "task_start": task_start,
        "paste_ids": [p["id"] for p in pastes], "paste_groups": [p["group"] for p in pastes],
        "transcript_offset": os.path.getsize(transcript) if os.path.exists(transcript) else 0,
    }
    state["turns"] += 1
    save_state(session, state)

    context = []
    if os.environ.get("HARNESS_DEV_PASTE_NUDGE") == "1":
        context += [nudge_text(p) for p in pastes
                    if p["count"] >= NUDGE_MIN_PASTES and p["sessions"] >= NUDGE_MIN_SESSIONS]
    if context:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit",
                                                 "additionalContext": "\n\n".join(context)}}))


def tool_names(transcript: str, offset: int) -> set[str]:
    try:
        with open(transcript, "rb") as f:
            f.seek(offset)
            tail = f.read().decode(errors="replace")
    except OSError:
        return set()
    names = set()
    for line in tail.splitlines():
        if '"tool_use"' not in line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get("type") != "assistant" or entry.get("isSidechain"):
            continue
        for block in (entry.get("message") or {}).get("content") or []:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                names.add(block.get("name") or "")
    return names


def triage_of(reply: str) -> str | None:
    for line in reversed([l for l in reply.splitlines() if l.strip()][-3:]):
        match = TRIAGE_TAG.match(line.strip())
        if match:
            return match.group(1).lower()
    return None


def on_stop(hook: dict) -> None:
    session = hook["session_id"]
    state = load_state(session)
    pending = state.get("pending")
    reply = hook.get("last_assistant_message") or ""
    triage = triage_of(reply)
    transcript = hook.get("transcript_path") or ""
    tools = tool_names(transcript, pending["transcript_offset"]) if pending else set()
    row = {"session": session, "ts": int(time.time()), "triage": triage, "reply": reply[-REPLY_TAIL:],
           "stopped": triage == "question" and not tools & WORK_TOOLS}
    if pending:
        row.update({k: pending[k] for k in ("turn", "prompt", "prompt_chars", "task_start", "paste_ids",
                                            "paste_groups")})
        row["repo"] = repo_of(pending["cwd"]) if pending["cwd"] else ""
        row["asked_tool"] = "AskUserQuestion" in tools
        row["kind"] = "turn"
    else:
        # A Stop with no new prompt: a background task resumed the session. Its tag updates the last turn.
        row.update({"turn": state["turns"] - 1, "kind": "resume", "asked_tool": False})
    out = DATA / "turns" / f"{session}.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("a") as f:
        f.write(json.dumps(row) + "\n")
    state["pending"] = None
    state["last_triage"] = triage or state.get("last_triage")
    save_state(session, state)


def main() -> int:
    try:
        hook = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return 0
    if hook.get("agent_id") or not hook.get("session_id"):
        return 0
    try:
        if hook.get("hook_event_name") == "Stop":
            on_stop(hook)
        elif hook.get("hook_event_name") == "UserPromptSubmit":
            on_prompt(hook)
    except Exception as e:  # a metrics hook must never block a turn
        print(f"turn-ledger: {e!r}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

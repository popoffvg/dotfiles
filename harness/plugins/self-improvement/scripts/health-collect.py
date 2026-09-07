#!/usr/bin/env python3
"""Extract harness-health events from Claude Code transcripts, incrementally.

Walks every transcript under the projects dir, resumes each file from a byte
watermark, and appends one JSON line per signal to health/events.jsonl. The
events outlive the transcripts (cleanupPeriodDays deletes those after ~30
days), so rollups and /dream see the full history.

Safe to run at any time, from anywhere (SessionStart scan, launchd, by hand):
idempotent via the watermark, single-instance via a pid lock.

Env overrides: SELF_IMPROVE_ROOT, SELF_IMPROVE_PROJECTS_DIR.
"""

import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(os.environ.get("SELF_IMPROVE_ROOT", Path.home() / ".claude" / "self-improvement"))
PROJECTS = Path(os.environ.get("SELF_IMPROVE_PROJECTS_DIR", Path.home() / ".claude" / "projects"))
HEALTH = ROOT / "health"
STATE = HEALTH / "state.json"
EVENTS = HEALTH / "events.jsonl"

CMD_RE = re.compile(r"<command-name>(/[^<]+)</command-name>")
UNKNOWN_SKILL_RE = re.compile(r"Unknown skill: ([\w:./-]+)")
DISABLED_SKILL_RE = re.compile(r'skill "([^"]+)" is disabled for model invocation')
HOOK_AGG_TYPES = ("hook_success", "hook_additional_context")


def acquire_lock():
    lock = HEALTH / "collect.lock"
    HEALTH.mkdir(parents=True, exist_ok=True)
    try:
        lock.mkdir()
    except FileExistsError:
        try:
            pid = int((lock / "pid").read_text())
            os.kill(pid, 0)
            return None
        except (ValueError, FileNotFoundError, ProcessLookupError, PermissionError):
            pass
        for p in lock.glob("*"):
            p.unlink(missing_ok=True)
        try:
            lock.rmdir()
            lock.mkdir()
        except OSError:
            return None
    (lock / "pid").write_text(str(os.getpid()))
    return lock


def release_lock(lock):
    (lock / "pid").unlink(missing_ok=True)
    lock.rmdir()


def blocks(record):
    content = (record.get("message") or {}).get("content")
    if isinstance(content, list):
        for b in content:
            if isinstance(b, dict):
                yield b


def scan_line(record, out, hook_counts):
    ts = record.get("timestamp")

    if record.get("type") == "attachment":
        att = record.get("attachment") or {}
        atype = att.get("type")
        if atype in HOOK_AGG_TYPES:
            key = (atype, att.get("hookName") or "?")
            hook_counts[key] = hook_counts.get(key, 0) + 1
        elif atype == "hook_non_blocking_error":
            out({"ev": "hook_crash", "name": att.get("hookName"), "ts": ts,
                 "detail": str(att.get("stderr") or att.get("content") or "")[:200]})
        return

    content = (record.get("message") or {}).get("content")
    if record.get("type") == "user" and isinstance(content, str):
        m = CMD_RE.search(content)
        if m:
            out({"ev": "slash_command", "name": m.group(1), "ts": ts})
        return

    for b in blocks(record):
        btype = b.get("type")
        if btype == "tool_use":
            name = b.get("name")
            inp = b.get("input") or {}
            if name == "Skill":
                out({"ev": "skill_load", "name": inp.get("skill"), "ts": ts})
            elif name == "Agent":
                out({"ev": "agent_spawn", "name": inp.get("subagent_type") or "general-purpose", "ts": ts})
            elif name == "AskUserQuestion":
                out({"ev": "ask_user", "ts": ts})
        elif btype == "tool_result":
            text = json.dumps(b.get("content"), ensure_ascii=False) if b.get("content") is not None else ""
            if b.get("is_error"):
                m = UNKNOWN_SKILL_RE.search(text)
                if m:
                    out({"ev": "skill_unknown", "name": m.group(1), "ts": ts})
                    continue
                m = DISABLED_SKILL_RE.search(text)
                if m:
                    out({"ev": "skill_disabled", "name": m.group(1), "ts": ts})
                    continue
                if "doesn't want to proceed" in text:
                    out({"ev": "tool_reject", "ts": ts})
                elif text.startswith('"Error: Permission to use'):
                    out({"ev": "perm_denied", "ts": ts, "detail": text[:160]})
        elif btype == "text":
            t = b.get("text")
            if isinstance(t, str) and t.startswith("[Request interrupted"):
                out({"ev": "interrupt", "ts": ts})


def collect_file(path, offset, events_fh, base):
    size = path.stat().st_size
    if size < offset:
        offset = 0
    if size == offset:
        return offset, 0
    session = path.stem
    project = path.relative_to(base).parts[0]
    emitted = 0
    hook_counts = {}
    line_no = 0

    def out(ev):
        nonlocal emitted
        ev.update({"session": session, "project": project, "line": line_no})
        events_fh.write(json.dumps(ev, ensure_ascii=False) + "\n")
        emitted += 1

    with open(path, "rb") as fh:
        fh.seek(offset)
        while True:
            pos = fh.tell()
            raw = fh.readline()
            if not raw or not raw.endswith(b"\n"):
                end = pos
                break
            line_no += 1
            try:
                record = json.loads(raw)
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if isinstance(record, dict):
                scan_line(record, out, hook_counts)

    for (atype, hook_name), n in sorted(hook_counts.items()):
        events_fh.write(json.dumps({
            "ev": "hook_fires", "kind": atype, "name": hook_name, "count": n,
            "session": session, "project": project,
        }, ensure_ascii=False) + "\n")
        emitted += 1
    return end, emitted


def main():
    lock = acquire_lock()
    if lock is None:
        print("health-collect: already running", file=sys.stderr)
        return 0
    try:
        state = {}
        if STATE.exists():
            state = json.loads(STATE.read_text())
        marks = state.get("marks", {})
        files_seen = new_events = 0
        with open(EVENTS, "a", encoding="utf-8") as events_fh:
            for path in sorted(PROJECTS.rglob("*.jsonl")):
                key = str(path.relative_to(PROJECTS))
                new_mark, emitted = collect_file(path, int(marks.get(key, 0)), events_fh, PROJECTS)
                marks[key] = new_mark
                files_seen += 1
                new_events += emitted
        live = {str(p.relative_to(PROJECTS)) for p in PROJECTS.rglob("*.jsonl")}
        state = {"marks": {k: v for k, v in marks.items() if k in live},
                 "updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        tmp = STATE.with_suffix(f".tmp.{os.getpid()}")
        tmp.write_text(json.dumps(state))
        tmp.rename(STATE)
        print(f"health-collect: files={files_seen} new_events={new_events}", file=sys.stderr)
        return 0
    finally:
        release_lock(lock)


if __name__ == "__main__":
    sys.exit(main())

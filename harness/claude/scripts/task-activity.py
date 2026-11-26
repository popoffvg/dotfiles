#!/usr/bin/env python3
"""Operator and agent activity of one task, per TODO and per day, from Claude Code transcripts.

A session belongs to the task when its project folder name contains MATCH. A headless session
(`entrypoint: sdk-cli`, for example a review fork) is left out: no operator works in it.
A session gets the TODO of its worktree folder (`todo-18-3` -> TODO-18.3); else the TODO
that its operator prompts name most often; else `other`.

Operator time: the operator prompts of all sessions in one time line. A gap of at most
--human-gap minutes between two prompts counts as work; a longer gap counts --solo minutes.
Agent time: the gaps of at most --agent-gap minutes between the records of one session.

Usage: task-activity.py <match> [--since YYYY-MM-DD] [--human-gap 30] [--solo 5] [--agent-gap 10] [--json]
"""
import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

PROJECTS = Path.home() / ".claude" / "projects"
TODO_IN_DIR = re.compile(r"-todo-(\d+)(?:-(\d+))?(?:-|$)")
TODO_IN_TEXT = re.compile(r"\bTODO-(\d+(?:\.\d+)?)\b")
NOISE = ("<system-reminder", "<task-notification", "<local-command", "Caveat: The messages below")


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text")
    return ""


def is_operator_prompt(rec: dict) -> bool:
    if rec.get("type") != "user" or rec.get("isSidechain") or rec.get("isMeta"):
        return False
    origin = rec.get("origin")
    if isinstance(origin, dict):
        return origin.get("kind") == "human"
    content = rec.get("message", {}).get("content")
    if isinstance(content, list) and any(isinstance(p, dict) and p.get("type") == "tool_result" for p in content):
        return False
    text = text_of(content).lstrip()
    return bool(text) and not text.startswith(NOISE)


def stamp_of(rec: dict) -> datetime | None:
    raw = rec.get("timestamp")
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone()
    except ValueError:
        return None


def read_session(path: Path, agent_gap: timedelta) -> dict | None:
    stamps, prompts, mentions = [], [], Counter()
    with path.open() as stream:
        for line in stream:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("isSidechain"):
                continue
            if rec.get("entrypoint") == "sdk-cli":
                return None
            at = stamp_of(rec)
            if at is None:
                continue
            stamps.append(at)
            if is_operator_prompt(rec):
                prompts.append(at)
                mentions.update(TODO_IN_TEXT.findall(text_of(rec.get("message", {}).get("content"))))
    if not stamps:
        return None
    stamps.sort()
    agent = sum(
        ((b - a) for a, b in zip(stamps, stamps[1:]) if b - a <= agent_gap),
        timedelta(),
    )
    dir_hit = TODO_IN_DIR.search(path.parent.name)
    if dir_hit:
        todo = "TODO-" + dir_hit.group(1) + ("." + dir_hit.group(2) if dir_hit.group(2) else "")
    elif mentions:
        todo = "TODO-" + mentions.most_common(1)[0][0]
    else:
        todo = "other"
    return {"todo": todo, "start": stamps[0], "end": stamps[-1], "prompts": sorted(prompts), "agent": agent}


def operator_time(events: list[tuple[datetime, str]], gap: timedelta, solo: timedelta):
    per_todo, per_day = defaultdict(timedelta), defaultdict(timedelta)
    previous = None
    for at, todo in events:
        spent = at - previous if previous and at - previous <= gap else solo
        per_todo[todo] += spent
        per_day[at.date()] += spent
        previous = at
    return per_todo, per_day


def hours(delta: timedelta) -> float:
    return round(delta.total_seconds() / 3600, 1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("match")
    ap.add_argument("--since")
    ap.add_argument("--human-gap", type=int, default=30)
    ap.add_argument("--solo", type=int, default=5)
    ap.add_argument("--agent-gap", type=int, default=10)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    since = datetime.fromisoformat(args.since).date() if args.since else None

    sessions = []
    for folder in sorted(PROJECTS.iterdir()):
        if args.match not in folder.name:
            continue
        for path in folder.glob("*.jsonl"):
            session = read_session(path, timedelta(minutes=args.agent_gap))
            if session and (since is None or session["end"].date() >= since):
                sessions.append(session)

    events = sorted((at, s["todo"]) for s in sessions for at in s["prompts"])
    op_todo, op_day = operator_time(events, timedelta(minutes=args.human_gap), timedelta(minutes=args.solo))

    by_todo = defaultdict(lambda: {"sessions": 0, "prompts": 0, "agent": timedelta(), "first": None, "last": None, "days": set()})
    for s in sessions:
        row = by_todo[s["todo"]]
        row["sessions"] += 1
        row["prompts"] += len(s["prompts"])
        row["agent"] += s["agent"]
        row["first"] = min(filter(None, [row["first"], s["start"]]))
        row["last"] = max(filter(None, [row["last"], s["end"]]))
        row["days"].update(at.date() for at in s["prompts"])

    by_day = defaultdict(lambda: {"sessions": set(), "prompts": 0, "agent": timedelta()})
    for i, s in enumerate(sessions):
        for at in s["prompts"]:
            by_day[at.date()]["prompts"] += 1
            by_day[at.date()]["sessions"].add(i)
        by_day[s["start"].date()]["agent"] += s["agent"]

    todo_rows = [
        {
            "todo": todo,
            "sessions": r["sessions"],
            "prompts": r["prompts"],
            "active_days": len(r["days"]),
            "operator_h": hours(op_todo[todo]),
            "agent_h": hours(r["agent"]),
            "first": r["first"].date().isoformat(),
            "last": r["last"].date().isoformat(),
        }
        for todo, r in by_todo.items()
    ]
    todo_rows.sort(key=lambda r: r["first"])
    day_rows = [
        {
            "day": d.isoformat(),
            "sessions": len(r["sessions"]),
            "prompts": r["prompts"],
            "operator_h": hours(op_day[d]),
            "agent_h": hours(r["agent"]),
        }
        for d, r in sorted(by_day.items())
    ]
    if args.json:
        print(json.dumps({"todos": todo_rows, "days": day_rows}, indent=1))
        return
    print("todo\tsessions\tprompts\tactive_days\toperator_h\tagent_h\tfirst\tlast")
    for r in todo_rows:
        print("\t".join(str(r[k]) for k in ("todo", "sessions", "prompts", "active_days", "operator_h", "agent_h", "first", "last")))
    print("\nday\tsessions\tprompts\toperator_h\tagent_h")
    for r in day_rows:
        print("\t".join(str(r[k]) for k in ("day", "sessions", "prompts", "operator_h", "agent_h")))


if __name__ == "__main__":
    main()

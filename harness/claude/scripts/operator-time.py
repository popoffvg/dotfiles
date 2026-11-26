#!/usr/bin/env python3
"""Operator time of one project against other work, from the sessions of Claude Code, Codex, Cursor, and OpenCode.

All operator prompts of the four tools form one time line, so each hour counts once:
a gap of at most --gap minutes goes to the activity of the next prompt; a lone prompt
counts --solo minutes. Headless and review-fork sessions are left out: no operator works in them.

A session is `project` when its folder or cwd contains --folder, its git branch matches
--branch, or its prompts match --mention at least 3 times. Else it is `other-work` when its
folder or cwd is under --org; else `tooling`.

Usage: operator-time.py --folder MILAB-7260-instence-record --branch 'MILAB-726[013]/'
         --mention 'MILAB-726[013]|snapshot' [--org git/mil] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
         [--gap 30] [--solo 5] [--json]
"""
import argparse
import glob
import json
import os
import re
import shutil
import sqlite3
import tempfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HOME = Path.home()
CLAUDE_NOISE = ("<system-reminder", "<task-notification", "<local-command", "Caveat: The messages below")
CURSOR_STAMP = re.compile(r"<timestamp>\w+, (\w+ \d+, \d{4}), (\d+:\d+ [AP]M) \(UTC([+-]\d+)\)</timestamp>")
CURSOR_FORK = re.compile(
    r"\s*(<timestamp>[^<]*</timestamp>\s*)?(<user_query>\s*)?"
    r"(checkout:|id: H\d|You are the |Prefix every response|TODO mode for|Implement the remaining|Write the whole-TODO)"
)


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(p.get("text", "") for p in content if isinstance(p, dict))
    return ""


def local(raw: str) -> datetime:
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone()


def claude_sessions():
    for path in (HOME / ".claude" / "projects").glob("*/*.jsonl"):
        where, branches, prompts, texts = path.parent.name, set(), [], []
        for line in path.open():
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("entrypoint") == "sdk-cli":
                prompts = []
                break
            if rec.get("isSidechain") or rec.get("type") != "user" or rec.get("isMeta") or not rec.get("timestamp"):
                branches.add(rec.get("gitBranch") or "")
                continue
            origin = rec.get("origin")
            content = rec.get("message", {}).get("content")
            human = origin.get("kind") == "human" if isinstance(origin, dict) else (
                not (isinstance(content, list) and any(isinstance(p, dict) and p.get("type") == "tool_result" for p in content))
                and text_of(content).lstrip()[:1] != "" and not text_of(content).lstrip().startswith(CLAUDE_NOISE)
            )
            branches.add(rec.get("gitBranch") or "")
            if human:
                prompts.append(local(rec["timestamp"]))
                texts.append(text_of(content))
        if prompts:
            yield "claude", where, branches, prompts, "\n".join(texts)


def codex_sessions():
    for path in glob.glob(str(HOME / ".codex" / "sessions" / "*" / "*" / "*" / "*.jsonl")):
        cwd, source, prompts, texts = "", None, [], []
        for line in open(path):
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            body = rec.get("payload") or {}
            kind = rec.get("type")
            if kind == "session_meta":
                source, cwd = body.get("source"), body.get("cwd") or cwd
            if source not in ("vscode", "cli"):
                break
            if kind == "turn_context":
                cwd = body.get("cwd") or cwd
            if kind == "event_msg" and body.get("type") == "task_started" and (body.get("turn_attribution") or {}).get("turn_trigger") == "user":
                prompts.append(local(rec["timestamp"]))
            if kind == "response_item" and body.get("type") == "message" and body.get("role") == "user":
                text = text_of(body.get("content"))
                if not text.startswith(("# AGENTS.md", "<environment_context", "<user_instructions")):
                    texts.append(text)
        if prompts:
            yield "codex", cwd, set(), prompts, "\n".join(texts)


def cursor_sessions():
    for path in glob.glob(str(HOME / ".cursor" / "projects" / "*" / "agent-transcripts" / "*" / "*.jsonl")):
        where = path.split("/projects/")[1].split("/")[0]
        if "reviewrules-cursor-sessions" in where:
            continue
        prompts, texts = [], []
        for line in open(path):
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("role") != "user":
                continue
            text = text_of(rec.get("message", {}).get("content"))
            stamp = CURSOR_STAMP.search(text)
            if stamp:
                zone = timezone(timedelta(hours=int(stamp.group(3))))
                at = datetime.strptime(f"{stamp.group(1)} {stamp.group(2)}", "%b %d, %Y %I:%M %p").replace(tzinfo=zone)
                prompts.append(at.astimezone())
                texts.append(text)
        if prompts and not CURSOR_FORK.match(texts[0]):
            yield "cursor", where, set(), prompts, "\n".join(texts)


def opencode_sessions():
    files = glob.glob(str(HOME / ".local" / "share" / "opencode" / "opencode.db*"))
    if not files:
        return
    copy = tempfile.mkdtemp()
    for f in files:
        shutil.copy(f, copy)
    db = sqlite3.connect(os.path.join(copy, "opencode.db"))
    rows = db.execute(
        "select s.directory, m.session_id, m.time_created, m.data from session_message m "
        "join session_v2 s on s.id = m.session_id where m.type = 'user'"
    ).fetchall()
    sessions = {}
    for where, sid, created, data in rows:
        if where.startswith("/private/tmp"):
            continue
        s = sessions.setdefault(sid, [where, [], []])
        s[1].append(datetime.fromtimestamp(created / 1000).astimezone())
        s[2].append(json.loads(data).get("text", ""))
    for where, prompts, texts in sessions.values():
        yield "opencode", where, set(), prompts, "\n".join(texts)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--folder", required=True)
    ap.add_argument("--branch", required=True)
    ap.add_argument("--mention", required=True)
    ap.add_argument("--org", default="git/mil")
    ap.add_argument("--since")
    ap.add_argument("--until")
    ap.add_argument("--gap", type=int, default=30)
    ap.add_argument("--solo", type=int, default=5)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    since = date.fromisoformat(args.since) if args.since else date.min
    until = date.fromisoformat(args.until) if args.until else date.max
    branch, mention = re.compile(args.branch), re.compile(args.mention, re.I)
    org_folder, org_path = args.org.replace("/", "-"), args.org

    def activity(where: str, branches: set, text: str) -> str:
        if args.folder in where or any(branch.match(b) for b in branches):
            return "project"
        if org_folder in where or org_path in where:
            return "project" if len(mention.findall(text)) >= 3 else "other-work"
        return "tooling"

    events, sessions = [], Counter()
    for source in (claude_sessions(), codex_sessions(), cursor_sessions(), opencode_sessions()):
        for tool, where, branches, prompts, text in source:
            kept = [at for at in prompts if since <= at.date() <= until]
            if not kept:
                continue
            kind = activity(where, branches, text)
            sessions[(tool, kind)] += 1
            events += [(at, kind, tool, where) for at in kept]
    events.sort()

    hours, by_tool, by_week, other = Counter(), Counter(), defaultdict(Counter), Counter()
    previous = None
    for at, kind, tool, where in events:
        spent = (at - previous if previous and at - previous <= timedelta(minutes=args.gap) else timedelta(minutes=args.solo)).total_seconds() / 3600
        hours[kind] += spent
        by_tool[tool] += spent
        by_week[(at.date() - timedelta(days=at.weekday())).isoformat()][kind] += spent
        if kind == "other-work":
            other[where.split(org_folder + "-")[-1].split(org_path + "/")[-1]] += spent
        previous = at

    total = sum(hours.values())
    work = hours["project"] + hours["other-work"]
    report = {
        "total_h": round(total, 1),
        "hours": {k: round(v, 1) for k, v in hours.most_common()},
        "share": {k: round(100 * v / total) for k, v in hours.items()} if total else {},
        "project_share_of_org_work": round(100 * hours["project"] / work) if work else 0,
        "by_tool_h": {k: round(v, 1) for k, v in by_tool.most_common()},
        "sessions": {f"{t}/{k}": n for (t, k), n in sorted(sessions.items())},
        "weeks": {w: {"org_h": round(c["project"] + c["other-work"], 1),
                      "project_share": round(100 * c["project"] / (c["project"] + c["other-work"])) if c["project"] + c["other-work"] else 0}
                  for w, c in sorted(by_week.items())},
        "other_work_top_h": {k: round(v, 1) for k, v in other.most_common(10)},
    }
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Digest of one day's Claude Code sessions for one org, input for the `daily` skill.

An org is a folder `~/git/<org>/`; a session belongs to it when its
`cwd` lies under that folder. Per session it prints the cwd, the time span, the
operator's prompts, outward actions (commits, PRs, issues, tickets) and the last
assistant text, all from records stamped with the target local date.

Usage: daily-sessions.py <org> [--date YYYY-MM-DD] [--root DIR] [--max-prompt N]
"""
import argparse
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

PROJECTS = Path.home() / ".claude" / "projects"
NOISE = ("<system-reminder", "<command-message", "<local-command", "Caveat: The messages below")
ACTION = re.compile(
    r"\b(git (commit|push)|gh (pr|issue|api)|jj (commit|describe|git push)|jira|linear|acli)\b"
)


def trim(text: str, limit: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit] + " …"


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(
            part.get("text", "") for part in content if isinstance(part, dict) and part.get("type") == "text"
        )
    return ""


def local_date(stamp: str) -> date | None:
    try:
        return datetime.fromisoformat(stamp.replace("Z", "+00:00")).astimezone().date()
    except ValueError:
        return None


def digest(path: Path, org_dir: Path, day: date, max_prompt: int) -> dict | None:
    cwd, title, prompts, actions, last_text, stamps = None, None, [], [], "", []
    with path.open() as stream:
        for line in stream:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if rec.get("type") in ("custom-title", "summary"):
                title = rec.get("customTitle") or rec.get("summary") or title
            if rec.get("isSidechain"):
                continue
            stamp = rec.get("timestamp")
            if not stamp or local_date(stamp) != day:
                continue
            cwd = cwd or rec.get("cwd")
            stamps.append(stamp)
            msg = rec.get("message") or {}
            if rec.get("type") == "user" and (rec.get("origin") or {}).get("kind") == "human":
                text = text_of(msg.get("content")).strip()
                if text and not text.startswith(NOISE):
                    prompts.append(trim(text, max_prompt))
            elif rec.get("type") == "assistant":
                for part in msg.get("content") or []:
                    if not isinstance(part, dict):
                        continue
                    if part.get("type") == "text" and part["text"].strip():
                        last_text = part["text"]
                    elif part.get("type") == "tool_use":
                        command = (part.get("input") or {}).get("command", "")
                        if isinstance(command, str) and ACTION.search(command):
                            actions.append(trim(command, 200))
    if not cwd or not stamps or not prompts:
        return None
    try:
        rel = Path(cwd).resolve().relative_to(org_dir)
    except ValueError:
        return None
    clock = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone().strftime("%H:%M")
    return {
        "session": path.stem,
        "dir": str(rel) or ".",
        "title": title,
        "span": f"{clock(min(stamps))}-{clock(max(stamps))}",
        "prompts": prompts,
        "actions": actions,
        "last": trim(last_text, 600),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("org")
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--root", default=str(Path.home() / "git"))
    parser.add_argument("--max-prompt", type=int, default=500)
    args = parser.parse_args()

    org_dir = (Path(args.root) / args.org).resolve()
    if not org_dir.is_dir():
        orgs = sorted(p.name for p in Path(args.root).iterdir() if p.is_dir() and not p.name.startswith("."))
        sys.exit(f"daily-sessions: no org folder {org_dir}; folders: {', '.join(orgs)}")
    day = date.fromisoformat(args.date)

    sessions = []
    for path in PROJECTS.glob("*/*.jsonl"):
        if datetime.fromtimestamp(path.stat().st_mtime).date() < day:
            continue
        item = digest(path, org_dir, day, args.max_prompt)
        if item:
            sessions.append(item)
    sessions.sort(key=lambda s: s["span"])

    print(f"# org={args.org} date={day} sessions={len(sessions)}")
    for s in sessions:
        print(f"\n## {s['span']} {s['dir']} ({s['session']})" + (f" — {s['title']}" if s["title"] else ""))
        for prompt in s["prompts"]:
            print(f"U: {prompt}")
        for action in s["actions"]:
            print(f"X: {action}")
        if s["last"]:
            print(f"A: {s['last']}")


if __name__ == "__main__":
    main()

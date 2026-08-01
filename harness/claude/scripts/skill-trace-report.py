#!/usr/bin/env python3
"""Report skill invocations from Claude Code session transcripts.

Reads ~/.claude/projects/**/*.jsonl and counts:
  - Skill tool calls (model-invoked skills)   -> block type "tool_use", name "Skill"
  - slash commands (<command-name> in prompt) -> user-invoked

Usage:
  skill-trace-report.py                 # summary counts, all projects
  skill-trace-report.py --days 7        # only sessions touched in last 7 days
  skill-trace-report.py --project z-core # filter by project dir substring
  skill-trace-report.py --list          # one line per invocation (time, skill, session)
  skill-trace-report.py --jsonl         # machine-readable events
"""
import argparse
import collections
import glob
import json
import os
import time

ROOT = os.path.expanduser("~/.claude/projects")


def iter_events(days=None, project=None):
    cutoff = time.time() - days * 86400 if days else None
    for path in glob.glob(os.path.join(ROOT, "**", "*.jsonl"), recursive=True):
        if project and project not in path:
            continue
        try:
            if cutoff and os.path.getmtime(path) < cutoff:
                continue
        except OSError:
            continue
        session = os.path.basename(path)[:-6]
        proj = os.path.basename(os.path.dirname(path))
        with open(path, errors="ignore") as fh:
            for line in fh:
                if '"Skill"' not in line and "<command-name>" not in line:
                    continue
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                ts = rec.get("timestamp", "")
                content = (rec.get("message") or {}).get("content")
                if isinstance(content, list):
                    for block in content:
                        if not isinstance(block, dict):
                            continue
                        if block.get("type") == "tool_use" and block.get("name") == "Skill":
                            inp = block.get("input") or {}
                            yield {
                                "kind": "skill_tool",
                                "skill": inp.get("skill"),
                                "args": inp.get("args"),
                                "ts": ts,
                                "session": session,
                                "project": proj,
                            }
                elif isinstance(content, str) and "<command-name>" in content:
                    name = content.split("<command-name>")[1].split("</command-name>")[0]
                    yield {
                        "kind": "slash_command",
                        "skill": name.strip(),
                        "args": None,
                        "ts": ts,
                        "session": session,
                        "project": proj,
                    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int)
    ap.add_argument("--project")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--jsonl", action="store_true")
    args = ap.parse_args()

    events = list(iter_events(args.days, args.project))
    events.sort(key=lambda e: e["ts"] or "")

    if args.jsonl:
        for e in events:
            print(json.dumps(e, ensure_ascii=False))
        return
    if args.list:
        for e in events:
            tag = "skill" if e["kind"] == "skill_tool" else "slash"
            print(f"{e['ts'][:19]:20} {tag:6} {e['skill']:<45} {e['project']}")
        return

    for kind, title in (("skill_tool", "Skill tool calls"), ("slash_command", "Slash commands")):
        counts = collections.Counter(e["skill"] for e in events if e["kind"] == kind)
        print(f"--- {title} ({sum(counts.values())} total, {len(counts)} distinct) ---")
        for name, n in counts.most_common():
            print(f"{n:5}  {name}")
        print()


if __name__ == "__main__":
    main()

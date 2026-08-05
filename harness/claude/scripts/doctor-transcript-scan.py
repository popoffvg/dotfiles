#!/usr/bin/env python3
"""Scan Claude Code transcripts for doctor checks: tool usage, skill/command
invocations, MCP calls, hook durations, and denied tool calls.

Usage: doctor-transcript-scan.py [N_FILES]
Reads ~/.claude/projects/*/*.jsonl, newest N (default 50) by mtime.
Prints a JSON report to stdout. Never prints transcript text bodies.
"""
import json
import os
import sys
import glob
import time
from collections import Counter, defaultdict

N = int(sys.argv[1]) if len(sys.argv) > 1 else 50
root = os.path.expanduser("~/.claude/projects")
files = sorted(glob.glob(os.path.join(root, "*", "*.jsonl")),
               key=lambda p: os.path.getmtime(p), reverse=True)[:N]

tools = Counter()
mcp_servers = Counter()
skills = Counter()
slash = Counter()
hooks = defaultdict(list)
hook_timeouts = Counter()
denials = Counter()          # (pattern, kind) -> count
denial_kinds = Counter()
tool_use_by_id = {}
pending_denials = []         # (tool_use_id, kind)
mtimes = []
projects = set()

for path in files:
    mtimes.append(os.path.getmtime(path))
    projects.add(os.path.basename(os.path.dirname(path)))
    try:
        fh = open(path, "r", errors="replace")
    except OSError:
        continue
    with fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
            except ValueError:
                continue
            t = e.get("type")
            if t == "assistant":
                msg = e.get("message") or {}
                for c in msg.get("content") or []:
                    if not isinstance(c, dict) or c.get("type") != "tool_use":
                        continue
                    name = c.get("name") or ""
                    tools[name] += 1
                    tool_use_by_id[c.get("id")] = (name, c.get("input") or {})
                    if name.startswith("mcp__"):
                        seg = name.split("__")
                        if len(seg) >= 2:
                            mcp_servers[seg[1]] += 1
                    if name == "Skill":
                        s = (c.get("input") or {}).get("skill")
                        if isinstance(s, str):
                            skills[s] += 1
            elif t == "user":
                kind = e.get("toolDenialKind")
                if kind and kind not in ("interrupted", "cancelled"):
                    denial_kinds[kind] += 1
                    msg = e.get("message") or {}
                    for c in msg.get("content") or []:
                        if isinstance(c, dict) and c.get("type") == "tool_result":
                            pending_denials.append((c.get("tool_use_id"), kind))
                msg = e.get("message") or {}
                content = msg.get("content")
                text = content if isinstance(content, str) else json.dumps(content)
                marker = "<command-name>"
                i = text.find(marker)
                while i != -1:
                    j = text.find("</command-name>", i)
                    if j == -1:
                        break
                    slash[text[i + len(marker):j].strip()] += 1
                    i = text.find(marker, j)
            elif t == "attachment":
                a = e.get("attachment") or {}
                at = a.get("type") or ""
                if at.startswith("hook_"):
                    key = (a.get("hookName") or "?", a.get("hookEvent") or "?")
                    d = a.get("durationMs")
                    if isinstance(d, (int, float)):
                        hooks[key].append(d)
                    if at == "hook_cancelled" and a.get("timedOut"):
                        hook_timeouts[key] += 1

for tid, kind in pending_denials:
    entry = tool_use_by_id.get(tid)
    if not entry:
        denials[("<unresolved>", kind)] += 1
        continue
    name, inp = entry
    if name == "Bash":
        cmd = inp.get("command") or ""
        parts = cmd.split()
        pattern = " ".join(parts[:2]) if parts else "Bash"
        denials[("Bash: " + pattern, kind)] += 1
    else:
        denials[(name, kind)] += 1


def hookstat(vals):
    v = sorted(vals)
    n = len(v)
    return {"runs": n, "median": v[n // 2], "max": v[-1]} if n else {"runs": 0}


report = {
    "window": {
        "files": len(files),
        "projects": len(projects),
        "newest": time.strftime("%Y-%m-%d", time.localtime(max(mtimes))) if mtimes else None,
        "oldest": time.strftime("%Y-%m-%d", time.localtime(min(mtimes))) if mtimes else None,
    },
    "top_tools": tools.most_common(30),
    "mcp_servers": mcp_servers.most_common(),
    "skills": skills.most_common(),
    "slash": slash.most_common(),
    "hooks": {f"{k[0]} / {k[1]}": hookstat(v) for k, v in sorted(hooks.items())},
    "hook_timeouts": {f"{k[0]} / {k[1]}": v for k, v in hook_timeouts.items()},
    "denial_kinds": denial_kinds.most_common(),
    "denials": [{"pattern": k[0], "kind": k[1], "count": v}
                for k, v in denials.most_common(40)],
}
print(json.dumps(report, indent=2))

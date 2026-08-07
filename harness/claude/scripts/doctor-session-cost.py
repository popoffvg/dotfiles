#!/usr/bin/env python3
"""Cost audit of ONE Claude Code session transcript.

Answers "where did this session spend its tokens, turns, and wall clock".
Deduplicates streaming chunks by requestId, segments the session by human
prompt, and attributes tool-result bytes back to the tool that produced them.

Usage: doctor-session-cost.py <transcript.jsonl | project_dir_name>
       doctor-session-cost.py --latest [project_dir_name]
A project_dir_name is a directory under ~/.claude/projects (newest session wins).
Prints a JSON report to stdout. Never prints transcript text bodies — only
prompt prefixes (80 chars) needed to label a segment.
"""
import json
import os
import sys
import glob
import datetime
from collections import Counter, defaultdict

PROJECTS = os.path.expanduser("~/.claude/projects")
PROMPT_LABEL_CHARS = 80
IDLE_GAP_S = 300          # a gap this long or longer is the operator away, not work
BUCKET = 50               # requests per context-growth bucket


def resolve(argv):
    args = [a for a in argv[1:] if a != "--latest"]
    target = args[0] if args else None
    if target and os.path.isfile(target):
        return target
    pat = os.path.join(PROJECTS, f"*{target}*" if target else "*", "*.jsonl")
    files = sorted(glob.glob(pat), key=os.path.getmtime, reverse=True)
    if not files:
        sys.exit(f"no transcript matched: {target or '<any>'}")
    return files[0]


def load(path):
    recs = []
    for line in open(path, "r", errors="replace"):
        try:
            r = json.loads(line)
        except ValueError:
            continue
        if r.get("timestamp"):
            recs.append(r)
    recs.sort(key=lambda r: r["timestamp"])
    return recs


def ts(s):
    return datetime.datetime.fromisoformat(s.replace("Z", "+00:00"))


def ctx(u):
    return (u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0)
            + u.get("cache_creation_input_tokens", 0))


def text_of(msg):
    c = msg.get("content")
    return c if isinstance(c, str) else json.dumps(c)


def main():
    path = resolve(sys.argv)
    recs = load(path)

    types = Counter(r.get("type") for r in recs)
    attach = Counter()
    attach_bytes = Counter()
    blocking = Counter()          # distinct blocking-hook text -> count
    models = Counter()
    tools = Counter()
    reads = Counter()
    writes = Counter()
    subagents = []
    compactions = []
    tool_names = {}               # tool_use_id -> name
    result_bytes = defaultdict(lambda: {"results": 0, "bytes": 0, "max": 0})

    # requests, deduplicated by requestId (one API call streams as many records)
    seen_req = set()
    reqs = []                     # (timestamp, usage) in order

    segments = []
    cur = None

    for r in recs:
        t = r.get("type")

        if t == "attachment":
            a = r.get("attachment") or {}
            k = a.get("type", "none")
            attach[k] += 1
            attach_bytes[k] += len(json.dumps(r))
            if k == "hook_blocking_error":
                blocking[str((a.get("blockingError") or {}).get("blockingError"))[:200]] += 1

        if r.get("isCompactSummary"):
            compactions.append(r["timestamp"])

        if t == "user" and (r.get("origin") or {}).get("kind") == "human":
            if cur:
                segments.append(cur)
            cur = {"prompt": text_of(r.get("message") or {})[:PROMPT_LABEL_CHARS].replace("\n", " "),
                   "t0": r["timestamp"], "t1": r["timestamp"], "reqs": 0,
                   "tools": 0, "edits": 0, "output": 0, "cache_read": 0}

        if t == "user":
            for c in (r.get("message") or {}).get("content") or []:
                if isinstance(c, dict) and c.get("type") == "tool_result":
                    n = tool_names.get(c.get("tool_use_id"), "unknown")
                    b = len(json.dumps(c.get("content")))
                    e = result_bytes[n]
                    e["results"] += 1
                    e["bytes"] += b
                    e["max"] = max(e["max"], b)
            tur = r.get("toolUseResult")
            if isinstance(tur, dict) and tur.get("agentType"):
                subagents.append({"agent": tur["agentType"], "model": tur.get("resolvedModel"),
                                  "tokens": tur.get("totalTokens"), "ms": tur.get("totalDurationMs"),
                                  "tool_calls": tur.get("totalToolUseCount")})

        if t != "assistant":
            continue

        msg = r.get("message") or {}
        models[msg.get("model", "none")] += 1
        u = msg.get("usage") or {}
        rid = r.get("requestId")
        if u and rid and rid not in seen_req:
            seen_req.add(rid)
            reqs.append((r["timestamp"], u))
            if cur:
                cur["reqs"] += 1
                cur["output"] += u.get("output_tokens", 0)
                cur["cache_read"] += u.get("cache_read_input_tokens", 0)
        for c in msg.get("content") or []:
            if not (isinstance(c, dict) and c.get("type") == "tool_use"):
                continue
            name = c.get("name", "?")
            tool_names[c.get("id")] = name
            tools[name] += 1
            inp = c.get("input") or {}
            if name == "Read":
                reads[inp.get("file_path", "?")] += 1
            if name in ("Edit", "Write"):
                writes[inp.get("file_path", "?")] += 1
            if name == "Agent":
                tools["Agent:" + str(inp.get("subagent_type", "default"))] += 0
            if cur:
                cur["tools"] += 1
                if name in ("Edit", "Write"):
                    cur["edits"] += 1
        if cur:
            cur["t1"] = r["timestamp"]
    if cur:
        segments.append(cur)

    sizes = [ctx(u) for _, u in reqs]
    sizes_sorted = sorted(sizes)
    times = [ts(r["timestamp"]) for r in recs]
    gaps = [(times[i + 1] - times[i]).total_seconds() for i in range(len(times) - 1)]

    for s in segments:
        s["minutes"] = round((ts(s.pop("t1")) - ts(s.pop("t0"))).total_seconds() / 60, 1)
    segments.sort(key=lambda s: -s["reqs"])

    report = {
        "transcript": path,
        "records": dict(types.most_common()),
        "requests": len(reqs),
        "human_prompts": len(segments),
        "requests_per_human_prompt": round(len(reqs) / max(len(segments), 1), 1),
        "tokens": {k: sum(u.get(f, 0) for _, u in reqs) for k, f in
                   (("input", "input_tokens"), ("output", "output_tokens"),
                    ("cache_read", "cache_read_input_tokens"),
                    ("cache_create", "cache_creation_input_tokens"))},
        "context": {
            "first": sizes[0] if sizes else 0,
            "min": sizes_sorted[0] if sizes else 0,
            "median": sizes_sorted[len(sizes) // 2] if sizes else 0,
            "max": sizes_sorted[-1] if sizes else 0,
            "mean": round(sum(sizes) / len(sizes)) if sizes else 0,
            # floor x requests = tokens paid just to re-read the static prefix
            "static_floor_cost": (sizes_sorted[0] if sizes else 0) * len(reqs),
            "growth": [{"from_request": i, "mean": round(sum(sizes[i:i + BUCKET]) / len(sizes[i:i + BUCKET]))}
                       for i in range(0, len(sizes), BUCKET)],
        },
        "wall_clock_hours": {
            "span": round((times[-1] - times[0]).total_seconds() / 3600, 1) if times else 0,
            "active": round(sum(g for g in gaps if g < IDLE_GAP_S) / 3600, 1),
            "idle": round(sum(g for g in gaps if g >= IDLE_GAP_S) / 3600, 1),
        },
        "models": dict(models.most_common()),
        "tool_calls": dict(tools.most_common()),
        "tool_result_bytes": dict(sorted(result_bytes.items(), key=lambda kv: -kv[1]["bytes"])),
        "attachments": {k: {"n": attach[k], "bytes": attach_bytes[k]}
                        for k, _ in attach_bytes.most_common()},
        "repeated_blocking_hooks": [{"count": n, "text": t} for t, n in blocking.most_common()],
        "subagents": {"n": len(subagents),
                      "tokens": sum(s["tokens"] or 0 for s in subagents),
                      "minutes": round(sum(s["ms"] or 0 for s in subagents) / 60000, 1),
                      "runs": subagents},
        "compactions": compactions,
        "reread_files": [{"path": p, "reads": n} for p, n in reads.most_common(10) if n > 1],
        "rewritten_files": [{"path": p, "edits": n} for p, n in writes.most_common(10) if n > 1],
        "segments": segments,
    }
    json.dump(report, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Profile the /code verify episodes inside one Claude Code transcript.

An episode is one fan-out of `wm:spec-verifier` agents. It splits in two:

  Phase 0  the user prompt (or the preceding assistant turn) up to the first
           spec-verifier Task call - the inline checks the driver runs itself
  Phase 1  the first spec-verifier Task call up to the last verifier result

Per phase it prints wall clock, driver turns, tool calls by name, and tokens.
Subagent cost is summed from the sidechain entries whose timestamps fall inside
the phase.

usage: wm-verify-profile.py <transcript.jsonl> [--json]
"""
import json
import sys
from collections import Counter
from datetime import datetime


def ts(entry):
    raw = entry.get("timestamp")
    if not raw:
        return None
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def usage_of(entry):
    msg = entry.get("message") or {}
    u = msg.get("usage") or {}
    return (
        u.get("output_tokens", 0),
        u.get("cache_read_input_tokens", 0),
        u.get("cache_creation_input_tokens", 0),
        u.get("input_tokens", 0),
    )


def blocks(entry):
    msg = entry.get("message") or {}
    content = msg.get("content")
    return content if isinstance(content, list) else []


def is_human_prompt(entry):
    if entry.get("type") != "user" or entry.get("isSidechain") or entry.get("isMeta"):
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return bool(content.strip())
    if isinstance(content, list):
        kinds = {b.get("type") for b in content}
        return "tool_result" not in kinds and "text" in kinds
    return False


def agent_runs(transcript_path, task_ids):
    """Subagent transcripts for these Task ids: <session>/subagents/agent-*.jsonl."""
    import glob
    import os

    base = transcript_path[:-6] if transcript_path.endswith(".jsonl") else transcript_path
    runs = []
    for meta_path in sorted(glob.glob(os.path.join(base, "subagents", "*.meta.json"))):
        try:
            meta = json.load(open(meta_path, encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if meta.get("toolUseId") not in task_ids:
            continue
        body = meta_path[: -len(".meta.json")] + ".jsonl"
        entries = load(body)
        stamps = [t for t in (ts(e) for e in entries) if t]
        stats = span_stats(entries, 0, len(entries) - 1)
        runs.append(
            {
                "description": meta.get("description"),
                "model": meta.get("model"),
                "minutes": minutes(min(stamps), max(stamps)) if stamps else None,
                **stats,
            }
        )
    return runs


def load(path):
    out = []
    for line in open(path, encoding="utf-8", errors="replace"):
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def find_episodes(entries):
    """Return [(start_idx, first_task_idx, end_idx, agent_labels)] per fan-out."""
    verifier_calls = []
    for i, e in enumerate(entries):
        if e.get("isSidechain"):
            continue
        for b in blocks(e):
            if b.get("type") == "tool_use" and b.get("name") in ("Task", "Agent"):
                inp = b.get("input") or {}
                if inp.get("subagent_type") == "wm:spec-verifier":
                    verifier_calls.append((i, b.get("id"), inp.get("description") or ""))
    if not verifier_calls:
        return []

    episodes = []
    group = [verifier_calls[0]]
    for call in verifier_calls[1:]:
        prev_t = ts(entries[group[-1][0]])
        cur_t = ts(entries[call[0]])
        gap = (cur_t - prev_t).total_seconds() if prev_t and cur_t else 0
        if gap > 1800:
            episodes.append(group)
            group = [call]
        else:
            group.append(call)
    episodes.append(group)

    resolved = []
    for group in episodes:
        first = group[0][0]
        ids = {c[1] for c in group}
        start = first
        for j in range(first, -1, -1):
            if is_human_prompt(entries[j]):
                start = j
                break
        end = group[-1][0]
        for j in range(first, len(entries)):
            e = entries[j]
            if e.get("isSidechain"):
                continue
            for b in blocks(e):
                if b.get("type") == "tool_result" and b.get("tool_use_id") in ids:
                    end = max(end, j)
        resolved.append((start, first, end, [c[2] for c in group], ids))
    return resolved


def span_stats(entries, lo, hi, sidechain=None):
    turns = 0
    tools = Counter()
    out = cread = ccreate = 0
    for e in entries[lo : hi + 1]:
        if sidechain is not None and bool(e.get("isSidechain")) != sidechain:
            continue
        if e.get("type") != "assistant":
            continue
        turns += 1
        o, r, c, _ = usage_of(e)
        out += o
        cread += r
        ccreate += c
        for b in blocks(e):
            if b.get("type") == "tool_use":
                tools[b.get("name")] += 1
    return {"turns": turns, "tools": tools, "out": out, "cache_read": cread, "cache_creation": ccreate}


def minutes(a, b):
    if not a or not b:
        return None
    return round((b - a).total_seconds() / 60, 1)


def report(path, as_json=False):
    entries = load(path)
    episodes = find_episodes(entries)
    if not episodes:
        print(f"no wm:spec-verifier fan-out in {path}")
        return 1

    result = []
    for start, first, end, labels, ids in episodes:
        t_start, t_first, t_end = ts(entries[start]), ts(entries[first]), ts(entries[end])
        p0 = span_stats(entries, start, first, sidechain=False)
        p1_driver = span_stats(entries, first, end, sidechain=False)
        p1_agents = span_stats(entries, first, end, sidechain=True)
        result.append(
            {
                "agents": len(labels),
                "labels": labels,
                "started": t_start.isoformat() if t_start else None,
                "phase0_min": minutes(t_start, t_first),
                "phase1_min": minutes(t_first, t_end),
                "phase0": p0,
                "phase1_driver": p1_driver,
                "phase1_agents": p1_agents,
                "runs": agent_runs(path, ids),
            }
        )

    if as_json:
        print(json.dumps(result, default=lambda o: dict(o) if isinstance(o, Counter) else str(o), indent=2))
        return 0

    for n, ep in enumerate(result, 1):
        print(f"\n=== episode {n}  ({ep['started']})  {ep['agents']} verifier agent(s)")
        for label in ep["labels"]:
            print(f"      · {label}")
        for name, key, mins in (
            ("phase 0  driver inline", "phase0", ep["phase0_min"]),
            ("phase 1  driver", "phase1_driver", ep["phase1_min"]),
        ):
            s = ep[key]
            top = ", ".join(f"{k}×{v}" for k, v in s["tools"].most_common(6)) or "-"
            print(
                f"  {name:<24} {str(mins) + ' min':>10}  turns={s['turns']:<4} "
                f"out={s['out']:<8} cache_read={s['cache_read']:<11} tools: {top}"
            )
        print(f"  {'phase 1  agents':<24}")
        for r in ep["runs"]:
            top = ", ".join(f"{k}×{v}" for k, v in r["tools"].most_common(5)) or "-"
            print(
                f"      {r['description'][:30]:<30} {r['model'] or '?':<7} "
                f"{str(r['minutes']) + ' min':>9}  turns={r['turns']:<4} out={r['out']:<7} "
                f"cache_read={r['cache_read']:<10} tools: {top}"
            )
        if ep["runs"]:
            print(
                f"      {'TOTAL':<30} {'':<7} "
                f"{'slowest ' + str(max((r['minutes'] or 0) for r in ep['runs'])) + ' min':>9}  "
                f"turns={sum(r['turns'] for r in ep['runs']):<4} "
                f"out={sum(r['out'] for r in ep['runs']):<7} "
                f"cache_read={sum(r['cache_read'] for r in ep['runs'])}"
            )
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        sys.exit(2)
    sys.exit(report(args[0], as_json="--json" in sys.argv))

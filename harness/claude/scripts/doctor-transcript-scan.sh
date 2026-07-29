#!/usr/bin/env bash
# doctor-transcript-scan.sh — aggregate /doctor signals from Claude Code transcripts.
# Usage: doctor-transcript-scan.sh [N]   (N = most-recent transcripts to scan, default 50)
set -uo pipefail

N="${1:-50}"
mapfile -t FILES < <(ls -t "$HOME"/.claude/projects/*/*.jsonl 2>/dev/null | head -n "$N")
[ "${#FILES[@]}" -eq 0 ] && { echo "no transcripts"; exit 1; }

echo "=== WINDOW ==="
echo "files: ${#FILES[@]}"
stat -f '%m' "${FILES[@]}" | sort -n | awk 'NR==1{o=$1} {n=$1} END{
  printf "oldest: %s\nnewest: %s\n", strftime("%Y-%m-%d", o), strftime("%Y-%m-%d", n)}' 2>/dev/null \
  || python3 -c 'import sys,os,datetime;fs=sys.argv[1:];ts=sorted(os.path.getmtime(f) for f in fs);print("oldest:",datetime.date.fromtimestamp(ts[0]),"\nnewest:",datetime.date.fromtimestamp(ts[-1]))' "${FILES[@]}"
echo "projects: $(printf '%s\n' "${FILES[@]}" | xargs -n1 dirname | sort -u | wc -l | tr -d ' ')"

python3 - "${FILES[@]}" <<'PY'
import json, sys, collections

files = sys.argv[1:]
mcp = collections.Counter()
skills = collections.Counter()
cmds = collections.Counter()
hooks = collections.defaultdict(list)
hook_timeouts = collections.Counter()
denials = collections.Counter()          # (pattern, kind)
tool_by_id = {}
pending = []                             # (tool_use_id, kind)

for f in files:
    try:
        fh = open(f, encoding="utf-8", errors="replace")
    except OSError:
        continue
    with fh:
        for line in fh:
            line = line.strip()
            if not line or line[0] != "{":
                continue
            try:
                o = json.loads(line)
            except Exception:
                continue
            t = o.get("type")
            if t == "assistant":
                for c in (o.get("message") or {}).get("content") or []:
                    if not isinstance(c, dict) or c.get("type") != "tool_use":
                        continue
                    name = c.get("name") or ""
                    inp = c.get("input") if isinstance(c.get("input"), dict) else {}
                    tool_by_id[c.get("id")] = (name, inp)
                    if name.startswith("mcp__"):
                        mcp[name] += 1
                    elif name == "Skill":
                        s = inp.get("skill")
                        if isinstance(s, str):
                            skills[s] += 1
            elif t == "attachment":
                a = o.get("attachment") or {}
                at = a.get("type") or ""
                if at.startswith("hook_"):
                    key = (a.get("hookName") or "?", a.get("hookEvent") or "?")
                    d = a.get("durationMs")
                    if isinstance(d, (int, float)):
                        hooks[key].append(d)
                    if at == "hook_cancelled" and a.get("timedOut"):
                        hook_timeouts[key] += 1
            elif t == "user":
                kind = o.get("toolDenialKind")
                content = (o.get("message") or {}).get("content")
                if isinstance(content, str) and "<command-name>" in content:
                    seg = content.split("<command-name>", 1)[1].split("</command-name>", 1)[0]
                    cmds[seg.strip().lstrip("/")] += 1
                if kind and kind not in ("interrupted", "cancelled"):
                    ids = []
                    if isinstance(content, list):
                        for c in content:
                            if isinstance(c, dict) and c.get("type") == "tool_result":
                                ids.append(c.get("tool_use_id"))
                    for i in ids:
                        pending.append((i, kind))

def pattern(name, inp):
    if name == "Bash":
        cmd = inp.get("command") or ""
        parts = cmd.split()
        return " ".join(parts[:2]) if parts else "Bash(?)"
    return name

for i, kind in pending:
    if i in tool_by_id:
        n, inp = tool_by_id[i]
        denials[(pattern(n, inp), kind)] += 1

def dump(title, counter, limit=None):
    print(f"\n=== {title} ===")
    items = counter.most_common(limit)
    if not items:
        print("(none)")
    for k, v in items:
        print(f"{v}\t{k}")

dump("MCP TOOL CALLS", mcp)
dump("SKILL DISPATCHES", skills)
dump("SLASH COMMANDS", cmds, 40)

print("\n=== HOOK TIMINGS (n / p50 / max ms) ===")
if not hooks:
    print("(none recorded)")
for (name, ev), ds in sorted(hooks.items(), key=lambda kv: -max(kv[1])):
    ds = sorted(ds)
    print(f"{len(ds)}\t{ds[len(ds)//2]:.0f}\t{ds[-1]:.0f}\t{name} [{ev}]")
print("\n=== HOOK TIMEOUTS ===")
for k, v in hook_timeouts.most_common():
    print(f"{v}\t{k}")
if not hook_timeouts:
    print("(none)")

print("\n=== DENIALS (count / kind / pattern) ===")
if not denials:
    print("(none)")
agg = collections.Counter()
for (pat, kind), v in denials.items():
    agg[pat] += v
for pat, total in agg.most_common(40):
    kinds = {k: v for (p, k), v in denials.items() if p == pat}
    print(f"{total}\t{kinds}\t{pat}")
PY

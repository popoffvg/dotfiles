"""Cause trace, strict judge, and replay: the model calls and the files they write.

A verdict dir holds the work for one session: `trace.json`, `judge-<n>.json`,
`replay-<n>.json`, and `logs/`. A week dir holds the cross-session work:
`judge-group-<n>.json`, `replay-group-<n>.json`, `impact.json`, `report.md`.
The prompts are the files in `skills/dream/references/`.
"""
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import time

PLUGIN = pathlib.Path(__file__).resolve().parent.parent
PROMPTS = PLUGIN / "skills/dream/references"
HOME = pathlib.Path.home()
SI_ROOT = pathlib.Path(os.environ.get("SELF_IMPROVE_ROOT", HOME / ".claude/self-improvement"))
RECORDS = pathlib.Path(os.environ.get("SELF_IMPROVE_RECORDS_DIR", SI_ROOT / "sessions"))
VERDICTS = pathlib.Path(os.environ.get("SELF_IMPROVE_VERDICTS_DIR", SI_ROOT / "verdicts"))
CALL_TIMEOUT = 1800

RULE_STORES = [
    "~/.claude/CLAUDE.md",
    "~/git/dotfiles/harness/claude/rules/",
    "~/git/dotfiles/harness/claude/skills/",
    "~/git/dotfiles/harness/plugins/*/skills/",
    "~/git/dotfiles/harness/plugins/*/agents/",
    "~/.notes/rules/",
    "<the session's repo>/.notes/**/PATTERNS.md and <repo>/.notes/**/RULES.md",
]

TRACE_SCHEMA = {
    "type": "object",
    "properties": {"causes": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "slug": {"type": "string"},
            "corrections": {"type": "array", "items": {"type": "object", "properties": {
                "line": {"type": "integer"}, "at": {"type": "string"}, "words": {"type": "string"}},
                "required": ["line", "at", "words"]}},
            "defect": {"type": "object", "properties": {
                "what": {"type": "string"}, "transcript_line": {"type": "integer"}, "agent": {"type": "string"}},
                "required": ["what", "agent"]},
            "input": {"type": "object", "properties": {
                "kind": {"type": "string", "enum": ["user", "spec", "todo", "adr", "review", "orchestrator_prompt", "skill_rule", "none"]},
                "where": {"type": "string"}, "quote": {"type": "string"}},
                "required": ["kind", "where", "quote"]},
            "producer": {"type": "string"},
            "producer_harness": {"type": "string"},
            "hop_mutation": {"type": ["string", "null"]},
            "defect_snippet": {"type": "string"},
            "fixed_snippet": {"type": "string"},
        },
        "required": ["slug", "corrections", "defect", "input", "producer", "producer_harness", "defect_snippet", "fixed_snippet"]}}},
    "required": ["causes"],
}

GATES = ["defect-located", "strong-signal", "reaches-past-task", "checkable", "not-covered", "neighbour-case"]
JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "gates": {"type": "array", "items": {"type": "object", "properties": {
            "gate": {"type": "string", "enum": GATES}, "pass": {"type": "boolean"}, "evidence": {"type": "string"}},
            "required": ["gate", "pass", "evidence"]}},
        "verdict": {"type": "string", "enum": ["ACCEPT", "REJECT"]},
        "reject_gate": {"type": "string"},
        "reject_reason": {"type": "string"},
        "container": {"type": "string", "enum": ["global-rule", "project-pattern", "producer-fix", "agent-rule", ""]},
        "target": {"type": "string"},
        "title": {"type": "string"},
        "body": {"type": "string"},
        "not_for": {"type": "string"},
        "neighbour_snippet": {"type": "string"},
        "existing_rule": {"type": "object", "properties": {
            "file": {"type": "string"}, "line": {"type": "integer"}, "quote": {"type": "string"}},
            "required": ["file", "quote"]},
    },
    "required": ["gates", "verdict"],
}

REPLAY_SCHEMA = {
    "type": "object",
    "properties": {"verdict": {"type": "string", "enum": ["PASS", "FAIL", "N/A"]}, "quote": {"type": "string"}},
    "required": ["verdict"],
}

IMPACT_SCHEMA = {
    "type": "object",
    "properties": {"rows": {"type": "array", "items": {"type": "object", "properties": {
        "pair": {"type": "string"}, "verdict": {"type": "string", "enum": ["prevents", "no"]}, "why": {"type": "string"}},
        "required": ["pair", "verdict", "why"]}}},
    "required": ["rows"],
}


def claude(prompt, model, schema, tools, budget, log_path):
    """One `claude -p` call with hooks off and no saved session. Returns (structured_output or None, metrics)."""
    cmd = [
        "claude", "-p", "--model", model,
        "--output-format", "json", "--json-schema", json.dumps(schema),
        "--no-session-persistence", "--max-budget-usd", str(budget),
        "--settings", json.dumps({"disableAllHooks": True}),
        "--disallowedTools", "Edit", "Write", "MultiEdit", "NotebookEdit", "Task", "Agent", "WebFetch", "WebSearch",
    ]
    if tools:
        cmd += ["--allowedTools", *tools]
    else:
        cmd += ["--disallowedTools", "Bash", "Read", "Grep", "Glob"]
    env = dict(os.environ, SELF_IMPROVE_CHILD="1")
    start = time.monotonic()
    try:
        proc = subprocess.run(cmd, input=prompt, capture_output=True, text=True,
                              cwd=HOME, env=env, timeout=CALL_TIMEOUT)
        out, err, code = proc.stdout, proc.stderr, proc.returncode
    except subprocess.TimeoutExpired:
        out, err, code = "", "timeout", -1
    wall = time.monotonic() - start
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(f"exit={code}\n--- stderr\n{err}\n--- stdout\n{out}\n")
    data = {}
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        pass
    metrics = {
        "model": model, "wall_s": round(wall, 1), "exit": code,
        "turns": data.get("num_turns"), "cost_usd": data.get("total_cost_usd"),
        "at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    return data.get("structured_output"), metrics


def human_turns(transcript):
    return subprocess.run([str(PLUGIN / "scripts/human-turns.sh"), str(transcript)],
                          capture_output=True, text=True).stdout


NOTE_PATH = re.compile(r"[\w./~-]*(?:\.notes|harness|\.claude)/[\w./-]+\.(?:md|qnt)")


def files_named(transcript):
    """The spec, note, and rule files that the agents of the session named, in a prompt, a tool call, or a result."""
    paths = [pathlib.Path(transcript)]
    sub = pathlib.Path(transcript).with_suffix("") / "subagents"
    if sub.exists():
        paths += sorted(sub.glob("agent-*.jsonl"))
    seen = {}
    for p in paths:
        agent = "main" if p == paths[0] else p.stem.removeprefix("agent-")
        with open(p, errors="replace") as fh:
            for line in fh:
                for fp in NOTE_PATH.findall(line):
                    if "/review/" in fp or "/subagents/" in fp:
                        continue
                    seen.setdefault(fp.rstrip("."), set()).add(agent)
    rows = sorted(seen.items(), key=lambda x: (-len(x[1]), x[0]))
    return "\n".join(f"- {fp}  (named by {len(a)} agents: {', '.join(sorted(a)[:6])})" for fp, a in rows) or "(none)"


def session_end(transcript):
    last = None
    with open(transcript, errors="replace") as fh:
        for line in fh:
            try:
                ts = json.loads(line).get("timestamp")
            except json.JSONDecodeError:
                continue
            if ts:
                last = ts
    return last


def stamp(causes, transcript):
    """Set each correction's `at` from its transcript line; the model's own `at` is not trusted."""
    want = {c.get("line") for x in causes for c in x.get("corrections", []) if c.get("line")}
    times = {}
    if want and os.path.exists(transcript):
        with open(transcript, errors="replace") as fh:
            for n, line in enumerate(fh, 1):
                if n in want:
                    try:
                        times[n] = json.loads(line).get("timestamp")
                    except json.JSONDecodeError:
                        pass
    for x in causes:
        for c in x.get("corrections", []):
            c["at"] = times.get(c.get("line")) or ""
    return causes


def parse_ts(ts):
    try:
        return dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return None


def load(path):
    return json.loads(path.read_text()) if path.exists() else None


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f".tmp.{os.getpid()}")
    tmp.write_text(json.dumps(data, indent=1))
    tmp.replace(path)


def trace(sid, transcript, out_dir):
    dest = out_dir / "trace.json"
    if (cached := load(dest)) is not None:
        return cached
    sub = pathlib.Path(transcript).with_suffix("") / "subagents"
    prompt = (PROMPTS / "trace.md").read_text() + f"""

---

Transcript: {transcript}
Subagent dir: {sub} ({'exists' if sub.exists() else 'absent'})

The spec, note, and rule files that the agents of this session named. Before you write input `none` for a code defect, `Grep` these files for the primitive, call, or shape of the defect (for example `mutex`, `retry`, `read back`):

{files_named(transcript)[:20000]}

The prompts the person typed, with line numbers and timestamps:

{human_turns(transcript)[-60000:]}
"""
    out, m = claude(prompt, "sonnet", TRACE_SCHEMA,
                    ["Read", "Grep", "Glob", "Bash(jq:*)", "Bash(git show:*)", "Bash(git log:*)"],
                    6, out_dir / "logs/trace.log")
    result = {"session": sid, "transcript": str(transcript), "session_end": session_end(transcript),
              "causes": stamp((out or {}).get("causes", []), transcript), "metrics": m, "ok": out is not None}
    save(dest, result)
    return result


def judge(key, cause, out_dir):
    dest = out_dir / f"judge-{key}.json"
    if (cached := load(dest)) is not None:
        return cached
    stores = "\n".join(f"- {s}" for s in RULE_STORES)
    prompt = (PROMPTS / "judge.md").read_text() + f"""

---

Rule stores to search:
{stores}

The traced cause:

```json
{json.dumps(cause, indent=1)}
```
"""
    out, m = claude(prompt, "opus", JUDGE_SCHEMA, ["Read", "Grep", "Glob"], 4, out_dir / f"logs/judge-{key}.log")
    result = {"key": key, "cause": cause, "judge": out, "metrics": m, "ok": out is not None}
    save(dest, result)
    return result


def accepted(j):
    return bool(j.get("judge")) and j["judge"].get("verdict") == "ACCEPT"


def replay(key, j, out_dir):
    dest = out_dir / f"replay-{key}.json"
    if (cached := load(dest)) is not None:
        return cached
    jd = j["judge"]
    rule = f"# {jd.get('title', '')}\n\n{jd.get('body', '')}\n\nNot for: {jd.get('not_for', '')}"
    arms = {"defect": j["cause"].get("defect_snippet", ""), "fixed": j["cause"].get("fixed_snippet", ""),
            "neighbour": jd.get("neighbour_snippet", "")}
    expect = {"defect": "FAIL", "fixed": "PASS", "neighbour": "PASS"}
    res = {"arms": {}, "metrics": []}
    for arm, text in arms.items():
        if not text.strip():
            res["arms"][arm] = {"verdict": "N/A", "expected": expect[arm], "skipped": True}
            continue
        prompt = (PROMPTS / "replay.md").read_text() + f"\n\n---\n\nRule:\n\n{rule}\n\nArtifact:\n\n```\n{text}\n```\n"
        out, m = claude(prompt, "haiku", REPLAY_SCHEMA, None, 0.5, out_dir / f"logs/replay-{key}-{arm}.log")
        res["arms"][arm] = {**(out or {"verdict": "ERROR"}), "expected": expect[arm]}
        res["metrics"].append(m)
    res["defect_caught"] = res["arms"]["defect"]["verdict"] == "FAIL"
    checked = [a for a in res["arms"].values() if not a.get("skipped")]
    # A note must catch its own defect; a note with no defect snippet has nothing to prove and does not pass.
    res["pass"] = res["defect_caught"] and all(a["verdict"] == a["expected"] for a in checked)
    save(dest, res)
    return res


PRODUCER_FILE = re.compile(r"[\w-]+\.md")


def producer_key(text):
    """The producer's file when the trace names one (`sub-todo.md`), else its first clause."""
    head = text.split(";")[0].strip().lower()
    m = PRODUCER_FILE.search(head)
    return m.group(0) if m else head.split("(")[0].strip()


def producer_groups(judges):
    """The causes whose input came from one harness producer, as one aggregate cause per producer with 2+ causes."""
    groups = {}
    for j in judges:
        ph = producer_key(j["cause"].get("producer_harness") or "")
        if not ph or ph in ("model-default", "person") or j["cause"]["input"].get("kind") in ("none", "user"):
            continue
        groups.setdefault(ph, []).append(j)
    out = []
    for ph, members in sorted(groups.items()):
        if len(members) < 2:
            continue
        causes = [m["cause"] for m in members]
        out.append({
            "slug": f"producer:{ph}",
            "members": [m["key"] for m in members],
            "producer_harness": ph,
            "corrections": [c for x in causes for c in x["corrections"]],
            "defect": {"what": " | ".join(x["defect"]["what"] for x in causes), "agent": "several"},
            "input": {"kind": causes[0]["input"]["kind"],
                      "where": " | ".join(x["input"]["where"] for x in causes),
                      "quote": "\n---\n".join(x["input"]["quote"] for x in causes)},
            "producer": ph,
            "defect_snippet": "\n---\n".join(x["input"]["quote"] for x in causes)[:6000],
            "fixed_snippet": "",
            "member_causes": causes,
        })
    return out


def first_ts(cause, which):
    times = [t for t in (parse_ts(c.get("at")) for c in cause.get("corrections", [])) if t]
    return (max if which == "last" else min)(times) if times else None


def impact(notes, causes, out_dir):
    """For each final note, the causes of other sessions after it that the note prevents. Each note's own cause is the control."""
    dest = out_dir / "impact.json"
    if (cached := load(dest)) is not None:
        return cached
    pairs = []
    for n in notes:
        own_first = first_ts(n["cause"], "first")
        members = n["cause"].get("members", [])
        control = members[0] if members else n["key"]
        for c in causes:
            if c["key"] == control:
                pairs.append({"pair": f"{n['key']}|{c['key']}", "control": True})
                continue
            if c["key"] in members or c["session"] == n.get("session"):
                continue
            later = [t for t in (parse_ts(x.get("at")) for x in c["cause"].get("corrections", [])) if t]
            if own_first and any(t > own_first for t in later):
                pairs.append({"pair": f"{n['key']}|{c['key']}", "control": False})
    result = {"pairs": pairs, "rows": [], "metrics": None}
    if pairs:
        notes_txt = "\n\n".join(f"## note {n['key']}\n# {n['judge']['title']}\n{n['judge']['body']}\nNot for: {n['judge'].get('not_for', '')}" for n in notes)
        causes_txt = "\n\n".join(
            f"## cause {c['key']}\ndefect: {c['cause']['defect'].get('what', '')}\n"
            f"input followed: {c['cause']['input'].get('quote', '')[:400]}\ndefect snippet:\n{c['cause'].get('defect_snippet', '')[:1500]}"
            for c in causes)
        pair_txt = "\n".join(p["pair"] for p in pairs)
        prompt = (PROMPTS / "impact.md").read_text() + f"\n\n---\n\n# Notes\n\n{notes_txt}\n\n# Causes\n\n{causes_txt}\n\n# Pairs (note|cause)\n\n{pair_txt}\n"
        out, m = claude(prompt, "sonnet", IMPACT_SCHEMA, None, 4, out_dir / "logs/impact.log")
        result.update(rows=(out or {}).get("rows", []), metrics=m)
    save(dest, result)
    return result


DOTFILES = HOME / "git/dotfiles"
RULE_PATH = re.compile(r"([~\w./-]*[\w-]+\.(?:md|py|sh|json|toml|yaml|yml))(?::(\d+))?")
QUOTED = re.compile(r"[\"'\u201c`]([^\"'\u201d`]{15,200})[\"'\u201d`]")


def existing_rule(jd):
    """The rule a `not-covered` reject cites: the judge's field, or the first path and quote in its reason."""
    if jd.get("existing_rule", {}).get("file"):
        return jd["existing_rule"]
    reason = jd.get("reject_reason") or ""
    m = RULE_PATH.search(reason)
    if not m:
        return None
    q = QUOTED.search(reason[m.end():]) or QUOTED.search(reason)
    return {"file": m.group(1), "line": int(m.group(2)) if m.group(2) else None, "quote": q.group(1) if q else ""}


_TRACKED = None


def tracked():
    global _TRACKED
    if _TRACKED is None:
        out = subprocess.run(["git", "-C", str(DOTFILES), "ls-files"], capture_output=True, text=True).stdout
        _TRACKED = [DOTFILES / x for x in out.splitlines()]
    return _TRACKED


def resolve(path, quote=""):
    """The file a judge cites, which is often a short path: the one tracked file that ends with it, or the one that holds the quote."""
    p = pathlib.Path(os.path.expanduser(path))
    if p.is_absolute():
        return p if p.exists() else None
    rel = "/" + str(p).removeprefix("git/dotfiles/").lstrip("./")
    hits = [f for f in tracked() if str(f).endswith(rel)]
    if len(hits) > 1 and quote:
        hits = [f for f in hits if f.exists() and quote[:40] in f.read_text(errors="replace")] or hits
    return hits[0] if len(hits) == 1 else None


def git(cwd, *args):
    r = subprocess.run(["git", "-C", str(cwd), *args], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def rule_added_at(rule):
    """When the cited rule text entered git: the oldest commit that adds the quote, else the oldest commit of the line."""
    quote = max(re.split(r"\.\.\.|\u2026", rule.get("quote", "")), key=len).strip()
    f = resolve(rule.get("file", ""), quote)
    if not f:
        return None
    root = git(f.parent, "rev-parse", "--show-toplevel")
    if not root:
        return None
    rel = os.path.relpath(f, root)
    out = ""
    if len(quote) >= 15:
        out = git(root, "log", "--format=%aI", "-S", quote, "--", rel)
    if not out and rule.get("line"):
        out = git(root, "log", "--format=%aI", "-L", f"{rule['line']},{rule['line']}:{rel}", "--no-patch")
    dates = [parse_ts(x) for x in out.splitlines() if x.strip()]
    dates = [d for d in dates if d]
    return min(dates) if dates else None


def session_start(transcript):
    with open(transcript, errors="replace") as fh:
        for line in fh:
            try:
                ts = json.loads(line).get("timestamp")
            except json.JSONDecodeError:
                continue
            if ts:
                return parse_ts(ts)
    return None


def rule_status(j, started=None):
    """`broken` when the rule is older than the session, `written-after` when the session or a later one wrote it, else `unknown`."""
    jd = j.get("judge") or {}
    if jd.get("reject_gate") != "not-covered":
        return None
    rule = existing_rule(jd)
    added = rule_added_at(rule) if rule else None
    first = first_ts(j["cause"], "first") or min(
        (first_ts(c, "first") for c in j["cause"].get("member_causes", []) if first_ts(c, "first")), default=None)
    if not added or not first:
        return {"status": "unknown", "rule": rule, "added": added and added.isoformat()}
    limit = min(first, started) if started else first
    return {"status": "broken" if added < limit else "written-after", "rule": rule, "added": added.isoformat()}

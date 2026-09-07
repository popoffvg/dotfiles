#!/usr/bin/env python3
"""Aggregate health/events.jsonl into health/rollup.json — the harness health score.

Joins three sources:
  events.jsonl        what actually happened (written by health-collect.py)
  skill inventory     what is installed (loose ~/.claude/skills + plugin caches)
  listing token cost  what each installed skill costs in every session's context

Per-skill buckets:
  DISABLED    switched off in settings skillOverrides and unused — deliberate,
              costs no listing context, and never a prune candidate
  NEW         unused but younger than --min-age; no trigger has had time to
              fire, so its zero is absence of evidence, not evidence of death
  DEAD        installed and enabled, zero invocations inside the window
  BROKEN      errored under a name it still answers to: the error is inside the
              window AND postdates the file's mtime. An error older than the
              SKILL.md that fixed it is history, not a defect
  MISLEADING  invoked, but interrupts follow its loads unusually often
  NEEDY       invoked, but AskUserQuestion follows its loads unusually often
  HEALTHY     invoked and none of the above

Top-level score = healthy listing-tokens / enabled listing-tokens, so a dead
185-token skill hurts more than a dead 41-token one, and a deliberately
disabled skill neither helps nor hurts.

Args: [--days N] (window, default 90) [--out FILE].
Env overrides: SELF_IMPROVE_ROOT, HEALTH_SKILL_ROOTS (colon-separated dirs),
HEALTH_SETTINGS (settings.json holding skillOverrides), HEALTH_PROJECT_ROOTS
(colon-separated dirs whose repos are searched for project-scoped skills).
"""

import argparse
import json
import os
import re
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(os.environ.get("SELF_IMPROVE_ROOT", Path.home() / ".claude" / "self-improvement"))
EVENTS = ROOT / "health" / "events.jsonl"
SETTINGS = Path(os.environ.get("HEALTH_SETTINGS", Path.home() / ".claude" / "settings.json"))
PROXIMITY_LINES = 60
FOLLOW_RATE_FLAG = 0.5

FRONT_RE = re.compile(r"^---\s*$")
COMMENT_RE = re.compile(r"^\s*//.*$", re.M)


def disabled_skills():
    """Names switched off in settings skillOverrides.

    An "off" skill is absent from the model's skill listing, so it costs no
    context and cannot be invoked automatically — its zero usage is the
    setting working, not a skill going stale.
    """
    try:
        data = json.loads(COMMENT_RE.sub("", SETTINGS.read_text()))
    except (OSError, json.JSONDecodeError):
        return set()
    return {k for k, v in (data.get("skillOverrides") or {}).items() if v == "off"}


def project_skill_names():
    """Skill names owned by a repo's own .claude/skills, not by the harness.

    A project skill is missing by design in every other repo, so an "Unknown
    skill" error for one says the model reached across repos — it is not a
    harness component that broke.
    """
    env = os.environ.get("HEALTH_PROJECT_ROOTS")
    roots = [Path(p) for p in env.split(":") if p] if env else [Path.home() / "git"]
    names = set()
    for root in roots:
        if not root.is_dir():
            continue
        for depth in ("*/.claude/skills", "*/*/.claude/skills"):
            for d in root.glob(depth):
                names.update(p.name for p in d.glob("*/") if p.is_dir())
    return names


def enabled_plugins():
    """Plugin names switched on in settings enabledPlugins.

    The cache keeps a copy of every plugin ever installed, enabled or not. A
    disabled plugin's skills are absent from the listing, so counting them
    would bill the context of plugins that are not loaded.
    """
    try:
        data = json.loads(COMMENT_RE.sub("", SETTINGS.read_text()))
    except (OSError, json.JSONDecodeError):
        return None
    return {k.split("@")[0] for k, v in (data.get("enabledPlugins") or {}).items() if v}


def skill_roots():
    env = os.environ.get("HEALTH_SKILL_ROOTS")
    if env:
        return [Path(p) for p in env.split(":") if p]
    roots = [Path.home() / ".claude" / "skills"]
    cache = Path.home() / ".claude" / "plugins" / "cache"
    on = enabled_plugins()
    newest = {}
    for d in cache.glob("*/*/*/skills"):
        plugin = (d.parts[-4], d.parts[-3])
        if on is not None and plugin[1] not in on:
            continue
        version = d.parts[-2]
        if re.fullmatch(r"[\d.]+", version):
            rank = (1, tuple(int(x) for x in version.split(".") if x))
        else:
            rank = (0, (int(d.parent.stat().st_mtime),))
        if plugin not in newest or rank > newest[plugin][0]:
            newest[plugin] = (rank, d)
    roots += [d for _, d in sorted(newest.values(), key=lambda x: str(x[1]))]
    return roots


def read_frontmatter(skill_md):
    name = skill_md.parent.name
    origin = ""
    chars = 0
    lines = skill_md.read_text(errors="replace").splitlines()
    if lines and FRONT_RE.match(lines[0]):
        in_meta = False
        for line in lines[1:]:
            if FRONT_RE.match(line):
                break
            chars += len(line)
            if line.startswith("name:"):
                name = line.split(":", 1)[1].strip()
            if line.strip().startswith("origin:"):
                in_meta = True
                origin = line.split(":", 1)[1].strip()
            elif in_meta and not line.startswith(" "):
                in_meta = False
    return name, origin, max(chars // 4, 10)


def inventory():
    skills = {}
    for root in skill_roots():
        plugin = root.parts[-3] if "cache" in root.parts else ""
        for md in sorted(root.glob("*/SKILL.md")):
            name, origin, tokens = read_frontmatter(md)
            qualified = f"{plugin}:{name}" if plugin and not name.startswith(f"{plugin}:") else name
            st = md.stat()
            skills[qualified] = {"name": qualified, "origin": origin, "tokens": tokens,
                                 "path": str(md), "mtime": st.st_mtime,
                                 "born": getattr(st, "st_birthtime", st.st_mtime)}
    return skills


def norm(name):
    if not name:
        return None
    return name.lstrip("/")


def parse_ts(ts):
    if not ts:
        return None
    try:
        return time.mktime(time.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S"))
    except ValueError:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=90)
    ap.add_argument("--min-age", type=int, default=21,
                    help="days a skill must exist before zero usage counts as DEAD")
    ap.add_argument("--out", default=str(ROOT / "health" / "rollup.json"))
    args = ap.parse_args()
    cutoff = time.time() - args.days * 86400

    skills = defaultdict(lambda: {"uses": 0, "sessions": set(), "last": None,
                                  "unknown": 0, "disabled": 0, "err_last": None,
                                  "loads_followed_by_ask": 0, "loads_followed_by_interrupt": 0})
    hooks = defaultdict(lambda: {"fires": 0, "nags": 0, "crashes": 0,
                                 "last_crash": None, "last_seen": None})
    agents = defaultdict(lambda: {"spawns": 0, "sessions": set()})
    last_load = {}

    if EVENTS.exists():
        for raw in open(EVENTS, encoding="utf-8"):
            try:
                ev = json.loads(raw)
            except json.JSONDecodeError:
                continue
            t = parse_ts(ev.get("ts"))
            if t is not None and t < cutoff:
                continue
            kind = ev.get("ev")
            session = ev.get("session")
            line = ev.get("line", 0)
            if kind in ("skill_load", "slash_command"):
                name = norm(ev.get("name"))
                if not name:
                    continue
                s = skills[name]
                s["uses"] += 1
                s["sessions"].add(session)
                ts = ev.get("ts")
                if ts and (s["last"] is None or ts > s["last"]):
                    s["last"] = ts
                if kind == "skill_load":
                    last_load[session] = (name, line)
            elif kind in ("skill_unknown", "skill_disabled"):
                s = skills[norm(ev.get("name")) or "?"]
                s["unknown" if kind == "skill_unknown" else "disabled"] += 1
                ts = ev.get("ts")
                if ts and (s["err_last"] is None or ts > s["err_last"]):
                    s["err_last"] = ts
            elif kind in ("ask_user", "interrupt", "tool_reject"):
                loaded = last_load.get(session)
                if loaded and line - loaded[1] <= PROXIMITY_LINES:
                    field = ("loads_followed_by_ask" if kind == "ask_user"
                             else "loads_followed_by_interrupt")
                    skills[loaded[0]][field] += 1
            elif kind == "hook_fires":
                h = hooks[ev.get("name") or "?"]
                if ev.get("kind") == "hook_additional_context":
                    h["nags"] += ev.get("count", 0)
                else:
                    h["fires"] += ev.get("count", 0)
            elif kind == "hook_crash":
                h = hooks[ev.get("name") or "?"]
                h["crashes"] += 1
                ts = ev.get("ts")
                if ts and (h["last_crash"] is None or ts > h["last_crash"]):
                    h["last_crash"] = ts
            elif kind == "agent_spawn":
                a = agents[ev.get("name")]
                a["spawns"] += 1
                a["sessions"].add(session)

    inv = inventory()
    off = disabled_skills()
    bare_off = {n.split(":")[-1] for n in off}
    project_names = project_skill_names()
    rows = []
    for qualified, meta in sorted(inv.items()):
        seen = skills.get(qualified) or skills.get(qualified.split(":")[-1])
        uses = seen["uses"] if seen else 0
        bare = qualified.split(":")[-1]
        row = {"skill": qualified, "origin": meta["origin"], "tokens": meta["tokens"],
               "uses": uses,
               "sessions": len(seen["sessions"]) if seen else 0,
               "last_used": seen["last"] if seen else None,
               "errors": (seen["unknown"] + seen["disabled"]) if seen else 0,
               "error_last": seen["err_last"] if seen else None,
               "ask_follow": seen["loads_followed_by_ask"] if seen else 0,
               "interrupt_follow": seen["loads_followed_by_interrupt"] if seen else 0,
               "disabled": qualified in off or bare in bare_off}
        # An error is a defect only if the file has not moved since. An "Unknown
        # skill" logged before the SKILL.md was written is the record of the gap
        # being closed, and re-reporting it forever sends /dream to fix a skill
        # that already works.
        err_t = parse_ts(row["error_last"])
        row["error_predates_file"] = bool(err_t and err_t < meta["mtime"])
        row["age_days"] = int((time.time() - meta["born"]) / 86400)
        if row["errors"] and not row["error_predates_file"]:
            row["bucket"] = "BROKEN"
        elif row["disabled"] and uses == 0:
            row["bucket"] = "DISABLED"
        elif uses == 0 and row["age_days"] < args.min_age:
            # Too young to have had a trigger fire. Zero usage here is the
            # absence of evidence, and pruning on it would delete lessons the
            # day after they were captured.
            row["bucket"] = "NEW"
        elif uses == 0:
            row["bucket"] = "DEAD"
        elif row["interrupt_follow"] / uses >= FOLLOW_RATE_FLAG:
            row["bucket"] = "MISLEADING"
        elif row["ask_follow"] / uses >= FOLLOW_RATE_FLAG:
            row["bucket"] = "NEEDY"
        else:
            row["bucket"] = "HEALTHY"
        rows.append(row)

    bare_inv = {q.split(":")[-1] for q in inv}
    ghost = [{"skill": n, "uses": s["unknown"] + s["disabled"],
              "last_error": s["err_last"],
              "bucket": "PROJECT_SCOPED" if n.split(":")[-1] in project_names else "BROKEN",
              "note": ("owned by a repo's .claude/skills — missing elsewhere by design"
                       if n.split(":")[-1] in project_names
                       else "invoked by name but not installed")}
             for n, s in sorted(skills.items())
             if (s["unknown"] or s["disabled"]) and n not in inv
             and n.split(":")[-1] not in bare_inv]

    # A skill used in the window but absent from the inventory scan (stale plugin
    # cache, since-deleted skill) still deserves a row — usage is evidence, and
    # dropping it would misread the corpus as smaller than the sessions show.
    for n, s in sorted(skills.items()):
        if s["uses"] and n not in inv and n.split(":")[-1] not in bare_inv:
            rows.append({"skill": n, "origin": "", "tokens": 0, "uses": s["uses"],
                         "sessions": len(s["sessions"]), "last_used": s["last"],
                         "errors": s["unknown"] + s["disabled"],
                         "ask_follow": s["loads_followed_by_ask"],
                         "interrupt_follow": s["loads_followed_by_interrupt"],
                         "bucket": "HEALTHY", "note": "used but not in inventory scan"})

    # A DISABLED skill is absent from the model's listing, so it is outside the
    # ratio on both sides: counting it as unhealthy would score the setting that
    # removed its cost as if it were the cost.
    enabled = [r for r in rows if r["bucket"] != "DISABLED"]
    total_tokens = sum(r["tokens"] for r in enabled) or 1
    healthy_tokens = sum(r["tokens"] for r in enabled if r["bucket"] == "HEALTHY")
    buckets = defaultdict(int)
    for r in rows:
        buckets[r["bucket"]] += 1

    rollup = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "window_days": args.days,
        "score": round(healthy_tokens / total_tokens, 3),
        "buckets": dict(buckets),
        "listing_tokens": {"total": total_tokens, "healthy": healthy_tokens,
                           "dead": sum(r["tokens"] for r in rows if r["bucket"] == "DEAD"),
                           "disabled_excluded": sum(r["tokens"] for r in rows
                                                    if r["bucket"] == "DISABLED")},
        "skills": sorted(rows, key=lambda r: (r["bucket"] != "BROKEN", r["uses"], -r["tokens"])),
        "ghost_skills": ghost,
        "hooks": [{"hook": n, **v} for n, v in sorted(hooks.items())],
        "agents": [{"agent": n, "spawns": v["spawns"], "sessions": len(v["sessions"])}
                   for n, v in sorted(agents.items())],
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(f".tmp.{os.getpid()}")
    tmp.write_text(json.dumps(rollup, indent=1))
    tmp.rename(out)
    print(f"health-rollup: score={rollup['score']} buckets={dict(buckets)} -> {out}")


if __name__ == "__main__":
    main()

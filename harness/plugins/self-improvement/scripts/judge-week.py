#!/usr/bin/env python3
"""Judge the producer groups of the judged sessions, check the impact, and write the report.

`judge-week.py [--since YYYY-MM-DD]` (default: Monday of this week)

Reads `verdicts/<session-id>/` for each session that `judge-session.py` judged
and whose record changed since the date. Writes `verdicts/week-<since>/` and
prints the path of its `report.md`. `/dream` Step 0 runs it and turns the report
into review blocks. A second run reuses every call whose result exists.
"""
import argparse
import concurrent.futures as cf
import datetime as dt
import json
import pathlib
import re
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import cause_verdicts as cv  # noqa: E402

IDLE_SECONDS = 300


def judged_sessions(since):
    rows = []
    for f in sorted(cv.RECORDS.glob("*.json")):
        rec = cv.load(f) or {}
        sid = rec.get("session", "")
        vdir = cv.VERDICTS / sid
        if rec.get("updated", "") < since or not (vdir / "trace.json").exists():
            continue
        t = cv.load(vdir / "trace.json")
        judges = []
        for i in range(len(t["causes"])):
            j = cv.load(vdir / f"judge-{i}.json")
            if j:
                j = {**j, "session": sid, "key": f"{sid}:{j['key']}"}
                judges.append(j)
        replays = {f"{sid}:{p.stem.removeprefix('replay-')}": cv.load(p) for p in vdir.glob("replay-*.json")}
        rows.append({"record": rec, "trace": t, "judges": judges, "replays": replays})
    return rows


def fmt_s(s):
    if s is None:
        return "–"
    return f"{s / 60:.1f} min" if s >= 90 else f"{s:.0f} s"


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40]


def main():
    today = dt.date.today()
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default=(today - dt.timedelta(days=today.weekday())).isoformat())
    ap.add_argument("--jobs", type=int, default=3)
    args = ap.parse_args()

    out_dir = cv.VERDICTS / f"week-{args.since}"
    sessions = judged_sessions(args.since)
    judges = [j for s in sessions for j in s["judges"]]
    replays = {k: r for s in sessions for k, r in s["replays"].items()}

    groups = cv.producer_groups(judges)
    gkeys = [f"group-{slug(g['producer_harness'])}-{len(g['members'])}" for g in groups]
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        gjudges = list(ex.map(lambda kg: cv.judge(kg[0], kg[1], out_dir), zip(gkeys, groups)))
    for gj in gjudges:
        gj["session"] = "group"
        if cv.accepted(gj):
            replays[gj["key"]] = cv.replay(gj["key"], gj, out_dir)

    finals = [j for j in judges + gjudges if cv.accepted(j) and replays.get(j["key"], {}).get("pass")]
    causes = [{"key": j["key"], "session": j["session"], "cause": j["cause"]} for j in judges]
    imp = cv.impact(finals, causes, out_dir)

    report = out_dir / "report.md"
    report.write_text(render(args.since, sessions, judges, gjudges, replays, finals, imp))
    print(report)
    return 0


def render(since, sessions, judges, gjudges, replays, finals, imp):
    traces = {s["record"]["session"]: s["trace"] for s in sessions}
    calls = [t["metrics"] for t in traces.values()] + [j["metrics"] for j in judges + gjudges] + \
            [m for r in replays.values() for m in r["metrics"]] + ([imp["metrics"]] if imp.get("metrics") else [])
    cost = sum(m.get("cost_usd") or 0 for m in calls)
    acc = [j for j in judges + gjudges if cv.accepted(j)]
    L = [f"# Cause verdicts since {since}", "",
         "| Measure | Value |", "|---|---|",
         f"| Sessions judged | {len(sessions)} |",
         f"| Causes | {len(judges)}, plus {len(gjudges)} producer groups |",
         f"| Judge ACCEPT | {len(acc)} |",
         f"| Final notes (ACCEPT, and replay catches the defect) | {len(finals)} |",
         f"| Cost | ${cost:.2f} in {len(calls)} model calls |", ""]

    react = []
    for j in judges:
        r = replays.get(j["key"], {"metrics": []})
        react.append(traces[j["session"]]["metrics"]["wall_s"] + j["metrics"]["wall_s"] + sum(m["wall_s"] for m in r["metrics"]))
    stages = {"trace, per session": [t["metrics"]["wall_s"] for t in traces.values()],
              "judge, per cause": [j["metrics"]["wall_s"] for j in judges],
              "correction to note, per cause": react}
    L += ["## Reaction time", "", "| Stage | n | median | max |", "|---|---|---|---|"]
    L += [f"| {k} | {len(v)} | {fmt_s(statistics.median(v)) if v else '–'} | {fmt_s(max(v)) if v else '–'} |" for k, v in stages.items()]
    L.append("")

    L += ["## Final notes", "", "| Note | Container → target | Source | Verdict file |", "|---|---|---|---|"]
    for j in finals:
        jd = j["judge"]
        L.append(f"| {jd.get('title', '')} | {jd.get('container', '')} → `{jd.get('target', '')}` | `{j['session'][:8]}` | `{j['key']}` |")
    L.append("")

    starts = {sid: cv.session_start(t["transcript"]) for sid, t in traces.items() if t.get("transcript") and pathlib.Path(t["transcript"]).exists()}
    status = {j["key"]: cv.rule_status(j, starts.get(j["session"])) for j in judges + gjudges}
    broken = [j for j in judges + gjudges if (status[j["key"]] or {}).get("status") in ("broken", "unknown")]
    after = [j for j in judges + gjudges if (status[j["key"]] or {}).get("status") == "written-after"]
    L += ["## Rules that exist and did not fire", "",
          "The rule entered git before the first correction (`broken`), or its date is not known (`unknown`). "
          "These need a stronger container, not new text.", "",
          "| Session | Cause | Status | Rule | Added |", "|---|---|---|---|---|"]
    for j in broken:
        st = status[j["key"]]
        rule = st.get("rule") or {}
        where = f"`{rule.get('file', '')}{':' + str(rule['line']) if rule.get('line') else ''}`"
        L.append(f"| `{j['session'][:8]}` | {j['cause']['slug']} | {st['status']} | {where} | {(st.get('added') or '–')[:10]} |")
    L += ["", f"Fixed after the session: {len(after)} rules entered git after the correction they answer. No action.", ""]

    gates = {}
    for j in judges + gjudges:
        if j.get("judge") and j["judge"].get("verdict") == "REJECT":
            g = j["judge"].get("reject_gate") or "unknown"
            gates[g] = gates.get(g, 0) + 1
    L += ["## Rejects by gate", "", "| Gate | Rejects |", "|---|---|"]
    L += [f"| `{g}` | {n} |" for g, n in sorted(gates.items(), key=lambda x: -x[1])]
    L.append("")

    L += ["## Producer groups", "", "| Producer | Causes | Verdict |", "|---|---|---|"]
    for g in gjudges:
        jd = g.get("judge") or {}
        L.append(f"| `{g['cause']['producer_harness']}` | {len(g['cause']['members'])} | {jd.get('verdict', 'ERROR')} {jd.get('reject_gate', '')} |")
    L.append("")

    verdicts = {r["pair"]: r["verdict"] for r in imp.get("rows", [])}
    control = [p for p in imp.get("pairs", []) if p["control"]]
    found = sum(1 for p in control if verdicts.get(p["pair"]) == "prevents")
    later = [p for p in imp.get("pairs", []) if not p["control"] and verdicts.get(p["pair"]) == "prevents"]
    L += ["## Later corrections a note would have prevented", "",
          f"Control: the matcher linked {found} of {len(control)} notes to their own cause.", ""]
    L += [f"- `{p['pair']}`" for p in later] or ["None."]
    L.append("")

    L += ["## Compared with the scan suggestion", "", "| Session | Scan suggestion | Causes | Final notes |", "|---|---|---|---|"]
    for s in sessions:
        r = s["record"]
        n = sum(1 for j in finals if j["session"] == r["session"])
        L.append(f"| `{r['session'][:8]}` | {r.get('suggestion_verdict') or '–'} | {len(s['judges'])} | {n} |")
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    sys.exit(main())

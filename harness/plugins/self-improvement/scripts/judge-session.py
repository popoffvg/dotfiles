#!/usr/bin/env python3
"""Trace, judge, and replay one kept session. `judge-session.py <session-id>`

The third stage of a scan, after the score and the suggestion. It writes
`verdicts/<session-id>/` and adds to the session record: `judged_mark` (the
watermark it judged up to), `judged_at`, `causes`, `accepted`, `notes`, and
`verdict_cost_usd`. Each final note (ACCEPT, and the replay catches its own
defect) goes to the inbox. Nothing here edits a skill, a rule, or a doc:
`/dream` shows the notes for review.

A session judged before is judged again from the start when its watermark has
moved, because a new correction can join an old cause.
"""
import concurrent.futures as cf
import datetime as dt
import json
import os
import pathlib
import shutil
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import cause_verdicts as cv  # noqa: E402

JOBS = int(os.environ.get("SELF_IMPROVE_JUDGE_JOBS", "3"))


def main():
    if len(sys.argv) != 2:
        print(f"usage: {pathlib.Path(sys.argv[0]).name} <session-id>", file=sys.stderr)
        return 2
    sid = sys.argv[1]
    rec_path = cv.RECORDS / f"{sid}.json"
    rec = cv.load(rec_path)
    if rec is None:
        print(f"judge-session: no record for {sid}", file=sys.stderr)
        return 1
    transcript = rec.get("transcript") or ""
    if not os.path.exists(transcript):
        transcript = rec.get("archive") or ""
    if not os.path.exists(transcript):
        return 0

    out_dir = cv.VERDICTS / sid
    mark = rec.get("watermark", 0)
    if out_dir.exists() and rec.get("judged_mark", -1) < mark:
        shutil.rmtree(out_dir)

    t = cv.trace(sid, transcript, out_dir)
    keys = [str(i) for i in range(len(t["causes"]))]
    with cf.ThreadPoolExecutor(JOBS) as ex:
        judges = list(ex.map(lambda k: cv.judge(k, t["causes"][int(k)], out_dir), keys))
    notes = []
    metrics = [t["metrics"]] + [j["metrics"] for j in judges]
    for j in judges:
        if not cv.accepted(j):
            continue
        r = cv.replay(j["key"], j, out_dir)
        metrics += r["metrics"]
        if r["pass"]:
            notes.append(j)

    rec = cv.load(rec_path) or rec
    rec.update(
        verdicts=str(out_dir),
        judged_mark=mark,
        judged_at=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        causes=len(judges),
        accepted=sum(1 for j in judges if cv.accepted(j)),
        notes=len(notes),
        verdict_cost_usd=round(sum(m.get("cost_usd") or 0 for m in metrics), 2),
    )
    cv.save(rec_path, rec)

    inbox = cv.PLUGIN / "scripts/inbox-add.sh"
    for j in notes:
        subprocess.run([str(inbox), "verdict", sid, j["judge"].get("title", ""),
                        str(out_dir / f"judge-{j['key']}.json")], check=False)
    print(f"judge-session {sid}: causes={len(judges)} notes={len(notes)} cost=${rec['verdict_cost_usd']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Agent-work metrics over the turn ledger that turn-ledger.py writes.

usage: agent-metrics.py report [--days N]
       agent-metrics.py classify [--days N] [--workers N]

classify sends unlabelled turns to SystemOne models on OpenRouter (token: Keychain OPENROUTER_API_KEY)
and appends to labels.jsonl: the cause of each re-ask (Jev), the quality of each task-start prompt (Jev),
and whether the next prompt corrects an `understood:` line (Clef, the best of the three on corrections).
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import statistics
import subprocess
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

DATA = Path(os.environ.get("HARNESS_DEV_DATA", Path.home() / ".claude" / "harness-dev"))
LABELS = DATA / "labels.jsonl"
NOTES_STORE = Path.home() / ".claude" / "plugins" / "store"
SYSTEMONE_URL = "https://openrouter.ai/api/v1/systemone"
CAUSE_MODEL = "jev-1.13"
QUALITY_MODEL = "jev-1.13"
CORRECTION_MODEL = "cloudflare/clef-flash"
COSTLY_CAUSES = ("missing-in-prompt", "findable")
# Clef puts low probabilities on yes: its median on real corrections was 0.16 against 0.09 on none.
CORRECTION_CUTOFF = 0.3

CAUSE_QUESTION = {
    "type": "choice",
    "instructions": "`prompt` is what a person typed to a coding assistant; `reply` is the end of the assistant's "
                    "answer, which asks the person something. Why did the assistant ask?",
    "criteria": {
        "missing-in-prompt": "The prompt left out information the work needs, and only the person has it.",
        "user-decision": "The work reached a real choice of taste or trade-off that only the person should make.",
        "permission": "The assistant asks to confirm before an action it could take, such as a commit, a delete, or a run.",
        "findable": "The answer was in the repo, the notes, the earlier conversation, or a tool the assistant has.",
    },
}
QUALITY_QUESTION = {
    "type": "score",
    "instructions": "`prompt` starts a task for a coding assistant; `previous` is the assistant's message before it. "
                    "How much does the assistant have to guess?",
    "criteria": [
        "Unclear: the goal is missing or depends on context that was never stated.",
        "Goal only: what to do, but no scope or limits.",
        "Goal and limits: what to do, plus scope, files, or what not to touch.",
        "Goal, limits, and acceptance criteria: how to verify the result or what to report.",
    ],
}
CORRECTION_QUESTION = {
    "type": "noul",
    "instructions": "`understood` is the assistant's summary of a task; `next_prompt` is the person's next message. "
                    "Does `next_prompt` correct the goal, the limits, or the acceptance criteria in `understood`?",
}


def load_turns(days: int | None) -> list[dict]:
    since = time.time() - days * 86400 if days else 0
    turns: dict[tuple, dict] = {}
    for path in sorted(glob.glob(str(DATA / "turns" / "*.jsonl"))):
        for line in open(path, errors="replace"):
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row["ts"] < since:
                continue
            key = (row["session"], row["turn"])
            if row["kind"] == "turn":
                turns[key] = row
            elif key in turns and row.get("triage"):
                turns[key]["triage"] = row["triage"]  # a resumed turn ends with the later tag
    return sorted(turns.values(), key=lambda r: (r["session"], r["turn"]))


def load_labels() -> dict[tuple, str | float]:
    labels = {}
    if LABELS.exists():
        for line in open(LABELS):
            row = json.loads(line)
            labels[(row["session"], row["turn"], row["kind"])] = row["value"]
    return labels


def is_reask(t: dict) -> bool:
    return t.get("triage") == "question" or bool(t.get("asked_tool"))


def tasks_of(turns: list[dict]) -> list[list[dict]]:
    """A task runs from a task-start prompt to the turn that ends with `triage: done`."""
    by_session = defaultdict(list)
    for t in turns:
        by_session[t["session"]].append(t)
    tasks = []
    for session_turns in by_session.values():
        current: list[dict] = []
        for t in session_turns:
            if t.get("task_start") and current:
                tasks.append(current)
                current = []
            current.append(t)
            if t.get("triage") == "done":
                tasks.append(current)
                current = []
        if current:
            tasks.append(current)
    return tasks


def assumption_notes(sessions: set[str]) -> Counter:
    tags = Counter()
    for path in NOTES_STORE.glob("cc-plugin-you-should-know_builtin-*.json"):
        try:
            for s in json.loads(path.read_text()).get("sessions", []):
                if s.get("id") in sessions and s.get("offeredTurn"):
                    tags[s.get("tag") or "untagged"] += 1
        except (OSError, json.JSONDecodeError):
            continue
    return tags


def paste_groups(sessions: set[str]) -> list[dict]:
    store = DATA / "pastes.jsonl"
    groups = defaultdict(list)
    if store.exists():
        for line in open(store, errors="replace"):
            row = json.loads(line)
            groups[row["group"]].append(row)
    out = []
    for rows in groups.values():
        names = {r["session"] for r in rows}
        if len(names) >= 2 and names & sessions:
            out.append({"pastes": len(rows), "sessions": len(names),
                        "first": time.strftime("%Y-%m-%d", time.localtime(min(r["ts"] for r in rows))),
                        "last": time.strftime("%Y-%m-%d", time.localtime(max(r["ts"] for r in rows))),
                        "sample": rows[-1]["sample"][:160]})
    return sorted(out, key=lambda g: (-g["sessions"], -g["pastes"]))


def report(days: int | None) -> None:
    turns = load_turns(days)
    if not turns:
        print(f"no turns in {DATA / 'turns'} yet: the ledger fills as sessions run with harness-dev enabled")
        return
    labels = load_labels()
    sessions = {t["session"] for t in turns}
    tagged = [t for t in turns if t.get("triage")]
    reasks = [t for t in turns if is_reask(t)]
    print(f"window: {'last %d days' % days if days else 'all'}  sessions={len(sessions)}  turns={len(turns)}  "
          f"triage tag on {100 * len(tagged) / len(turns):.0f}% of turns")

    print(f"\n## Re-ask: {100 * len(reasks) / len(turns):.0f}% of prompts got a question back ({len(reasks)})")
    causes = Counter(labels.get((t["session"], t["turn"], "cause"), "unclassified") for t in reasks)
    for cause, n in causes.most_common():
        cost = "  <- cost" if cause in COSTLY_CAUSES else ""
        print(f"  {cause:18} {n:4}{cost}")

    tasks = tasks_of(turns)
    done = [task for task in tasks if task[-1].get("triage") == "done"]
    print(f"\n## Prompts to done: {len(done)} of {len(tasks)} tasks reached `triage: done`")
    if done:
        sizes = [len(task) for task in done]
        print(f"  median {statistics.median(sizes)}  p75 {sorted(sizes)[int(0.75 * (len(sizes) - 1))]}  max {max(sizes)}")
        print("  by first-prompt quality (Jev score, rounded) -> median prompts to done:")
        buckets = defaultdict(list)
        for task in done:
            q = labels.get((task[0]["session"], task[0]["turn"], "quality"))
            if q is not None:
                buckets[round(q)].append(len(task))
        for q in sorted(buckets):
            print(f"    quality {q}: {statistics.median(buckets[q])} (n={len(buckets[q])})")
        if not buckets:
            print("    none labelled yet: run `agent-metrics.py classify`")
        print("  5 longest tasks:")
        for task in sorted(done, key=len, reverse=True)[:5]:
            print(f"    {len(task):3} prompts  {task[0].get('repo', '')[:20]:20} {(task[0].get('prompt') or '')[:90]!r}")

    understood = [t for t in turns if t.get("understood")]
    if understood:
        corrected = sum(labels.get((t["session"], t["turn"], "correction"), 0) >= CORRECTION_CUTOFF for t in understood)
        print(f"\n## Understood lines: {len(understood)}, corrected by the next prompt: {corrected}")
        print(f"  self-scored prompt quality: mean {statistics.mean(t['understood_score'] for t in understood):.2f}")

    groups = paste_groups(sessions)
    print(f"\n## Pasted blocks seen in 2+ sessions: {len(groups)} skill candidates")
    for g in groups[:8]:
        print(f"  {g['sessions']} sessions / {g['pastes']} pastes  {g['first']}..{g['last']}  {g['sample']!r}")

    notes = assumption_notes(sessions)
    if notes:
        print(f"\n## 'You should know' notes in these sessions: {sum(notes.values())}  " +
              "  ".join(f"{tag}={n}" for tag, n in notes.items()))

    print("\n## Per repo")
    by_repo = defaultdict(list)
    for t in turns:
        by_repo[t.get("repo") or "?"].append(t)
    for repo, rs in sorted(by_repo.items(), key=lambda kv: -len(kv[1]))[:10]:
        print(f"  {repo[:28]:28} turns={len(rs):4}  re-ask={100 * sum(map(is_reask, rs)) / len(rs):3.0f}%")


def keychain(name: str) -> str:
    return subprocess.run(["security", "find-generic-password", "-a", os.environ["USER"], "-s", name, "-w"],
                          capture_output=True, text=True, check=True).stdout.strip()


def ask(token: str, model: str, state: dict, question: dict) -> dict | None:
    body = json.dumps({"model": model, "state": state, "questions": {"q": question}}).encode()
    headers = {"content-type": "application/json", "authorization": f"Bearer {token}"}
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(SYSTEMONE_URL, body, headers), timeout=120) as r:
                return json.load(r)["answers"]["q"]
        except Exception as e:  # retried, then skipped; the next classify run picks it up again
            err = e
            time.sleep(2 ** attempt)
    print(f"classify: {model}: {err!r}", file=sys.stderr)
    return None


def classify(days: int | None, workers: int) -> None:
    turns = load_turns(days)
    labels = load_labels()
    index = {(t["session"], t["turn"]): t for t in turns}
    jobs = []
    for t in turns:
        key = (t["session"], t["turn"])
        previous = index.get((t["session"], t["turn"] - 1), {}).get("reply", "")
        if is_reask(t) and (*key, "cause") not in labels:
            jobs.append((key, "cause", CAUSE_MODEL, {"prompt": t["prompt"], "reply": t["reply"]}, CAUSE_QUESTION))
        if t.get("task_start") and (*key, "quality") not in labels:
            jobs.append((key, "quality", QUALITY_MODEL, {"previous": previous, "prompt": t["prompt"]}, QUALITY_QUESTION))
        following = index.get((t["session"], t["turn"] + 1))
        if t.get("understood") and following and (*key, "correction") not in labels:
            jobs.append((key, "correction", CORRECTION_MODEL,
                         {"understood": t["understood"], "next_prompt": following["prompt"]}, CORRECTION_QUESTION))
    if not jobs:
        print("nothing to classify")
        return
    token = keychain("OPENROUTER_API_KEY")
    value_of = {"cause": lambda a: a["choice"], "quality": lambda a: a["score"], "correction": lambda a: a["noul"]}
    written = 0
    with ThreadPoolExecutor(workers) as pool, LABELS.open("a") as out:
        for (key, kind, model, _, _), answer in zip(jobs, pool.map(lambda j: ask(token, j[2], j[3], j[4]), jobs)):
            if answer is None:
                continue
            out.write(json.dumps({"session": key[0], "turn": key[1], "kind": kind, "model": model,
                                  "value": value_of[kind](answer), "ts": int(time.time())}) + "\n")
            written += 1
    print(f"classified {written} of {len(jobs)} ({Counter(j[1] for j in jobs)})")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["report", "classify"])
    ap.add_argument("--days", type=int)
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()
    report(a.days) if a.command == "report" else classify(a.days, a.workers)


if __name__ == "__main__":
    main()

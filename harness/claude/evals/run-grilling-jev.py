#!/usr/bin/env python3
"""Grade Jev as the grilling question filter, on the same gold labels as the round suite.

usage: run-grilling-jev.py [--suite rounds|blocks|both] [--backend jev|haiku|sonnet] [--workers N] [-v]

Each scored block goes to the SystemOne model jev-1.13 on OpenRouter (token: Keychain
OPENROUTER_API_KEY) with the context the grilling model had and the drafted question.
Jev's choice maps to a grilling outcome: user-decision and missing-in-prompt are asked,
findable is decided, depends-on-open waits.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEMONE_URL = "https://openrouter.ai/api/v1/systemone"
MODEL = os.environ.get("JEV_MODEL", "jev-1.13")
BACKEND = MODEL

QUESTION = {
    "type": "choice",
    "instructions": "`context` is what a coding assistant knows before it asks the person a round of questions: "
                    "the person's own words, earlier answers and sessions, repo rules, and code facts. "
                    "`question` is one question the assistant drafted, with its options and recommendation. "
                    "`round` lists the other questions drafted for the same round. Should the assistant ask it?",
    "criteria": {
        "user-decision": "A real choice of intent, priority, or scope that only the person can make, "
                         "and nothing in the context picks one option.",
        "missing-in-prompt": "It needs a fact that only the person has and the context does not hold.",
        "findable": "The context already settles it: the person's own words or earlier answer, an earlier "
                    "session, a repo rule, or the code picks one option, or only one option is real.",
        "depends-on-open": "Its options change with the answer to another question in `round` that is still open.",
    },
}
OUTCOME = {"user-decision": "ask", "missing-in-prompt": "ask", "findable": "decide", "depends-on-open": "defer"}


def keychain(name: str) -> str:
    return subprocess.run(["security", "find-generic-password", "-a", os.environ["USER"], "-s", name, "-w"],
                          capture_output=True, text=True, check=True).stdout.strip()


def ask(token: str, state: dict) -> dict | None:
    body = json.dumps({"model": MODEL, "state": state, "questions": {"q": QUESTION}}).encode()
    headers = {"content-type": "application/json", "authorization": f"Bearer {token}"}
    err = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(SYSTEMONE_URL, body, headers), timeout=120) as r:
                reply = json.load(r)
                return {**reply["answers"]["q"], "cost": reply.get("usage", {}).get("cost", 0)}
        except Exception as e:  # retried, then counted as no answer
            err = e
            time.sleep(2 ** attempt)
    print(f"jev: {err!r}", file=sys.stderr)
    return None


def ask_claude(model: str, state: dict) -> dict | None:
    criteria = "\n".join(f'"{k}" = {v}' for k, v in QUESTION["criteria"].items())
    fields = "\n\n".join(f"`{k}`:\n{v or '(none)'}" for k, v in state.items())
    prompt = (f"{QUESTION['instructions']}\n\n{fields}\n\nChoose exactly one:\n{criteria}\n\n"
              'Reply with one line of JSON and nothing else: {"choice":"<one of the four>","confidence":<0..1>}')
    run = subprocess.run(["claude", "-p", "--model", model, "--output-format", "json",
                          "--setting-sources", "project", "--strict-mcp-config", "--disable-slash-commands",
                          "--tools", ""], input=prompt, capture_output=True, text=True,
                         cwd=os.environ.get("TMPDIR", "/tmp"))
    try:
        envelope = json.loads(run.stdout)
        text = envelope["result"]
        answer = json.loads(text[text.index("{"):text.rindex("}") + 1])
        return {**answer, "cost": envelope.get("total_cost_usd", 0)}
    except (ValueError, KeyError) as e:
        print(f"{model}: {e!r}: {run.stdout[:200]!r}", file=sys.stderr)
        return None


COST_QUESTIONS = {
    "undo": {
        "type": "choice",
        "instructions": "`context` is a software task; `question` is one design point with its options. "
                        "The assistant picked an option, built the code, and the person later finds the pick "
                        "was wrong. How expensive is it to change to another option then?",
        "criteria": {
            "low": "One small commit: a name, a file location, a default, a message, code behind one interface.",
            "medium": "Several files or callers change, or tests and docs follow, but no data, no users, "
                      "and no other team are affected.",
            "high": "Data was written or migrated, a public contract or another team depends on it, "
                    "or a deployment or a scope promise has to be reversed.",
        },
    },
    "find": {
        "type": "choice",
        "instructions": "`context` is a software task; `question` is one design point with its options. "
                        "The assistant picked the wrong option and built it. How hard is it for a reviewer "
                        "who reads the code diff to notice the wrong pick?",
        "criteria": {
            "low": "The pick is visible in a name, a signature, a type, or a file the diff adds.",
            "medium": "The pick is in a body or a config value; the reviewer sees it only when reading closely.",
            "high": "The pick is an order, an omission, a scope left out, or a behaviour that shows only at "
                    "run time or in production.",
        },
    },
}


def label_costs(workers: int) -> None:
    path = HERE / "cases-grilling-rounds.jsonl"
    cases = [json.loads(l) for l in path.read_text().splitlines() if l.strip()]
    token = keychain("OPENROUTER_API_KEY")
    jobs = [(c, b) for c in cases for b in c["blocks"]]

    def call(job):
        case, block = job
        body = json.dumps({"model": MODEL, "state": {"context": case["context"], "question": block["candidate"]},
                           "questions": COST_QUESTIONS}).encode()
        headers = {"content-type": "application/json", "authorization": f"Bearer {token}"}
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(SYSTEMONE_URL, body, headers), timeout=120) as r:
                    return json.load(r)["answers"]
            except Exception as e:
                err = e
                time.sleep(2 ** attempt)
        print(f"label: {case['id']} P{block['n']}: {err!r}", file=sys.stderr)
        return None

    with ThreadPoolExecutor(workers) as pool:
        answers = list(pool.map(call, jobs))
    for (case, block), ans in zip(jobs, answers):
        if ans:
            block["undo"] = ans["undo"]["choice"]
            block["find"] = ans["find"]["choice"]
    path.write_text("".join(json.dumps(c, ensure_ascii=False) + "\n" for c in cases))
    for case in cases:
        print(f"{case['id']:42} " + " ".join(f"P{b['n']}:{b.get('undo', '?')}/{b.get('find', '?')}" for b in case["blocks"]))
    print(f"labelled {sum(1 for a in answers if a)} of {len(jobs)} points (undo/find: low|medium|high)")


SORT_QUESTION = {
    "type": "choice",
    "instructions": "`context` is what a coding assistant knows about a person's task. `decision` is a choice the "
                    "assistant made for the person, with the options it chose from. The assistant shows each "
                    "decision either as a block the person must read, or as one line in a list the person may "
                    "skim. Where does this decision go?",
    "criteria": {
        "block": "If this decision is wrong and the person misses it, it costs real rework or harm, and the "
                 "person's own words, an earlier answer, a repo rule, or the code do not already settle it.",
        "line": "The person already said this, a source settles it, or a wrong pick is cheap to change later.",
    },
}
LEVEL = {"low": 1, "medium": 5, "high": 25}


def sort_items() -> list[dict]:
    items = []
    for line in (HERE / "cases-grilling-rounds.jsonl").read_text().splitlines():
        case = json.loads(line)
        for b in case["blocks"]:
            if b["label"] == "skip":
                continue
            items.append({"id": f"{case['id']}#P{b['n']}", "pain": b["pain"], "wrong": b["label"] == "ask",
                          "undo": LEVEL.get(b.get("undo"), 5), "find": LEVEL.get(b.get("find"), 5),
                          "state": {"context": case["context"], "decision": b["candidate"]}})
    return items


def sort_price(place: str, it: dict, rb: float, rl: float, notice: float) -> float:
    if place == "block":
        return rb
    return rl + ((1 - notice) * (it["undo"] + it["find"]) if it["wrong"] else 0)


def run_sort(backend: str, workers: int, verbose: bool) -> None:
    rb, rl, notice = (float(os.environ.get(k, d)) for k, d in
                      (("READ_BLOCK", 2), ("READ_LINE", 0.3), ("NOTICE_LINE", 0.3)))
    items = sort_items()
    if backend == "jev":
        token = keychain("OPENROUTER_API_KEY")

        def call(it):
            body = json.dumps({"model": MODEL, "state": it["state"], "questions": {"q": SORT_QUESTION}}).encode()
            headers = {"content-type": "application/json", "authorization": f"Bearer {token}"}
            for attempt in range(4):
                try:
                    with urllib.request.urlopen(urllib.request.Request(SYSTEMONE_URL, body, headers), timeout=120) as r:
                        reply = json.load(r)
                        return {**reply["answers"]["q"], "cost": reply.get("usage", {}).get("cost", 0)}
                except Exception:
                    time.sleep(2 ** attempt)
            return None
    else:
        def call(it):
            global QUESTION
            saved, QUESTION = QUESTION, SORT_QUESTION
            try:
                return ask_claude(backend, it["state"])
            finally:
                QUESTION = saved
    started = time.time()
    with ThreadPoolExecutor(workers) as pool:
        answers = list(pool.map(call, items))
    elapsed = time.time() - started
    rows = []
    for it, ans in zip(items, answers):
        place = (ans or {}).get("choice")
        if place not in ("block", "line"):
            place = "block"
        rows.append((it, place))
    price = sum(sort_price(pl, it, rb, rl, notice) for it, pl in rows)
    oracle = sum(sort_price("block" if it["wrong"] else "line", it, rb, rl, notice) for it, _ in rows)
    caught = sum(1 for it, pl in rows if it["wrong"] and pl == "block")
    hidden = sum(1 for it, pl in rows if it["wrong"] and pl == "line")
    needless = sum(1 for it, pl in rows if not it["wrong"] and pl == "block")
    blocks = sum(1 for _, pl in rows if pl == "block")
    unanswered = sum(1 for a in answers if not a)
    cost = sum((a or {}).get("cost", 0) for a in answers)
    if verbose:
        for it, pl in rows:
            mark = "ok " if (pl == "block") == it["wrong"] else "BAD"
            print(f"  {mark} {pl:5} wrong={str(it['wrong']):5} undo={it['undo']:2} find={it['find']:2} {it['pain']:16} {it['id']}")
    print(json.dumps({"model": BACKEND, "price": round(price, 1), "oracle": round(oracle, 1),
                      "all_blocks": round(rb * len(rows), 1),
                      "all_lines": round(sum(sort_price("line", it, rb, rl, notice) for it, _ in rows), 1),
                      "wrong": caught + hidden, "caught": caught, "hidden": hidden, "blocks": blocks,
                      "needless": needless, "points": len(rows), "unanswered": unanswered,
                      "usd": round(cost, 4), "seconds": round(elapsed)}))


def round_items() -> list[dict]:
    items = []
    for line in (HERE / "cases-grilling-rounds.jsonl").read_text().splitlines():
        case = json.loads(line)
        for b in case["blocks"]:
            if b["label"] == "skip":
                continue
            others = [f"P{o['n']}. {o['candidate']}" for o in case["blocks"] if o["n"] != b["n"]]
            items.append({"suite": "rounds", "id": f"{case['id']}#P{b['n']}", "label": b["label"],
                          "pain": b["pain"], "state": {"context": case["context"],
                                                       "question": f"P{b['n']}. {b['candidate']}",
                                                       "round": "\n".join(others)}})
    return items


def block_items() -> list[dict]:
    items = []
    for line in (HERE / "cases-grilling.jsonl").read_text().splitlines():
        case = json.loads(line)
        items.append({"suite": "blocks", "id": case["id"], "label": case["label"], "pain": case["pain"],
                      "state": {"context": case["context"], "question": case["candidate"], "round": ""}})
    return items


def report(suite: str, rows: list[dict], verbose: bool) -> None:
    scored = [r for r in rows if r["got"]]
    asked = [r for r in scored if r["got"] == "ask"]
    needless = [r for r in asked if r["label"] != "ask"]
    needed = [r for r in scored if r["label"] == "ask"]
    missed = [r for r in needed if r["got"] == "decide"]
    waited = [r for r in needed if r["got"] == "defer"]
    exact = sum(r["got"] == r["label"] for r in scored)
    print(f"\n== {suite}: {len(scored)} blocks scored, {len(rows) - len(scored)} without an answer")
    if verbose:
        for r in rows:
            mark = "PASS" if r["got"] == r["label"] else "FAIL"
            print(f"  {mark} want={r['label']:6} got={r['got'] or '?':6} p={r['p']:.2f} {r['pain']:16} {r['id']}")
    print(f"  {'pain point':17} {'needless':>8} {'missed':>7}")
    pains = Counter(r["pain"] for r in needless) + Counter(r["pain"] for r in missed)
    for pain in sorted(pains, key=lambda p: -pains[p]):
        print(f"  {pain:17} {sum(r['pain'] == pain for r in needless):8} {sum(r['pain'] == pain for r in missed):7}")
    share = lambda a, b: f"{a / b:.2f}" if b else "-"
    print(f"  {BACKEND}: asked {len(asked)}, needless {len(needless)} ({share(len(needless), len(asked))}), "
          f"missed {len(missed)} of {len(needed)} needed ({share(len(missed), len(needed))}), "
          f"waited {len(waited)}, exact label {exact}/{len(scored)}")


def main() -> None:
    global BACKEND
    ap = argparse.ArgumentParser()
    ap.add_argument("--suite", choices=["rounds", "blocks", "both", "sort"], default="rounds")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--backend", default="jev", help="jev, or a claude model alias such as haiku")
    ap.add_argument("-v", action="store_true")
    ap.add_argument("--label-costs", action="store_true",
                    help="write the undo and find price levels (low|medium|high) into cases-grilling-rounds.jsonl, then exit")
    a = ap.parse_args()
    if a.label_costs:
        label_costs(a.workers)
        return
    if a.suite == "sort":
        BACKEND = MODEL if a.backend == "jev" else a.backend
        run_sort(a.backend, a.workers, a.v)
        return
    BACKEND = MODEL if a.backend == "jev" else a.backend
    items = (round_items() if a.suite in ("rounds", "both") else []) + \
            (block_items() if a.suite in ("blocks", "both") else [])
    if a.backend == "jev":
        token = keychain("OPENROUTER_API_KEY")
        call = lambda it: ask(token, it["state"])
    else:
        call = lambda it: ask_claude(a.backend, it["state"])
    started = time.time()
    with ThreadPoolExecutor(a.workers) as pool:
        answers = list(pool.map(call, items))
    rows = []
    for it, ans in zip(items, answers):
        choice = ans and ans.get("choice")
        rows.append({**it, "got": OUTCOME.get(choice), "p": (ans or {}).get("confidence", 0) or 0})
    for suite in ("rounds", "blocks"):
        part = [r for r in rows if r["suite"] == suite]
        if part:
            report(suite, part, a.v)
    print(f"\n{BACKEND}: cost ${sum((x or {}).get('cost', 0) for x in answers):.4f} for {len(items)} calls, "
          f"{time.time() - started:.0f}s wall clock with {a.workers} workers")


if __name__ == "__main__":
    main()

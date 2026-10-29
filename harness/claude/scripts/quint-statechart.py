#!/usr/bin/env python3
"""Draw a Quint model as a Mermaid statechart in the reader's words, with each found bug as a numbered path.

The view module (--view) maps model states and steps to the reader's words:
  state(v) -> str            label of one model state; v holds the vars without module prefixes
  step(action, picks, before, after) -> str | None   label of one step; None hides it
  rules: dict[str, str]      invariant name -> the reader's sentence for the rule (optional)
  title: str                 chart title (optional)
"""
import argparse
import importlib.util
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
from collections import Counter, defaultdict


def decode(x):
    """ITF JSON -> plain Python: maps to dicts, sets and lists to lists, a sum value without payload to its tag."""
    if isinstance(x, list):
        return [decode(e) for e in x]
    if not isinstance(x, dict):
        return x
    if "#bigint" in x:
        return int(x["#bigint"])
    if "#map" in x:
        return {_key(decode(k)): decode(v) for k, v in x["#map"]}
    if "#set" in x:
        return [decode(e) for e in x["#set"]]
    if "#tup" in x:
        return tuple(decode(e) for e in x["#tup"])
    if "tag" in x and "value" in x:
        value = decode(x["value"])
        return x["tag"] if value == () else {"tag": x["tag"], "value": value}
    return {k: decode(v) for k, v in x.items()}


def _key(k):
    return json.dumps(k, sort_keys=True) if isinstance(k, (dict, list)) else k


def load_trace(path):
    raw = json.loads(pathlib.Path(path).read_text())
    states = []
    for s in raw["states"]:
        v = {k.split("::")[-1]: decode(val) for k, val in s.items() if not k.startswith("#") and not k.startswith("mbt::")}
        picks = {k: (p["value"] if isinstance(p, dict) and p.get("tag") == "Some" else None)
                 for k, p in decode(s.get("mbt::nondetPicks", {})).items()} if "mbt::nondetPicks" in s else {}
        states.append({"vars": v, "action": s.get("mbt::actionTaken"), "picks": picks})
    return states


def quint_run(model, main, out_pattern, samples, steps, n_traces, invariant=None, seed=None):
    cmd = ["quint", "run", model, f"--main={main}", "--mbt", f"--max-samples={samples}", f"--max-steps={steps}",
           f"--n-traces={n_traces}", f"--out-itf={out_pattern}"]
    if invariant:
        cmd.append(f"--invariant={invariant}")
    if seed:
        cmd.append(f"--seed={seed}")
    r = subprocess.run(cmd, capture_output=True, text=True)
    text = r.stdout + r.stderr
    if "error" in text.lower() and "violation" not in text.lower():
        sys.exit(f"quint-statechart: quint run failed:\n{text}")
    return "violation" in text.lower() and "no violation" not in text.lower()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("model")
    ap.add_argument("--main", required=True, help="instance module to run")
    ap.add_argument("--view", required=True, help="Python view module")
    ap.add_argument("--invariant", action="append", default=[], help="repeatable; each is checked and its bug path reported")
    ap.add_argument("--samples", type=int, default=200000, help="samples per invariant check")
    ap.add_argument("--traces", type=int, default=3000, help="sampled traces that draw the chart")
    ap.add_argument("--steps", type=int, default=15)
    ap.add_argument("--out", default="statechart")
    a = ap.parse_args()

    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    cover = pathlib.Path(tempfile.mkdtemp(prefix="quint-statechart-"))
    sys.dont_write_bytecode = True  # keep __pycache__ out of the model folder
    spec = importlib.util.spec_from_file_location("view", a.view)
    view = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(view)
    rules = getattr(view, "rules", {})

    quint_run(a.model, a.main, str(cover / "t_{seq}.itf.json"), a.traces, a.steps, a.traces)
    traces = [load_trace(p) for p in sorted(cover.glob("*.itf.json"))]
    shutil.rmtree(cover)

    bugs = {}
    for inv in a.invariant:
        path = out / f"bug-{inv}.itf.json"
        path.unlink(missing_ok=True)
        if quint_run(a.model, a.main, str(path), a.samples, a.steps, 1, invariant=inv) and path.exists():
            bugs[inv] = load_trace(path)
            traces.append(bugs[inv])

    ids, edges, starts, hidden = {}, Counter(), set(), Counter()

    def node(label):
        return ids.setdefault(label, f"s{len(ids)}")

    def walk(trace):
        labels = [view.state(s["vars"]) for s in trace]
        starts.add(node(labels[0]))
        path = []
        for before, after, lb, la in zip(trace, trace[1:], labels, labels[1:]):
            text = view.step(after["action"], after["picks"], before["vars"], after["vars"])
            if text is None:
                hidden[after["action"]] += 1
                continue
            path.append((text, la))
            if lb != la:
                edges[(node(lb), node(la), text)] += 1
        return labels, path

    for t in traces:
        walk(t)
    marks = defaultdict(list)
    paths = {}
    for inv, t in bugs.items():
        labels, path = walk(t)
        marks[node(labels[-1])].append(inv)
        paths[inv] = (labels[0], path)

    lines = ["stateDiagram-v2"]
    if getattr(view, "title", None):
        lines.insert(0, f"---\ntitle: {view.title}\n---")
    for label, sid in ids.items():
        lines.append(f'    {sid} : {label}')
    for sid in sorted(starts):
        lines.append(f"    [*] --> {sid}")
    for (src, dst, text), _ in sorted(edges.items()):
        lines.append(f"    {src} --> {dst} : {text}")
    lines.append("    classDef breaks fill:#f6c6c0,stroke:#b42318,color:#3b0d08")
    for sid, invs in marks.items():
        lines.append(f"    class {sid} breaks")
        lines.append(f"    note right of {sid} : breaks {', '.join(invs)}")
    (out / "chart.mmd").write_text("\n".join(lines) + "\n")

    rep = [f"# Statechart report: {a.main}", "",
           f"Drawn from {len(traces)} sampled traces of at most {a.steps} steps. A state that no trace reached is not drawn.",
           f"{len(ids)} chart states, {len(edges)} arrows.", ""]
    rep.append("## Rules")
    for inv in a.invariant:
        verdict = "BREAKS" if inv in bugs else f"no violation in {a.samples} samples"
        rep.append(f"- `{inv}`: {rules.get(inv, inv)} — **{verdict}**")
    for inv, (first, path) in paths.items():
        rep += ["", f"## Bug path: {rules.get(inv, inv)}", "", f"Start: {first}", ""]
        rep += [f"{n}. {text} → *{state}*" for n, (text, state) in enumerate(path, 1)]
    if hidden:
        rep += ["", "## Hidden steps", ""] + [f"- `{k}`: {v} steps" for k, v in sorted(hidden.items())]
    (out / "report.md").write_text("\n".join(rep) + "\n")
    print(f"quint-statechart: wrote {out}/chart.mmd and {out}/report.md ({len(ids)} states, {len(edges)} arrows, {len(bugs)} bugs)")


if __name__ == "__main__":
    main()

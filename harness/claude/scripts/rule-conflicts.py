#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""Find contradicting and duplicate rules in the instruction corpus.

`group` embeds every rule sentence with a local Ollama model, files each under its nearest
(artifact, aspect) label, and splits the groups into judge batches. `report` merges the judge
verdicts and measures recall on the planted conflicts.
"""

import argparse
import glob
import json
import os
import re
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

import numpy as np

HOME = os.path.expanduser("~")
REPO = f"{HOME}/Documents/git/dotfiles"
DEFAULT_SOURCES = [
    f"{REPO}/harness/claude/CLAUDE.md",
    f"{REPO}/harness/claude/skills/**/*.md",
    f"{REPO}/harness/plugins/**/skills/**/*.md",
    f"{HOME}/.notes/rules/*.md",
]
OLLAMA_EMBED_URL = "http://localhost:11434/api/embed"
DEFAULT_MODEL = "qwen3-embedding:4b"
LABEL_INSTRUCTION = (
    "Instruct: Classify the rule for a coding agent by the artifact it governs "
    "and the property of that artifact it controls\nQuery: "
)

ARTIFACTS = [
    "code comment or doc comment on a function, type or field",
    "name of a type, function, field, file or module",
    "git commit message",
    "automated test",
    "error or log message string",
    "markdown document, skill file or instruction file",
    "prompt sent to a subagent",
    "shell command or tool call",
    "reply to the user in chat",
    "TODO, spec or design note",
]
ASPECTS = [
    "whether it must exist at all",
    "its length or word count",
    "which facts or references it may contain",
    "its wording, language or tone",
    "where it is placed",
    "its format or structure",
]

RULE_KEYWORDS = re.compile(
    r"\b(MUST|SHOULD|NEVER|[Nn]ever|[Aa]lways|Don't|[Dd]o not|only|cap|Avoid|Prefer"
    r"|Give|Write|Use|Put|Keep|Add|Delete)\b"
)
POLARITY_RULES = [
    ("forbid", re.compile(r"\b(MUST NOT|NEVER|[Nn]ever|Don't|[Dd]o not|Avoid|[Nn]o )\b")),
    ("limit", re.compile(r"\b(only|[Aa]t most|cap|max)\b")),
    ("require", re.compile(r"")),
]
PLANTED_PREFIX = "planted:"


def rule_polarity(text):
    return next(name for name, pattern in POLARITY_RULES if pattern.search(text))


def rule_sentences(path):
    in_fence = False
    for line_number, line in enumerate(Path(path).read_text(errors="ignore").splitlines(), 1):
        if line.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence or line.startswith(("---", "name:", "description:", "|")):
            continue
        text = re.sub(r"^\s*([-*>]|\d+\.)\s+", "", line.strip())
        for sentence in re.split(r"(?<=[.!?])\s+(?=[A-Z`*])", text):
            sentence = sentence.strip("* ")
            if 6 <= len(sentence.split()) <= 80 and RULE_KEYWORDS.search(sentence):
                yield line_number, sentence


def corpus_rules(source_globs):
    paths = sorted({p for g in source_globs for p in glob.glob(os.path.expanduser(g), recursive=True)})
    rules, seen = [], set()
    for path in paths:
        shown = path.replace(HOME, "~")
        for line_number, text in rule_sentences(path):
            if (shown, text) not in seen:
                seen.add((shown, text))
                rules.append({"where": f"{shown}:{line_number}", "text": text})
    return rules


def planted_rules(planted_path):
    rules = []
    for line in Path(planted_path).read_text().splitlines():
        if line.strip():
            pair = json.loads(line)
            for side in ("a", "b"):
                rules.append({"where": f"{PLANTED_PREFIX}{pair['id']}:{side}", "text": pair[side]})
    return rules


def embed(model, texts):
    vectors = []
    for start in range(0, len(texts), 32):
        body = json.dumps({"model": model, "input": texts[start:start + 32]}).encode()
        request = urllib.request.Request(OLLAMA_EMBED_URL, body, {"Content-Type": "application/json"})
        try:
            vectors += json.load(urllib.request.urlopen(request, timeout=600))["embeddings"]
        except urllib.error.URLError as error:
            sys.exit(f"rule-conflicts: ollama embed failed for {model} ({error}); run `ollama pull {model}` and start ollama")
    matrix = np.array(vectors, dtype=np.float32)
    return matrix / np.linalg.norm(matrix, axis=1, keepdims=True)


def balanced_batches(groups, batch_count):
    batches = [{"size": 0, "files": []} for _ in range(batch_count)]
    for name, group in sorted(groups.items(), key=lambda kv: -len(kv[1]["rules"])):
        smallest = min(batches, key=lambda b: b["size"])
        smallest["size"] += len(group["rules"])
        smallest["files"].append(name)
    return [sorted(b["files"]) for b in batches if b["files"]]


def run_group(args):
    rules = corpus_rules(args.source or DEFAULT_SOURCES)
    if args.planted:
        rules += planted_rules(args.planted)
    labels = [(a, s) for a in ARTIFACTS for s in ASPECTS]
    rule_vectors = embed(args.model, [LABEL_INSTRUCTION + r["text"] for r in rules])
    label_vectors = embed(args.model, [f"A rule about a {a}: {s}" for a, s in labels])
    nearest_labels = np.argsort(-(rule_vectors @ label_vectors.T), axis=1)[:, :args.labels_per_rule]

    by_label = defaultdict(list)
    for rule, label_indexes in zip(rules, nearest_labels):
        for label_index in label_indexes:
            by_label[int(label_index)].append({**rule, "polarity": rule_polarity(rule["text"])})

    out = Path(args.out)
    (out / "groups").mkdir(parents=True, exist_ok=True)
    (out / "judged").mkdir(exist_ok=True)
    ordered = sorted((v for v in by_label.items() if len(v[1]) > 1), key=lambda kv: -len(kv[1]))
    groups = {}
    for number, (label_index, members) in enumerate(ordered, 1):
        artifact, aspect = labels[label_index]
        name = f"{number:02d}.json"
        groups[name] = {"group": f"{artifact} | {aspect}", "rules": members}
        (out / "groups" / name).write_text(json.dumps(groups[name], indent=1))
    batches = balanced_batches(groups, args.batches)
    (out / "batches.json").write_text(json.dumps(batches, indent=1))

    planted_in_one_group = planted_group_recall(groups)
    print(json.dumps({
        "rules": len(rules),
        "groups": len(groups),
        "group_sizes": [len(g["rules"]) for g in groups.values()],
        "batches": batches,
        "planted_pairs_in_one_group": planted_in_one_group,
    }, indent=1))


def planted_group_recall(groups):
    groups_of = defaultdict(set)
    for name, group in groups.items():
        for rule in group["rules"]:
            if rule["where"].startswith(PLANTED_PREFIX):
                groups_of[rule["where"]].add(name)
    ids = {w.split(":")[1] for w in groups_of}
    together = sum(1 for i in ids if groups_of[f"{PLANTED_PREFIX}{i}:a"] & groups_of[f"{PLANTED_PREFIX}{i}:b"])
    return f"{together}/{len(ids)}" if ids else "n/a"


def first_where(value):
    return value[0] if isinstance(value, list) else value


def planted_id(where):
    return where.split(":")[1] if where.startswith(PLANTED_PREFIX) else None


def run_report(args):
    out = Path(args.out)
    verdicts = [json.loads(line) for f in sorted((out / "judged").glob("*.jsonl")) for line in f.read_text().splitlines() if line.strip()]
    planted_ids = set()
    if args.planted:
        planted_ids = {json.loads(line)["id"] for line in Path(args.planted).read_text().splitlines() if line.strip()}

    found_planted, real, seen_pairs = set(), [], set()
    for verdict in verdicts:
        a, b = first_where(verdict["a_where"]), first_where(verdict["b_where"])
        a_id, b_id = planted_id(a), planted_id(b)
        if a_id or b_id:
            if a_id == b_id and verdict["label"] == "contradicts":
                found_planted.add(a_id)
            continue
        pair = (verdict["label"], *sorted((a, b)))
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        real.append({**verdict, "a_where": a, "b_where": b})

    recall = len(found_planted) / len(planted_ids) if planted_ids else None
    lines = ["# Rule conflicts", ""]
    if recall is not None:
        missed = sorted(planted_ids - found_planted)
        lines += [f"Planted-conflict recall: {len(found_planted)}/{len(planted_ids)}. Missed: {', '.join(missed) or 'none'}.", ""]
    for label in ("contradicts", "duplicate"):
        rows = [v for v in real if v["label"] == label]
        lines += [f"## {label} ({len(rows)})", ""]
        for v in rows:
            lines += [f"- **{v['group']}**", f"  - `{v['a_where']}`: {v['a_text']}", f"  - `{v['b_where']}`: {v['b_text']}"]
            if v.get("situation"):
                lines.append(f"  - Situation: {v['situation']}")
            lines += [f"  - Proposed fix: {v.get('fix', '')}", "  - Decision: ", ""]
    (out / "report.md").write_text("\n".join(lines))
    print(f"report: {out / 'report.md'}")
    if recall is not None:
        print(f"planted recall: {len(found_planted)}/{len(planted_ids)}")
        if recall < args.min_recall:
            sys.exit(f"rule-conflicts: planted recall {recall:.0%} is below {args.min_recall:.0%}; the run cannot show the corpus is clean")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)

    group = commands.add_parser("group", help="embed, group and batch the rules")
    group.add_argument("--out", required=True)
    group.add_argument("--planted", help="JSONL of planted conflicts: {id, a, b}")
    group.add_argument("--source", action="append", help="glob of rule files; repeat; replaces the default corpus")
    group.add_argument("--model", default=DEFAULT_MODEL)
    group.add_argument("--batches", type=int, default=5)
    group.add_argument("--labels-per-rule", type=int, default=2, help="file each rule under its N nearest labels, so a pair split by one label still meets")
    group.set_defaults(run=run_group)

    report = commands.add_parser("report", help="merge judge verdicts into report.md and score the planted conflicts")
    report.add_argument("--out", required=True)
    report.add_argument("--planted")
    report.add_argument("--min-recall", type=float, default=0.8)
    report.set_defaults(run=run_report)

    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build a per-repo graphify extraction = AST(code) + semantic(docs only).

Semantic backend is claude-cli; set GRAPHIFY_CLAUDE_CLI_MODEL (e.g. sonnet) in env.
Images are intentionally skipped. Writes <repo>/graphify-out/graph.json (built graph).

Usage: graphify_repo_ast_docs.py <repo_path>
Requires running under the graphify-installed Python interpreter.
"""
import json
import sys
from pathlib import Path

from graphify.detect import detect
from graphify.extract import collect_files, extract
from graphify.llm import extract_corpus_parallel
from graphify.build import build_from_json


def main() -> int:
    repo = Path(sys.argv[1])
    if not repo.is_dir():
        print(f"error: not a directory: {repo}", file=sys.stderr)
        return 1

    det = detect(repo)
    code = det["files"].get("code", [])
    docs = det["files"].get("document", [])
    print(f"[{repo.name}] code={len(code)} docs={len(docs)} (images skipped)")

    # --- AST extraction over code files (deterministic, cached) ---
    code_files: list[Path] = []
    for f in code:
        p = Path(f)
        code_files.extend(collect_files(p) if p.is_dir() else [p])
    ast = extract(code_files, cache_root=Path(".")) if code_files else {"nodes": [], "edges": []}
    print(f"[{repo.name}] AST: {len(ast['nodes'])} nodes, {len(ast['edges'])} edges")

    # --- Semantic extraction over docs only (claude-cli / Sonnet) ---
    sem = {"nodes": [], "edges": [], "hyperedges": [], "input_tokens": 0, "output_tokens": 0}
    if docs:
        sem = extract_corpus_parallel(
            [Path(d) for d in docs],
            backend="claude-cli",
            root=repo,
            max_concurrency=4,
        )
        print(f"[{repo.name}] DOCS semantic: {len(sem['nodes'])} nodes, "
              f"{len(sem['edges'])} edges, failed_chunks={sem.get('failed_chunks')}, "
              f"tok in/out={sem.get('input_tokens')}/{sem.get('output_tokens')}")

    # --- Merge AST + semantic (AST node ids win on collision) ---
    seen = {n["id"] for n in ast["nodes"]}
    merged_nodes = list(ast["nodes"])
    for n in sem["nodes"]:
        if n["id"] not in seen:
            merged_nodes.append(n)
            seen.add(n["id"])
    extraction = {
        "nodes": merged_nodes,
        "edges": ast["edges"] + sem["edges"],
        "hyperedges": sem.get("hyperedges", []),
        "input_tokens": sem.get("input_tokens", 0),
        "output_tokens": sem.get("output_tokens", 0),
    }

    G = build_from_json(extraction)
    out_dir = repo / "graphify-out"
    out_dir.mkdir(parents=True, exist_ok=True)
    from networkx.readwrite import json_graph
    try:
        data = json_graph.node_link_data(G, edges="links")
    except TypeError:
        data = json_graph.node_link_data(G)
    data["input_tokens"] = extraction["input_tokens"]
    data["output_tokens"] = extraction["output_tokens"]
    if extraction["hyperedges"]:
        data["hyperedges"] = extraction["hyperedges"]
    (out_dir / "graph.json").write_text(json.dumps(data), encoding="utf-8")
    print(f"[{repo.name}] WROTE {out_dir/'graph.json'}: "
          f"{G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

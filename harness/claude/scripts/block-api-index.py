#!/usr/bin/env python3
"""Reverse-index Platforma SDK APIs to the blocks that demonstrate them.

Usage: block-api-index.py <blocks-root> [--min N] [--max-blocks N] [--json]

Builds the "which block should I read to learn API X?" index: for every marker in
CAPABILITIES it reports how many blocks use it and names them, so an example
catalogue can cite a real block per API instead of an invented one.

Rare markers matter most — an API used by 2 blocks needs a documented example far
more than one used by 60. Output is sorted ascending by block count.
"""
import argparse
import json
import os
import re
import sys
from collections import defaultdict

SKIP = {"node_modules", ".git", "dist", ".turbo", ".pnpm-store", "docs", "logos"}
EXTS = (".tengo", ".ts", ".vue")

# marker -> (layer, regex). Layer groups the report.
CAPABILITIES = {
    # --- workflow (Tengo) ---
    "exec.builder":            ("workflow", r"exec\.builder\("),
    ".resources(":             ("workflow", r"\.resources\(\s*\{"),
    ".staticFallback(":        ("workflow", r"\.staticFallback\("),
    ".gpuMemory(":             ("workflow", r"\.gpuMemory\("),
    ".cpu( / .mem(":           ("workflow", r"\.(cpu|mem)\("),
    "assets.importSoftware":   ("workflow", r"assets\.importSoftware\("),
    "assets.importAsset":      ("workflow", r"assets\.importAsset\("),
    "pframes.processColumn":   ("workflow", r"pframes\.processColumn\("),
    "pframes.aggregate":       ("workflow", r"pframes\.aggregate\("),
    "xsv.importFile":          ("workflow", r"xsv\.importFile\("),
    "xsv.exportFrame":         ("workflow", r"xsv\.exportFrame\("),
    "pframes.exportFrame":     ("workflow", r"pframes\.export(Frame|ColumnData)\("),
    "createPBundleBuilder":    ("workflow", r"createPBundleBuilder\("),
    "bquery/anchoredQuery":    ("workflow", r"anchoredQuery\("),
    "smart.structBuilder":     ("workflow", r"smart\.structBuilder\("),
    "ll.assert / validation":  ("workflow", r"validation\.assertType\("),
    "file.exportFile":         ("workflow", r"file\.exportFile\("),
    "monetization":            ("workflow", r"monetization"),
    "contextDomain (emit)":    ("workflow", r"contextDomain"),
    # --- model (TypeScript) ---
    "BlockModel.create":       ("model", r"BlockModel\.create"),
    "createPlDataTableV3":     ("model", r"createPlDataTableV3"),
    "createPlDataTableV2":     ("model", r"createPlDataTableV2"),
    "createPFrameForGraphs":   ("model", r"createPFrameForGraphs"),
    ".argsValid":              ("model", r"\.argsValid"),
    ".retentiveOutput":        ("model", r"\.retentiveOutput"),
    ".sections(":              ("model", r"\.sections\("),
    ".title(":                 ("model", r"\.title\("),
    "resultPool":              ("model", r"resultPool"),
    "axesSpec.find/some":      ("model", r"axesSpec\.(find|some|filter)"),
    "inferDriver/anchors":     ("model", r"anchor(s|Ctx|edId)"),
    # --- ui (Vue) ---
    "PlAgDataTableV2":         ("ui", r"PlAgDataTableV2"),
    "PlAgDataTable(V1)":       ("ui", r"PlAgDataTable\b"),
    "PlBlockPage":             ("ui", r"PlBlockPage"),
    "PlDropdownRef":           ("ui", r"PlDropdownRef"),
    "PlAgChartStackedBar":     ("ui", r"PlAgChart"),
    "useApp/useAgGrid":        ("ui", r"use(App|AgGrid)"),
    "PlFileInput":             ("ui", r"PlFileInput"),
    "graph-maker":             ("ui", r"graph-maker|GraphMaker"),
}
COMPILED = {k: (layer, re.compile(rx)) for k, (layer, rx) in CAPABILITIES.items()}


def block_dirs(root):
    for name in sorted(os.listdir(root)):
        path = os.path.join(root, name)
        if os.path.isdir(path) and not name.startswith("."):
            yield name, path


def scan_block(path):
    """Return the set of capability markers present anywhere in this block."""
    found = set()
    for dirpath, dirnames, filenames in os.walk(path):
        dirnames[:] = [d for d in dirnames if d not in SKIP]
        for fn in filenames:
            if not fn.endswith(EXTS):
                continue
            try:
                text = open(os.path.join(dirpath, fn), errors="replace").read()
            except OSError:
                continue
            for marker, (_layer, rx) in COMPILED.items():
                if marker not in found and rx.search(text):
                    found.add(marker)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("--min", type=int, default=0, help="only markers used by >= N blocks")
    ap.add_argument("--max-blocks", type=int, default=6, help="how many block names to print")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    users = defaultdict(list)
    scanned = 0
    for name, path in block_dirs(args.root):
        for marker in scan_block(path):
            users[marker].append(name)
        scanned += 1

    rows = []
    for marker, (layer, _rx) in CAPABILITIES.items():
        blocks = sorted(users.get(marker, []))
        if len(blocks) < args.min:
            continue
        rows.append({"marker": marker, "layer": layer,
                     "count": len(blocks), "blocks": blocks})
    rows.sort(key=lambda r: (r["layer"], r["count"]))

    if args.json:
        print(json.dumps({"scanned": scanned, "rows": rows}, indent=1))
        return

    print(f"# scanned {scanned} blocks under {args.root}\n")
    current = None
    for r in rows:
        if r["layer"] != current:
            current = r["layer"]
            print(f"\n## {current}\n")
            print(f"{'marker':26} {'n':>4}  blocks")
        shown = r["blocks"][:args.max_blocks]
        more = f" +{len(r['blocks']) - len(shown)}" if len(r["blocks"]) > len(shown) else ""
        print(f"{r['marker']:26} {r['count']:>4}  {', '.join(shown)}{more}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Render or prune the md-comment store without going through Zed.

The md-comment language server keeps every comment in `<root>/.tmp/md-comment.json`
and renders `<root>/.tmp/md-comment.md` from it. Zed's `copy comments` code action is
the only thing that normally writes the export, so a session that never ran it sees a
stale or missing file. This does both jobs from the shell:

    md-comment-store.py export                 # store → .tmp/md-comment.md
    md-comment-store.py clear <file>:<line>... # drop those comments, re-render
    md-comment-store.py clear --all            # drop every comment, re-render

`export` reads the store as the server last saved it: line numbers and the
`(orphaned)` flag are not re-checked against the files. Use
`md-comment-find-anchor.py --store .tmp/md-comment.json` to see which anchors moved.

`clear` writes the store. The running server holds the store in memory and saves it on
every comment action, so it overwrites the edit unless the server is restarted — run
`editor: restart language server` on a markdown file in Zed afterwards.

Exit 0 on success, 1 on a store error.
"""

import argparse
import json
import sys
from pathlib import Path

HEADER = "# markdown comments"
STORE_VERSION = 1


def render(files: dict[str, list[dict]]) -> str:
    """Byte for byte what server/src/export.rs writes."""
    out = HEADER + "\n\n"
    first = True
    for name in sorted(files):
        for comment in files[name]:
            if not first:
                out += "---\n\n"
            first = False
            orphaned = " (orphaned)" if comment.get("orphaned") else ""
            out += f"**{name}** line {comment['line']} (RIGHT){orphaned}\n\n"
            out += comment["text"] + "\n\n"
    return out.rstrip() + "\n"


def parse_ref(ref: str) -> tuple[str, int]:
    name, _, line = ref.rpartition(":")
    if not name or not line.isdigit():
        raise SystemExit(f"not a <file>:<line> reference: {ref}")
    return name, int(line)


def load(store_path: Path) -> dict:
    store = json.loads(store_path.read_text())
    if store.get("version") != STORE_VERSION:
        raise SystemExit(f"{store_path}: unsupported version {store.get('version')}")
    return store


def main() -> int:
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--root", default=".", help="workspace root holding .tmp/")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("export", help="render the store into .tmp/md-comment.md")
    clear = sub.add_parser("clear", help="drop comments, then re-render the export")
    clear.add_argument("refs", nargs="*", metavar="FILE:LINE")
    clear.add_argument("--all", action="store_true", help="drop every comment")

    args = parser.parse_args()

    tmp = Path(args.root) / ".tmp"
    store_path = tmp / "md-comment.json"
    export_path = tmp / "md-comment.md"

    if not store_path.exists():
        tmp.mkdir(parents=True, exist_ok=True)
        export_path.write_text(render({}))
        print(f"{store_path}: missing — wrote an empty export")
        return 0

    store = load(store_path)
    files = store.get("files", {})

    if args.command == "clear":
        if args.all == bool(args.refs):
            parser.error("give either --all or one or more FILE:LINE references")
        if args.all:
            print(f"cleared {sum(len(c) for c in files.values())} comment(s)")
            files = {}
        else:
            for ref in args.refs:
                name, line = parse_ref(ref)
                comments = files.get(name, [])
                kept = [c for c in comments if c["line"] != line]
                print(f"{name}:{line} {'absent' if len(kept) == len(comments) else 'cleared'}")
                if kept:
                    files[name] = kept
                else:
                    files.pop(name, None)
        store["files"] = files
        store_path.write_text(json.dumps(store, indent=2) + "\n")

    export_path.write_text(render(files))
    if args.command == "export":
        print(f"{export_path}: {sum(len(c) for c in files.values())} comment(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Check and serve a tour-v2 folder: TODO.md and tour.json.

A stop is one comment at one line range of the change tip. The order of the
stops array is the reading order.

Usage:
  tour.py check <tour-dir>
  tour.py serve <tour-dir> [--port 8792] [--no-open]

Endpoints of serve:
  GET  /             the viewer page
  GET  /tour         {"tour": <tour.json>, "todo": <TODO.md text>}
  GET  /file?path=P  {"text": <P at the tip>, "changed": [<tip line numbers the diff adds>]}
  POST /open?path=P&line=N   open P at line N in the Zed window on screen
"""

import argparse
import json
import re
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
PAGE = HERE / "index.html"
WORKTREE_TIP = "worktree"
TODO_SECTIONS = ["## Problem", "## Domain", "### Map", "### Terms", "## Map of stops", "## Open points"]
STOP_FIELDS = ["file", "line", "end", "node", "title", "body", "critical"]
HUNK_HEADER = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def load_tour(folder: Path):
    return json.loads((folder / "tour.json").read_text())


def file_at_tip(tour, path: str) -> str:
    repo = Path(tour["repo"])
    if tour["tip"] == WORKTREE_TIP:
        return (repo / path).read_text()
    return subprocess.run(
        ["git", "-C", str(repo), "show", f"{tour['tip']}:{path}"],
        capture_output=True, text=True, check=True,
    ).stdout


def changed_lines(tour, path: str) -> list[int]:
    revs = [tour["base"]] if tour["tip"] == WORKTREE_TIP else [tour["base"], tour["tip"]]
    diff = subprocess.run(
        ["git", "-C", tour["repo"], "diff", "-U0", *revs, "--", path],
        capture_output=True, text=True, check=True,
    ).stdout
    lines = []
    for header in diff.splitlines():
        match = HUNK_HEADER.match(header)
        if match:
            start, count = int(match[1]), int(match[2] or 1)
            lines.extend(range(start, start + count))
    return lines


def find_errors(folder: Path) -> list[str]:
    todo_path = folder / "TODO.md"
    if not todo_path.exists():
        return [f"tour-v2: no TODO.md in {folder}"]
    todo = todo_path.read_text()
    errors = [f"TODO.md: no section {s!r}" for s in TODO_SECTIONS if s not in todo]
    domain_map = todo.split("### Map", 1)[-1].split("### Terms", 1)[0]
    tour = load_tour(folder)
    for key in ["title", "repo", "base", "tip", "stops"]:
        if key not in tour:
            errors.append(f"tour.json: no key {key!r}")
    for number, stop in enumerate(tour.get("stops", []), start=1):
        where = f"tour.json stop {number}"
        missing = [f for f in STOP_FIELDS if f not in stop]
        if missing:
            errors.append(f"{where}: no fields {missing}")
            continue
        try:
            line_count = len(file_at_tip(tour, stop["file"]).splitlines())
        except (OSError, subprocess.CalledProcessError):
            errors.append(f"{where}: {stop['file']} not found at tip {tour['tip']}")
            continue
        if not 1 <= stop["line"] <= stop["end"] <= line_count:
            errors.append(f"{where}: lines {stop['line']}-{stop['end']} outside 1-{line_count} of {stop['file']}")
        if f"#stop-{number})" not in todo:
            errors.append(f"TODO.md: no link to (#stop-{number}) for {stop['title']!r}")
        if f'href "#stop-{number}"' not in domain_map:
            errors.append(f'TODO.md map: no click href "#stop-{number}" for {stop["title"]!r}')
        if stop["node"] not in domain_map:
            errors.append(f"TODO.md map: no node {stop['node']!r} of stop {number}")
    return errors


def make_handler(folder: Path):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            sys.stderr.write("  %s\n" % (fmt % args))

        def _send(self, code, body=b"", content_type="application/json"):
            self.send_response(code)
            if body:
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if body:
                self.wfile.write(body)

        def _stop_path(self, url):
            path = parse_qs(url.query).get("path", [""])[0]
            tour = load_tour(folder)
            if path not in {stop["file"] for stop in tour["stops"]}:
                self._send(403, b"tour-v2: path is not a stop file", "text/plain")
                return tour, None
            return tour, path

        def do_GET(self):
            url = urlparse(self.path)
            if url.path in ("/", "/index.html"):
                self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
            elif url.path == "/tour":
                body = {"tour": load_tour(folder), "todo": (folder / "TODO.md").read_text()}
                self._send(200, json.dumps(body).encode())
            elif url.path == "/file":
                tour, path = self._stop_path(url)
                if path:
                    body = {"text": file_at_tip(tour, path), "changed": changed_lines(tour, path)}
                    self._send(200, json.dumps(body).encode())
            else:
                self._send(404)

        def do_POST(self):
            url = urlparse(self.path)
            if url.path != "/open":
                self._send(404)
                return
            tour, path = self._stop_path(url)
            if not path:
                return
            line = int(parse_qs(url.query).get("line", ["1"])[0])
            target = f"{Path(tour['repo']) / path}:{line}"
            result = subprocess.run(["zed", "--existing", "--", target], capture_output=True, text=True)
            if result.returncode != 0:
                self._send(502, f"tour-v2: zed failed: {result.stderr}".encode(), "text/plain")
                return
            self._send(200, b'{"ok":true}')

    return Handler


def serve(folder: Path, port: int, no_open: bool):
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(folder))
    url = f"http://127.0.0.1:{port}/"
    print(f"tour   {folder}")
    print(f"viewer {url}")
    if not no_open:
        subprocess.run(["open", url], check=False)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


def main():
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("check").add_argument("folder")
    serve_parser = commands.add_parser("serve")
    serve_parser.add_argument("folder")
    serve_parser.add_argument("--port", type=int, default=8792)
    serve_parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()

    folder = Path(args.folder).resolve()
    if args.command == "serve":
        serve(folder, args.port, args.no_open)
        return
    errors = find_errors(folder)
    for error in errors:
        print(error)
    print(f"tour-v2 check: {len(errors)} errors in {folder}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

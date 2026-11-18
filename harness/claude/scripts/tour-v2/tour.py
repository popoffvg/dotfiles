#!/usr/bin/env python3
"""Check tour-v2 folders and serve every open tour in one viewer.

A tour folder holds TODO.md and tour.json. A stop is one comment at one line
range of the change tip. The order of the stops array is the reading order.

Usage:
  tour.py check <tour-dir>
  tour.py serve <tour-dir> [--port 8792] [--no-open]   add the tour; start the server when none runs
  tour.py close <tour-dir>                             remove the tour from the viewer

The open tours are the folders listed in ~/.cache/tour-v2/open-tours.txt, so a
second serve only adds a line, and the running server shows the new tour.

Endpoints, where T is the absolute tour folder:
  GET  /                     the viewer page
  GET  /tours                [{"id": T, "title": ..., "stops": N, "critical": N}]
  GET  /tour?tour=T          {"tour": <tour.json>, "todo": <TODO.md text>}
  GET  /file?tour=T&path=P   {"text": <P at the tip>, "changed": [<tip line numbers the diff adds>]}
  POST /open?tour=T&path=P&line=N   open P at line N in the Zed window on screen
  POST /close?tour=T         remove T from the open tours
"""

import argparse
import json
import re
import socket
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

HERE = Path(__file__).resolve().parent
PAGE = HERE / "index.html"
WORKTREE_TIP = "worktree"
TODO_SECTIONS = ["## Problem", "## Domain", "### Map", "### Terms", "## Map of stops", "## Open points"]
STOP_FIELDS = ["file", "line", "end", "node", "title", "body", "critical"]
OPEN_TOURS = Path.home() / ".cache" / "tour-v2" / "open-tours.txt"
HUNK_HEADER = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def load_tour(folder: Path):
    return json.loads((folder / "tour.json").read_text())


def open_tours() -> list[Path]:
    if not OPEN_TOURS.exists():
        return []
    folders = dict.fromkeys(Path(line) for line in OPEN_TOURS.read_text().splitlines() if line)
    return [folder for folder in folders if (folder / "tour.json").exists()]


def write_open_tours(folders: list[Path]):
    OPEN_TOURS.parent.mkdir(parents=True, exist_ok=True)
    OPEN_TOURS.write_text("".join(f"{folder}\n" for folder in folders))


def close_tour(folder: Path):
    write_open_tours([f for f in open_tours() if f != folder])


def tour_summary(folder: Path):
    tour = load_tour(folder)
    critical = sum(1 for stop in tour["stops"] if stop["critical"])
    return {"id": str(folder), "title": tour["title"], "stops": len(tour["stops"]), "critical": critical}


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


def make_handler():
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

        def _open_tour(self, query):
            folder = Path(query.get("tour", [""])[0])
            if folder not in open_tours():
                self._send(404, b"tour-v2: tour is not open", "text/plain")
                return None
            return folder

        def _stop_path(self, query):
            folder = self._open_tour(query)
            if not folder:
                return None, None
            tour = load_tour(folder)
            path = query.get("path", [""])[0]
            if path not in {stop["file"] for stop in tour["stops"]}:
                self._send(403, b"tour-v2: path is not a stop file", "text/plain")
                return tour, None
            return tour, path

        def do_GET(self):
            url = urlparse(self.path)
            query = parse_qs(url.query)
            if url.path in ("/", "/index.html"):
                self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
            elif url.path == "/tours":
                self._send(200, json.dumps([tour_summary(f) for f in open_tours()]).encode())
            elif url.path == "/tour":
                folder = self._open_tour(query)
                if folder:
                    body = {"tour": load_tour(folder), "todo": (folder / "TODO.md").read_text()}
                    self._send(200, json.dumps(body).encode())
            elif url.path == "/file":
                tour, path = self._stop_path(query)
                if path:
                    body = {"text": file_at_tip(tour, path), "changed": changed_lines(tour, path)}
                    self._send(200, json.dumps(body).encode())
            else:
                self._send(404)

        def do_POST(self):
            url = urlparse(self.path)
            query = parse_qs(url.query)
            if url.path == "/close":
                folder = self._open_tour(query)
                if folder:
                    close_tour(folder)
                    self._send(200, b'{"ok":true}')
                return
            if url.path != "/open":
                self._send(404)
                return
            tour, path = self._stop_path(query)
            if not path:
                return
            line = int(query.get("line", ["1"])[0])
            target = f"{Path(tour['repo']) / path}:{line}"
            result = subprocess.run(["zed", "--existing", "--", target], capture_output=True, text=True)
            if result.returncode != 0:
                self._send(502, f"tour-v2: zed failed: {result.stderr}".encode(), "text/plain")
                return
            self._send(200, b'{"ok":true}')

    return Handler


def server_runs(port: int) -> bool:
    with socket.socket() as probe:
        return probe.connect_ex(("127.0.0.1", port)) == 0


def serve(folder: Path, port: int, no_open: bool):
    close_tour(folder)
    write_open_tours(open_tours() + [folder])
    url = f"http://127.0.0.1:{port}/?tour={quote(str(folder))}"
    print(f"tour   {folder}")
    print(f"viewer {url}")
    if not no_open:
        subprocess.run(["open", url], check=False)
    if server_runs(port):
        print("the server already runs; the tour is added to it")
        return
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler())
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
    commands.add_parser("close").add_argument("folder")
    args = parser.parse_args()

    folder = Path(args.folder).resolve()
    if args.command == "serve":
        serve(folder, args.port, args.no_open)
        return
    if args.command == "close":
        close_tour(folder)
        print(f"closed {folder}")
        return
    errors = find_errors(folder)
    for error in errors:
        print(error)
    print(f"tour-v2 check: {len(errors)} errors in {folder}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

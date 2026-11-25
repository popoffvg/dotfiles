#!/usr/bin/env python3
"""Check tour-v2 folders and serve every open tour in one viewer.

A tour folder holds TODO.md and tour.json. A stop is one comment at one line
range of the change tip. The order of the stops array is the reading order.
A flow is one path through the system from its trigger to its outcome. TODO.md
describes each flow under "### Flow: <name>", and each stop names its flow.

Usage (the tour command runs this file):
  tour open <tour-dir>    add the tour as a tab and open it in the browser
  tour close <tour-dir>   remove the tab
  tour list               print the open tours
  tour check <tour-dir>   exit 1 when TODO.md or tour.json breaks a rule
  tour serve              run the viewer on 127.0.0.1:8792; the com.vitalii.tour-v2 LaunchAgent runs it

The open tours are the folders listed in ~/.cache/tour-v2/open-tours.txt, so
open only adds a line, and the running server shows the new tour.

Endpoints, where T is the absolute tour folder:
  GET  /                     the viewer page
  GET  /tours                [{"id": T, "title": ..., "stops": N, "critical": N}]
  GET  /tour?tour=T          {"tour": <tour.json>, "todo": <TODO.md text>}
  GET  /file?tour=T&path=P   {"old": <P at the base or null>, "new": <P at the tip or null>}
  POST /open?tour=T&path=P&line=N   open P at line N in the Zed window on screen
  POST /close?tour=T         remove T from the open tours
"""

import argparse
import json
import socket
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

HERE = Path(__file__).resolve().parent
PAGE = HERE / "index.html"
WORKTREE_TIP = "worktree"
FLOWS_SECTION = "## Flows"
TODO_SECTIONS = ["## Problem", "## Domain", "### Map", "### Terms", FLOWS_SECTION, "## Open points"]
STOP_FIELDS = ["file", "line", "end", "flow", "node", "title", "body", "critical"]
FLOW_HEADING = "### Flow: "
FLOW_FIELDS = ["**Description:**", "**Trigger:**", "**Before:**", "**Change:**"]
PORT = 8792
VIEWER = f"http://127.0.0.1:{PORT}/"
DAEMON = "com.vitalii.tour-v2"
OPEN_TOURS = Path.home() / ".cache" / "tour-v2" / "open-tours.txt"


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


def file_at(tour, rev: str, path: str) -> str | None:
    repo = Path(tour["repo"])
    if rev == WORKTREE_TIP:
        target = repo / path
        return target.read_text() if target.exists() else None
    shown = subprocess.run(["git", "-C", str(repo), "show", f"{rev}:{path}"], capture_output=True, text=True)
    return shown.stdout if shown.returncode == 0 else None


def flow_sections(todo: str) -> dict[str, str]:
    flows = todo.split(FLOWS_SECTION, 1)[-1].split("\n## ", 1)[0]
    sections = flows.split(FLOW_HEADING)[1:]
    return {section.split("\n", 1)[0].strip(): section for section in sections}


def find_errors(folder: Path) -> list[str]:
    todo_path = folder / "TODO.md"
    if not todo_path.exists():
        return [f"tour-v2: no TODO.md in {folder}"]
    todo = todo_path.read_text()
    errors = [f"TODO.md: no section {s!r}" for s in TODO_SECTIONS if s not in todo]
    domain_map = todo.split("### Map", 1)[-1].split("### Terms", 1)[0]
    flows = flow_sections(todo)
    for name, section in flows.items():
        errors += [f"TODO.md flow {name!r}: no {field!r} line" for field in FLOW_FIELDS if field not in section]
    tour = load_tour(folder)
    for key in ["title", "repo", "base", "tip", "stops"]:
        if key not in tour:
            errors.append(f"tour.json: no key {key!r}")
    mapped_nodes = set()
    for number, stop in enumerate(tour.get("stops", []), start=1):
        where = f"tour.json stop {number}"
        missing = [f for f in STOP_FIELDS if f not in stop]
        if missing:
            errors.append(f"{where}: no fields {missing}")
            continue
        text = file_at(tour, tour["tip"], stop["file"])
        if text is None:
            errors.append(f"{where}: {stop['file']} not found at tip {tour['tip']}")
            continue
        line_count = len(text.splitlines())
        if not 1 <= stop["line"] <= stop["end"] <= line_count:
            errors.append(f"{where}: lines {stop['line']}-{stop['end']} outside 1-{line_count} of {stop['file']}")
        flow = flows.get(stop["flow"])
        if flow is None:
            errors.append(f"TODO.md: no section {FLOW_HEADING + stop['flow']!r} for stop {number}")
        elif f"(#stop-{number})" not in flow:
            errors.append(f"TODO.md flow {stop['flow']!r}: no step links to (#stop-{number}) for {stop['title']!r}")
        is_first_stop_of_node = stop["node"] not in mapped_nodes
        mapped_nodes.add(stop["node"])
        if is_first_stop_of_node and f'href "#stop-{number}"' not in domain_map:
            errors.append(f'TODO.md map: no click href "#stop-{number}" for node {stop["node"]!r}')
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
                    body = {"old": file_at(tour, tour["base"], path), "new": file_at(tour, tour["tip"], path)}
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


def server_runs() -> bool:
    with socket.socket() as probe:
        return probe.connect_ex(("127.0.0.1", PORT)) == 0


def open_tour(folder: Path):
    close_tour(folder)
    write_open_tours(open_tours() + [folder])
    url = f"{VIEWER}?tour={quote(str(folder))}"
    print(url)
    if not server_runs():
        print(f"tour: no viewer on port {PORT}; start it with: launchctl kickstart gui/$(id -u)/{DAEMON}")
        return
    subprocess.run(["open", url], check=False)


def serve():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), make_handler())
    print(f"viewer {VIEWER}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


def main():
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(prog="tour")
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ["open", "close", "check"]:
        commands.add_parser(name).add_argument("folder")
    commands.add_parser("list")
    commands.add_parser("serve")
    args = parser.parse_args()

    if args.command == "serve":
        serve()
        return
    if args.command == "list":
        for folder in open_tours():
            print(f"{folder}\t{load_tour(folder)['title']}")
        return
    folder = Path(args.folder).resolve()
    if args.command == "open":
        open_tour(folder)
        return
    if args.command == "close":
        close_tour(folder)
        print(f"closed {folder}")
        return
    errors = find_errors(folder)
    for error in errors:
        print(error)
    print(f"tour check: {len(errors)} errors in {folder}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()

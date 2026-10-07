#!/usr/bin/env python3
"""Serve a tldraw editor bound to one document file on disk.

The browser page loads the document, saves it back on every edit, and the file
on disk is the single copy. No downloads folder, no manual copying.

Usage: serve.py <document.json> [--port 8791] [--no-open] [--reseed]

Endpoints:
  GET  /       the editor page
  GET  /doc    the document JSON, or 204 when the file does not exist yet
  PUT  /doc    write the body to the document file
  GET  /seed   <document-stem>.seed.json, or 204 when absent
  PUT  /picture  write the PNG body to <document-stem>.png — the page sends
                 one after every save, so the PNG shows the board as it is
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
PAGE = HERE / "index.html"


def make_handler(doc: Path, seed: Path, picture: Path):
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

        def _send_file(self, path: Path, content_type):
            if not path.exists():
                self._send(204)
                return
            self._send(200, path.read_bytes(), content_type)

        def do_GET(self):
            if self.path in ("/", "/index.html"):
                self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
            elif self.path == "/doc":
                self._send_file(doc, "application/json")
            elif self.path == "/seed":
                self._send_file(seed, "application/json")
            else:
                self._send(404)

        def do_PUT(self):
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            if self.path == "/picture":
                write_atomic(picture, body)
                print(f"picture {picture}", flush=True)
                self._send(200, b'{"ok":true}')
                return
            if self.path != "/doc":
                self._send(404)
                return
            try:
                json.loads(body)
            except ValueError as error:
                self._send(400, str(error).encode(), "text/plain")
                return
            write_atomic(doc, body)
            self._send(200, b'{"ok":true}')

    return Handler


def write_atomic(path: Path, body: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    with os.fdopen(handle, "wb") as out:
        out.write(body)
    os.replace(temp, path)


def main():
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser()
    parser.add_argument("document")
    parser.add_argument("--port", type=int, default=8791)
    parser.add_argument("--no-open", action="store_true")
    parser.add_argument(
        "--reseed",
        action="store_true",
        help="delete the document first, so the page rebuilds it from the seed",
    )
    args = parser.parse_args()

    doc = Path(args.document).resolve()
    stem = doc.name.split(".")[0]
    seed = doc.parent / (stem + ".seed.json")
    picture = doc.parent / (stem + ".png")
    if args.reseed and doc.exists():
        doc.unlink()
        print(f"reseed: removed {doc}")

    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(doc, seed, picture))
    url = f"http://127.0.0.1:{args.port}/"
    print(f"document {doc}")
    print(f"seed     {seed} ({'present' if seed.exists() else 'absent'})")
    print(f"picture  {picture}")
    print(f"editor   {url}")
    if not args.no_open:
        subprocess.run(["open", url], check=False)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Rename a Go package and its directory through gopls over stdio."""

import argparse
import json
import os
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from urllib.parse import unquote, urlparse

# gopls only renames the enclosing directory in one move when this is on;
# with it off the server emits a per-file move plus a directory delete,
# and subpackages are left behind.
SETTINGS = {"renameMovesSubpackages": True}


def uri_of(path):
    return Path(path).resolve().as_uri()


def path_of(uri):
    return unquote(urlparse(uri).path)


class Gopls:
    def __init__(self, root):
        self.proc = subprocess.Popen(
            ["gopls", "serve"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            cwd=root,
        )
        self.next_id = 0
        self.replies = {}
        self.lock = threading.Condition()
        threading.Thread(target=self._read_loop, daemon=True).start()

    def _send(self, message):
        body = json.dumps(message).encode()
        self.proc.stdin.write(b"Content-Length: %d\r\n\r\n" % len(body) + body)
        self.proc.stdin.flush()

    def _read_loop(self):
        out = self.proc.stdout
        while True:
            length = 0
            while True:
                line = out.readline()
                if not line:
                    return
                if line in (b"\r\n", b"\n"):
                    break
                if line.lower().startswith(b"content-length:"):
                    length = int(line.split(b":")[1])
            message = json.loads(out.read(length))
            if "method" in message and "id" in message:
                self._answer(message)
            elif "id" in message:
                with self.lock:
                    self.replies[message["id"]] = message
                    self.lock.notify_all()

    def _answer(self, request):
        method = request["method"]
        if method == "workspace/configuration":
            result = [SETTINGS for _ in request["params"]["items"]]
        else:
            result = None
        self._send({"jsonrpc": "2.0", "id": request["id"], "result": result})

    def call(self, method, params):
        with self.lock:
            self.next_id += 1
            request_id = self.next_id
        self._send({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
        with self.lock:
            while request_id not in self.replies:
                self.lock.wait()
            reply = self.replies.pop(request_id)
        if "error" in reply:
            raise SystemExit("gopls %s: %s" % (method, reply["error"]["message"]))
        return reply.get("result")

    def notify(self, method, params):
        self._send({"jsonrpc": "2.0", "method": method, "params": params})


def utf16_to_index(line, units):
    index = 0
    seen = 0
    for char in line:
        if seen >= units:
            break
        seen += 2 if ord(char) > 0xFFFF else 1
        index += 1
    return index


def apply_text_edits(path, edits):
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    lines = text.splitlines(keepends=True)
    starts = [0]
    for line in lines:
        starts.append(starts[-1] + len(line))

    def offset(position):
        line = position["line"]
        if line >= len(lines):
            return len(text)
        return starts[line] + utf16_to_index(lines[line], position["character"])

    spans = sorted(
        ((offset(e["range"]["start"]), offset(e["range"]["end"]), e["newText"]) for e in edits),
        reverse=True,
    )
    for start, end, replacement in spans:
        text = text[:start] + replacement + text[end:]
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text)


def move(old, new, use_git):
    os.makedirs(os.path.dirname(new), exist_ok=True)
    if use_git:
        # git mv refuses a directory git has never tracked; plain move still has to happen.
        moved = subprocess.run(
            ["git", "mv", old, new], cwd=os.path.dirname(old) or ".", capture_output=True
        )
        if moved.returncode == 0:
            return
    shutil.move(old, new)


def apply_workspace_edit(edit, use_git, touched):
    for change in edit.get("documentChanges", []):
        kind = change.get("kind")
        if kind is None:
            path = path_of(change["textDocument"]["uri"])
            apply_text_edits(path, change["edits"])
            touched.append(path)
        elif kind == "rename":
            old, new = path_of(change["oldUri"]), path_of(change["newUri"])
            move(old, new, use_git)
            touched.append("%s -> %s" % (old, new))
        elif kind == "delete":
            path = path_of(change["uri"])
            if os.path.isdir(path):
                os.rmdir(path)
            else:
                os.remove(path)
            touched.append("deleted %s" % path)
        elif kind == "create":
            open(path_of(change["uri"]), "a").close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="module root gopls loads")
    parser.add_argument("--file", required=True, help="file holding the package clause")
    parser.add_argument("--line", type=int, required=True, help="1-based line of the package clause")
    parser.add_argument("--col", type=int, required=True, help="1-based column of the package name")
    parser.add_argument("--new-name", required=True)
    parser.add_argument("--git", action="store_true", help="move files with git mv")
    args = parser.parse_args()

    with open(args.file, encoding="utf-8") as handle:
        content = handle.read()

    server = Gopls(args.root)
    server.call(
        "initialize",
        {
            "processId": os.getpid(),
            "rootUri": uri_of(args.root),
            "workspaceFolders": [{"uri": uri_of(args.root), "name": os.path.basename(args.root)}],
            "initializationOptions": SETTINGS,
            "capabilities": {
                "workspace": {
                    "configuration": True,
                    "workspaceEdit": {"documentChanges": True, "resourceOperations": ["create", "rename", "delete"]},
                },
                "window": {"workDoneProgress": True},
            },
        },
    )
    server.notify("initialized", {})
    server.notify(
        "textDocument/didOpen",
        {
            "textDocument": {
                "uri": uri_of(args.file),
                "languageId": "go",
                "version": 1,
                "text": content,
            }
        },
    )
    edit = server.call(
        "textDocument/rename",
        {
            "textDocument": {"uri": uri_of(args.file)},
            "position": {"line": args.line - 1, "character": args.col - 1},
            "newName": args.new_name,
        },
    )
    if not edit:
        raise SystemExit("gopls returned no edit — is the cursor on the package name?")

    touched = []
    apply_workspace_edit(edit, args.git, touched)
    server.call("shutdown", None)
    server.notify("exit", {})
    for item in touched:
        print(item)


if __name__ == "__main__":
    main()

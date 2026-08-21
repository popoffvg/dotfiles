#!/usr/bin/env python3
"""Drive md-comment-lsp over stdio the way Zed does, and print what an editor would see.

Proves the server side of the md-comment extension in isolation: capabilities,
the code action list, the input file handed over by `add comment`, and the inlay hint
that appears once that input file is saved. Any failure here is the server; a pass means the problem is on the
editor side (extension not loaded, language server not started, settings).

usage: md-comment-probe.py [<markdown-file>] [--binary <path>] [--line N]

With no file, a temporary markdown file is created in a temporary workspace root.
--line is 0-based, as on the LSP wire (default 0).
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


class Client:
    def __init__(self, binary: str):
        self.proc = subprocess.Popen(
            [binary],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        self.next_id = 0

    def send(self, message: dict) -> None:
        body = json.dumps(message).encode()
        self.proc.stdin.write(b"Content-Length: %d\r\n\r\n%s" % (len(body), body))
        self.proc.stdin.flush()

    def request(self, method: str, params: dict) -> dict:
        self.next_id += 1
        wanted = self.next_id
        self.send({"jsonrpc": "2.0", "id": wanted, "method": method, "params": params})
        while True:
            message = self.receive()
            if message.get("id") == wanted and "method" not in message:
                return message
            if "method" in message:
                print(f"  ← server sent {message['method']}")
                if "id" in message:  # a server→client request needs an answer
                    self.send({"jsonrpc": "2.0", "id": message["id"], "result": None})

    def notify(self, method: str, params: dict) -> None:
        self.send({"jsonrpc": "2.0", "method": method, "params": params})

    def wait_for(self, method: str) -> dict:
        """Read until the server makes this request, answering everything on the way."""
        for _ in range(50):
            message = self.receive()
            if message.get("method") == method:
                if "id" in message:
                    self.send({"jsonrpc": "2.0", "id": message["id"], "result": {"applied": True}})
                return message
            if "method" in message and "id" in message:
                self.send({"jsonrpc": "2.0", "id": message["id"], "result": None})
        raise SystemExit(f"the server never sent {method}")

    def receive(self) -> dict:
        length = 0
        while True:
            line = self.proc.stdout.readline()
            if not line:
                err = self.proc.stderr.read().decode(errors="replace")
                raise SystemExit(f"server closed the connection. stderr:\n{err}")
            text = line.decode().strip()
            if not text:
                break
            if text.lower().startswith("content-length:"):
                length = int(text.split(":", 1)[1])
        return json.loads(self.proc.stdout.read(length))

    def close(self) -> None:
        self.proc.kill()
        self.proc.wait()


def main() -> int:
    args = sys.argv[1:]
    binary = os.path.expanduser("~/.local/bin/md-comment-lsp")
    if "--binary" in args:
        index = args.index("--binary")
        binary = args[index + 1]
        del args[index : index + 2]
    line = 0
    if "--line" in args:
        index = args.index("--line")
        line = int(args[index + 1])
        del args[index : index + 2]

    temporary = None
    if args:
        target = Path(args[0]).resolve()
        root = target.parent
    else:
        temporary = tempfile.mkdtemp(prefix="md-comment-probe-")
        root = Path(temporary)
        target = root / "probe.md"
        target.write_text("# Probe\n\n## Design\n\nsome prose\n")

    text = target.read_text()
    print(f"binary : {binary}")
    print(f"root   : {root}")
    print(f"file   : {target} (line {line}: {text.split(chr(10))[line]!r})")

    client = Client(binary)
    try:
        reply = client.request(
            "initialize",
            {
                "capabilities": {},
                "workspaceFolders": [{"uri": f"file://{root}", "name": root.name}],
            },
        )
        capabilities = reply["result"]["capabilities"]
        print("\ncapabilities:")
        for key in ("codeActionProvider", "inlayHintProvider"):
            print(f"  {key}: {json.dumps(capabilities.get(key))}")
        print(
            "  executeCommandProvider.commands: "
            f"{json.dumps(capabilities.get('executeCommandProvider', {}).get('commands'))}"
        )

        client.notify("initialized", {})
        uri = f"file://{target}"
        client.notify(
            "textDocument/didOpen",
            {
                "textDocument": {
                    "uri": uri,
                    "languageId": "markdown",
                    "version": 1,
                    "text": text,
                }
            },
        )

        position = {"line": line, "character": 0}
        actions = client.request(
            "textDocument/codeAction",
            {
                "textDocument": {"uri": uri},
                "range": {"start": position, "end": position},
                "context": {"diagnostics": []},
            },
        )["result"]
        print(f"\ncode actions : {len(actions or [])}")
        for action in actions or []:
            print(f"  {action['title']!r} kind={action['kind']} cmd={action['command']['command']}")
        add = next(
            (a for a in actions or [] if a["command"]["command"] == "md-comment.add"), None
        )
        if add is None:
            print("  → no add action: the server does not serve this file")
            return 1

        client.request(
            "workspace/executeCommand",
            {"command": add["command"]["command"], "arguments": add["command"]["arguments"]},
        )
        edit = client.wait_for("workspace/applyEdit")
        changes = edit["params"]["edit"]["documentChanges"]
        header = changes[1]["edits"][0]["newText"]
        print(f"\ninput file   : {header.strip()}")

        # One input file per code action; the server names it and tells us which.
        input_path = Path(changes[0]["uri"].removeprefix("file://"))
        print(f"input path   : {input_path}")
        input_path.parent.mkdir(parents=True, exist_ok=True)
        input_path.write_text(f"{header}probe comment\n")
        client.notify(
            "workspace/didChangeWatchedFiles",
            {"changes": [{"uri": f"file://{input_path}", "type": 2}]},
        )

        whole = {
            "start": {"line": 0, "character": 0},
            "end": {"line": len(text.split("\n")), "character": 0},
        }
        hints = client.request(
            "textDocument/inlayHint", {"textDocument": {"uri": uri}, "range": whole}
        )["result"]
        print(f"inlay hints  : {len(hints or [])}")
        for hint in hints or []:
            print(f"  {hint['position']} {hint['label']!r}")
        print(f"input drained: {not input_path.exists()!r}")

        store = root / ".tmp" / "md-comment.json"
        print(f"\nstore written: {store.exists()} ({store})")
        if not (hints and actions):
            print("\nFAIL: the server answered but produced no hints or actions")
            return 1
        print("\nPASS: the server side works. Any missing UI is editor-side.")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())

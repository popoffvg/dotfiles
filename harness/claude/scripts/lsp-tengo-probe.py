#!/usr/bin/env python3
"""Drive tengo-lsp over stdio and dump what an editor would show for one file.

Reports, per file: publishDiagnostics notifications, textDocument/documentSymbol,
and (optionally) textDocument/hover at a position.

Usage: lsp-tengo-probe.py <binary> <root_dir> <file> [<hover_line0> <hover_col0>]
"""
import json
import os
import subprocess
import sys
import threading

TIMEOUT = 15


def frame(obj):
    body = json.dumps(obj).encode()
    return b"Content-Length: %d\r\n\r\n%s" % (len(body), body)


def read_msg(stream):
    headers = {}
    while True:
        line = stream.readline()
        if not line:
            return None
        line = line.decode(errors="replace").strip()
        if line == "":
            break
        k, _, v = line.partition(":")
        headers[k.strip().lower()] = v.strip()
    if "content-length" not in headers:
        return None
    n = int(headers["content-length"])
    return json.loads(stream.read(n).decode())


def flatten(symbols, depth=0, out=None):
    if out is None:
        out = []
    for s in symbols or []:
        rng = s.get("selectionRange") or s.get("range") or {}
        start = rng.get("start", {})
        out.append(
            "%s%s (kind %s) @%s:%s"
            % (
                "  " * depth,
                s.get("name"),
                s.get("kind"),
                start.get("line"),
                start.get("character"),
            )
        )
        flatten(s.get("children"), depth + 1, out)
    return out


def main():
    binary, root, path = sys.argv[1:4]
    hover = sys.argv[4:6]
    root_uri = "file://" + os.path.abspath(root)
    file_uri = "file://" + os.path.abspath(path)
    text = open(path).read()

    p = subprocess.Popen(
        [binary],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    stderr_lines = []

    def drain_stderr():
        for line in p.stderr:
            stderr_lines.append(line.decode(errors="replace").rstrip())

    threading.Thread(target=drain_stderr, daemon=True).start()

    def send(obj):
        p.stdin.write(frame(obj))
        p.stdin.flush()

    send(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "processId": os.getpid(),
                "rootUri": root_uri,
                "workspaceFolders": [{"uri": root_uri, "name": "root"}],
                "capabilities": {
                    "textDocument": {
                        "publishDiagnostics": {"relatedInformation": True},
                        "documentSymbol": {"hierarchicalDocumentSymbolSupport": True},
                    }
                },
            },
        }
    )
    # Wait for the initialize RESULT before anything else — the server answers
    # -32002 "Server not initialized" to requests that arrive before it.
    init_caps_holder = {}
    while True:
        msg = read_msg(p.stdout)
        if msg is None:
            print("server closed stdout during initialize")
            return
        if msg.get("id") == 1:
            init_caps_holder["caps"] = msg.get("result", {}).get("capabilities", {})
            break

    send({"jsonrpc": "2.0", "method": "initialized", "params": {}})
    send(
        {
            "jsonrpc": "2.0",
            "method": "textDocument/didOpen",
            "params": {
                "textDocument": {
                    "uri": file_uri,
                    "languageId": "tengo",
                    "version": 1,
                    "text": text,
                }
            },
        }
    )
    send(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "textDocument/documentSymbol",
            "params": {"textDocument": {"uri": file_uri}},
        }
    )
    if len(hover) == 2:
        send(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "textDocument/hover",
                "params": {
                    "textDocument": {"uri": file_uri},
                    "position": {"line": int(hover[0]), "character": int(hover[1])},
                },
            }
        )

    if len(hover) == 2:
        send(
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "textDocument/definition",
                "params": {
                    "textDocument": {"uri": file_uri},
                    "position": {"line": int(hover[0]), "character": int(hover[1])},
                },
            }
        )

    want_ids = {2} | ({3, 4} if len(hover) == 2 else set())
    diagnostics = []
    symbols = None
    hover_result = "n/a"
    definition_result = {"v": "n/a"}
    init_caps = init_caps_holder.get("caps")

    def pump():
        nonlocal symbols, hover_result, init_caps
        while want_ids:
            msg = read_msg(p.stdout)
            if msg is None:
                return
            if msg.get("method") == "textDocument/publishDiagnostics":
                diagnostics.append(msg["params"])
            elif msg.get("id") == 1:
                init_caps = msg.get("result", {}).get("capabilities", {})
            elif msg.get("id") == 2:
                if "error" in msg:
                    print("=== documentSymbol ERROR ===")
                    print(json.dumps(msg["error"])[:1000])
                symbols = msg.get("result")
                want_ids.discard(2)
            elif msg.get("id") == 3:
                hover_result = json.dumps(msg.get("result"))[:400]
                want_ids.discard(3)
            elif msg.get("id") == 4:
                definition_result["v"] = json.dumps(
                    msg.get("error") or msg.get("result")
                )[:600]
                want_ids.discard(4)

    t = threading.Thread(target=pump, daemon=True)
    t.start()
    t.join(TIMEOUT)
    timed_out = t.is_alive()

    print("=== server capabilities ===")
    print(sorted(init_caps.keys()) if init_caps else "NONE (initialize did not answer)")

    print("=== diagnostics (%d notifications) ===" % len(diagnostics))
    for d in diagnostics:
        items = d.get("diagnostics", [])
        print("%s -> %d" % (d.get("uri", "").split("/")[-1], len(items)))
        for it in items:
            st = it["range"]["start"]
            print(
                "  L%d:%d sev=%s %s"
                % (st["line"] + 1, st["character"], it.get("severity"), it.get("message"))
            )

    print("=== documentSymbol ===")
    if symbols is None:
        print("no response" + (" (TIMED OUT)" if timed_out else ""))
    else:
        lines = flatten(symbols)
        print("count: %d" % len(lines))
        for line in lines:
            print("  " + line)

    if len(hover) == 2:
        print("=== hover ===")
        print(hover_result)
        print("=== definition ===")
        print(definition_result["v"])

    if stderr_lines:
        print("=== stderr (last 20) ===")
        for line in stderr_lines[-20:]:
            print("  " + line)

    p.kill()


if __name__ == "__main__":
    main()

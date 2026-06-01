#!/usr/bin/env python3
"""Drive tengo-lsp over stdio and issue a references request.

Usage: lsp-references-smoke.py <binary> <root_dir> <file> <line0> <col0>
Prints the JSON references result.
"""
import json
import subprocess
import sys
import os


def frame(obj):
    body = json.dumps(obj).encode()
    return b"Content-Length: %d\r\n\r\n%s" % (len(body), body)


def read_msg(stream):
    headers = {}
    while True:
        line = stream.readline()
        if not line:
            return None
        line = line.decode().strip()
        if line == "":
            break
        k, _, v = line.partition(":")
        headers[k.strip().lower()] = v.strip()
    n = int(headers["content-length"])
    return json.loads(stream.read(n).decode())


def main():
    binary, root, path, line, col = sys.argv[1:6]
    line, col = int(line), int(col)
    root_uri = "file://" + os.path.abspath(root)
    file_uri = "file://" + os.path.abspath(path)
    text = open(path).read()

    p = subprocess.Popen([binary], stdin=subprocess.PIPE, stdout=subprocess.PIPE)

    import time
    p.stdin.write(frame(
        {"jsonrpc": "2.0", "id": 1, "method": "initialize",
         "params": {"processId": None, "rootUri": root_uri,
                    "workspaceFolders": [{"uri": root_uri, "name": "ws"}],
                    "capabilities": {}}}))
    p.stdin.flush()
    # Block until the initialize response arrives.
    while True:
        m = read_msg(p.stdout)
        if m and m.get("id") == 1:
            break

    for m in [
        {"jsonrpc": "2.0", "method": "initialized", "params": {}},
        {"jsonrpc": "2.0", "method": "textDocument/didOpen",
         "params": {"textDocument": {"uri": file_uri, "languageId": "tengo",
                                     "version": 1, "text": text}}},
    ]:
        p.stdin.write(frame(m))
    p.stdin.flush()
    time.sleep(1.0)  # let didOpen be stored before requesting references

    p.stdin.write(frame(
        {"jsonrpc": "2.0", "id": 2, "method": "textDocument/references",
         "params": {"textDocument": {"uri": file_uri},
                    "position": {"line": line, "character": col},
                    "context": {"includeDeclaration": True}}}))
    p.stdin.flush()

    while True:
        msg = read_msg(p.stdout)
        if msg is None:
            break
        if "error" in msg:
            print("ERROR:", msg["error"])
        if msg.get("id") == 2:
            result = msg.get("result")
            if result is None:
                print("references result is null; full msg:", json.dumps(msg))
                break
            print(f"references count: {len(result)}")
            for r in result:
                u = r["uri"].rsplit("/", 1)[-1]
                rng = r["range"]["start"]
                print(f"  {u}:{rng['line']+1}:{rng['character']}")
            break
    p.stdin.write(frame({"jsonrpc": "2.0", "id": 3, "method": "shutdown", "params": None}))
    p.stdin.write(frame({"jsonrpc": "2.0", "method": "exit", "params": None}))
    p.stdin.flush()
    p.wait(timeout=5)


if __name__ == "__main__":
    main()

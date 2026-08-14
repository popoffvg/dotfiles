#!/usr/bin/env python3
"""Call a Platforma desktop MCP tool over streamable HTTP.

Usage: pl-mcp.py <tool> [json-args] [--out FILE] [--jq PY_EXPR]
       pl-mcp.py list                          — list available tools + schemas
  PL_MCP_URL must hold the /mcp endpoint. 127.0.0.1 is outside the Claude Code
  command sandbox, so callers need the sandbox off.
  --jq evaluates a python expression against `d` (the parsed text content when
  it is JSON, else the raw string).
"""

import json
import os
import sys
import urllib.request

URL = os.environ["PL_MCP_URL"]
HEADERS = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}


def post(body, session=None, timeout=600):
    headers = dict(HEADERS)
    if session:
        headers["mcp-session-id"] = session
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers=headers, method="POST")
    resp = urllib.request.urlopen(req, timeout=timeout)
    return resp, resp.read().decode()


def sse_payloads(text):
    for line in text.splitlines():
        if line.startswith("data:"):
            yield json.loads(line[5:].strip())


def main():
    args = sys.argv[1:]
    out = jq = None
    if "--out" in args:
        i = args.index("--out")
        out = args[i + 1]
        del args[i : i + 2]
    if "--jq" in args:
        i = args.index("--jq")
        jq = args[i + 1]
        del args[i : i + 2]
    tool = args[0]
    tool_args = json.loads(args[1]) if len(args) > 1 else {}

    resp, body = post(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "cc", "version": "0"},
            },
        }
    )
    session = resp.headers.get("mcp-session-id")
    post({"jsonrpc": "2.0", "method": "notifications/initialized"}, session)

    if tool == "list":
        _, body = post({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, session)
        texts = []
        for payload in sse_payloads(body):
            if "error" in payload:
                print("ERROR:", json.dumps(payload["error"], indent=2), file=sys.stderr)
                return 1
            texts.append(json.dumps(payload.get("result", {}).get("tools", []), indent=1))
        text = "\n".join(texts)
        if out:
            with open(out, "w") as fh:
                fh.write(text)
            print(f"{len(text)} chars -> {out}")
        else:
            print(text)
        return 0

    _, body = post(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": tool, "arguments": tool_args},
        },
        session,
    )

    texts = []
    for payload in sse_payloads(body):
        if "error" in payload:
            print("ERROR:", json.dumps(payload["error"], indent=2), file=sys.stderr)
            return 1
        for c in payload.get("result", {}).get("content", []):
            texts.append(c.get("text", json.dumps(c)))
    text = "\n".join(texts)

    if jq:
        try:
            d = json.loads(text)
        except json.JSONDecodeError:
            d = text
        text = eval(jq, {"d": d, "json": json})  # noqa: S307 - operator-supplied expression
        if not isinstance(text, str):
            text = json.dumps(text, indent=1)
    if out:
        with open(out, "w") as fh:
            fh.write(text)
        print(f"{len(text)} chars -> {out}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())

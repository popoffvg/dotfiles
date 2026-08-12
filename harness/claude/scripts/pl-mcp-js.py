#!/usr/bin/env python3
"""Run JS inside a Platforma desktop block webview through the desktop MCP.

Usage: pl-mcp-js.py <projectId> <blockId> <js-file>
       pl-mcp-js.py <projectId> <blockId> -   # JS on stdin

`window.platforma` (driverKit: lsDriver, pFrameDriver, ...) is in scope there.
Wrap the snippet in an async IIFE that returns a string; the MCP swallows the
real error text otherwise and only says the script failed.
PL_MCP_URL holds the /mcp endpoint. 127.0.0.1 is outside the command sandbox —
run with the sandbox off.
"""
import json
import os
import subprocess
import sys

HELPER = os.path.expanduser("~/.claude/scripts/pl-mcp.py")


def main() -> int:
    project_id, block_id, js_path = sys.argv[1], sys.argv[2], sys.argv[3]
    code = sys.stdin.read() if js_path == "-" else open(js_path).read()
    args = json.dumps({"projectId": project_id, "blockId": block_id, "code": code})
    proc = subprocess.run([HELPER, "execute_js", args], capture_output=True, text=True)
    sys.stderr.write(proc.stderr)
    out = proc.stdout.strip()
    # The tool returns the value JSON-encoded once; unwrap so nested JSON reads.
    try:
        out = json.loads(out)
    except ValueError:
        pass
    print(out)
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())

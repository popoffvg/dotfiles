#!/usr/bin/env python3
"""Wait for a Platforma desktop block to finish, past the MCP call's own timeout.

`await_block_done` returns as soon as its `timeout` elapses, and a Claude Code Bash
call caps out at 10 minutes — neither survives a MiXCR run. This loops the call
until the block reports a terminal calculationStatus or the deadline passes, and
prints one status line per poll so a background run stays readable.

Usage: pl-block-wait.py <projectId> <blockId> [--deadline SECONDS] [--poll SECONDS]
  PL_MCP_URL must hold the /mcp endpoint; 127.0.0.1 is outside the command
  sandbox, so callers need the sandbox off.
Exit: 0 the block reached Done, 1 it failed or errored, 2 the deadline passed.
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

PL_MCP = str(Path(__file__).with_name("pl-mcp.py"))
TERMINAL = {"Done", "Failure", "Failed", "Error"}


def call(tool, args):
    proc = subprocess.run(
        [sys.executable, PL_MCP, tool, json.dumps(args)],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        return {"_error": (proc.stderr or proc.stdout).strip()}
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {"_error": proc.stdout.strip()}


def status_of(project_id, block_id):
    ov = call("get_project_overview", {"projectId": project_id})
    if "_error" in ov:
        return ov
    for b in ov.get("blocks", []):
        if b["id"] == block_id:
            return b
    return {"_error": f"block {block_id} not in project {project_id}"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project_id")
    ap.add_argument("block_id")
    ap.add_argument("--deadline", type=float, default=7200, help="seconds (default 7200)")
    ap.add_argument("--poll", type=float, default=30, help="seconds between polls (default 30)")
    a = ap.parse_args()

    end = time.monotonic() + a.deadline
    last = None
    while time.monotonic() < end:
        call(
            "await_block_done",
            {
                "projectId": a.project_id,
                "blockId": a.block_id,
                "timeout": int(min(a.poll, end - time.monotonic()) * 1000),
                "transform": "block?.calculationStatus",
            },
        )
        b = status_of(a.project_id, a.block_id)
        if "_error" in b:
            print(f"[{time.strftime('%H:%M:%S')}] error: {b['_error']}", flush=True)
            time.sleep(a.poll)
            continue
        line = (
            f"[{time.strftime('%H:%M:%S')}] {b['calculationStatus']}"
            f" outputErrors={b.get('outputErrors')} canRun={b.get('canRun')}"
        )
        if line != last:
            print(line, flush=True)
            last = line
        if b["calculationStatus"] in TERMINAL:
            ok = b["calculationStatus"] == "Done" and not b.get("outputErrors")
            print(json.dumps(b), flush=True)
            return 0 if ok else 1
    print(f"deadline {a.deadline}s passed, still {last}", flush=True)
    return 2


if __name__ == "__main__":
    sys.exit(main())

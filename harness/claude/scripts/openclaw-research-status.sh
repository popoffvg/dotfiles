#!/usr/bin/env bash
# Print one status line for an openclaw research: status, step, round, each question, warnings, sessions.
# Usage: openclaw-research-status.sh <research-id> [delay-seconds]
set -euo pipefail
id="${1:?usage: openclaw-research-status.sh <research-id> [delay-seconds]}"
sleep "${2:-0}"
printf '%s ' "$(date -u +%H:%M:%S)"
ssh -o ConnectTimeout=10 openclaw "python3 - '$id'" <<'EOF'
import os, sys, yaml
rid = sys.argv[1]
home = os.path.expanduser("~")
folder = f"{home}/harness/obsidian/Z-Core/15-research"
fm = None
state = f"{home}/harness/obsidian/Z-Core/_attic/research/{rid}/state.md"
if os.path.exists(state):
    fm = yaml.safe_load(open(state).read().split("\n---\n")[0][4:])
for name in [] if fm else sorted(os.listdir(folder)):
    if not name.endswith(".md"):
        continue
    text = open(f"{folder}/{name}").read()
    if not text.startswith("---\n") or f'\nid: "{rid}"\n' not in text.split("\n---\n")[0]:
        continue
    fm = yaml.safe_load(text.split("\n---\n")[0][4:])
    break
if fm is None:
    sys.exit(f"no research file has id {rid}")
qs = " ".join(
    f'{q["id"]}:{q["lookup"]}/{q["status"]}{"+ans" if q["answer"] else ""}' for q in fm["questions"]
)
sdir = f"{home}/.local/share/vault-mcp/sessions/research/{rid}"
sessions = len(os.listdir(sdir)) if os.path.isdir(sdir) else 0
print(
    f'status={fm["status"]} step={fm["step"]} round={fm["round"]} rev={fm["revision"]}'
    f' | {qs or "no questions"} | warnings={len(fm["warnings"])} sessions={sessions}'
    f' | {fm["stop_reason"]}'
)
EOF

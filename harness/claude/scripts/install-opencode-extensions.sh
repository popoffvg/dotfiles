#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1/harness/opencode/opencode.json" ]]; then
  printf 'Usage: %s DOTFILES_CHECKOUT\n' "${0##*/}" >&2
  exit 2
fi

cd "$1"
root="$PWD"
for command in mise npm bun python3 opencode; do
  command -v "$command" >/dev/null || {
    printf 'OpenCode extension install requires %s.\n' "$command" >&2
    exit 1
  }
done

mise run harness:opencode:deps
mise run harness:opencode:check
mise run harness:opencode:test
mise run harness:sync
mise run harness:check
opencode api post /api/location/reload
python3 -c '
import json
from pathlib import Path
import subprocess
import sys
import time

root = Path(sys.argv[1])
config = json.loads((root / "harness/opencode/opencode.json").read_text())
expected = [entry.replace("{{ROOT}}", str(root)) for entry in config["plugin"]]
for attempt in range(20):
    response = subprocess.check_output([
        "opencode", "api", "get", "/api/plugin",
        "-H", f"x-opencode-directory:{root}",
    ], text=True, timeout=15)
    plugins = json.loads(response)["data"]
    present = {item["source"].get("path") for item in plugins}
    if all(path in present for path in expected):
        break
    time.sleep(0.5)
for path in expected:
    matches = [item for item in plugins if item["source"].get("path") == path]
    if not matches or any(item["state"]["status"] != "active" for item in matches):
        sys.exit(f"OpenCode extension is not active: {path}\n{matches}")
    print(f"OpenCode extension is active: {path}")
for item in plugins:
    if item["source"]["type"] == "local" and item["state"]["status"] != "active":
        sys.exit(f"OpenCode local extension failed: {item}")
' "$root"

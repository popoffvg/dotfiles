#!/usr/bin/env bash
# Compatibility entry point: runtime marketplaces belong in the home directories.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec python3 "$ROOT/harness/rulesync/deploy.py" "$@"

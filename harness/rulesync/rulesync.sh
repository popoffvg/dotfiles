#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/dotfiles-rulesync"
VERSION=$(node -p "require(process.argv[1]).dependencies.rulesync" "$ROOT/harness/rulesync/package.json")
if [[ ! -f "$CACHE/node_modules/rulesync/package.json" ]] || [[ $(node -p "require(process.argv[1]).version" "$CACHE/node_modules/rulesync/package.json") != "$VERSION" ]]; then
  mkdir -p "$CACHE"
  cp "$ROOT/harness/rulesync/package.json" "$ROOT/harness/rulesync/package-lock.json" "$CACHE/"
  npm ci --prefix "$CACHE" --ignore-scripts --no-audit --no-fund
fi
exec "$CACHE/node_modules/.bin/rulesync" "$@"

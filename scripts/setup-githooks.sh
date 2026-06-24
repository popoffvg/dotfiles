#!/usr/bin/env bash
# Wire this repo's git hooks: point local core.hooksPath at .githooks/.
#
# The dotfiles repo ships hooks in .githooks/ that multiplex to the global
# hooks (via dispatch) and add a post-commit restow. A LOCAL hooksPath is
# required because the global ~/.gitconfig sets core.hooksPath and git uses
# only one hooks dir (no chaining). Other repos are unaffected.
#
# Idempotent. Run from anywhere inside the repo.
set -euo pipefail

repo_root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$repo_root"

if [ ! -d .githooks ]; then
  echo "error: .githooks/ not found in $repo_root" >&2
  exit 1
fi

chmod +x .githooks/dispatch
git config --local core.hooksPath .githooks

echo "core.hooksPath -> $(git config --local --get core.hooksPath) (local to $repo_root)"
echo "hooks: $(ls .githooks | grep -v '^dispatch$' | tr '\n' ' ')"

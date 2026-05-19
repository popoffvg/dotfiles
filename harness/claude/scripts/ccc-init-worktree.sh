#!/usr/bin/env bash
# Initialize and index ccc for all git repos in a worktree directory.
# Usage: ccc-init-worktree.sh [worktree-path]
# Defaults to current directory if no path given.

set -euo pipefail

WORKTREE="${1:-.}"
WORKTREE="$(cd "$WORKTREE" && pwd)"

echo "Scanning for repos in: $WORKTREE"

# Find directories containing .git (repos, including worktrees with .git file)
find "$WORKTREE" -maxdepth 2 \( -name ".git" \) -print | while read -r gitpath; do
    repo="$(dirname "$gitpath")"
    echo ""
    echo "--- $repo ---"
    (
        cd "$repo"
        if [ -f ".cocoindex_code/settings.yml" ]; then
            echo "Already initialized, refreshing index..."
            ccc index
        else
            echo "Initializing..."
            ccc init -f
            ccc index
        fi
    )
done

echo ""
echo "Done. All repos in $WORKTREE are indexed."

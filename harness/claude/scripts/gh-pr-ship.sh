#!/usr/bin/env bash
# Push a branch, open a PR to main (or reuse the open one), wait for CI, and rebase-merge it.
# usage: gh-pr-ship.sh <worktree> <branch> <title> <body-file> [todoist-task-id]
# The Todoist task is closed only after the merge.
set -euo pipefail
dir="$1" branch="$2" title="$3" body="$4" task="${5:-}"
cd "$dir"
# The pre-push hook builds test images; a credential helper in the default Docker config breaks that build.
if [ -n "${MINIAUTH_DOCKER_CONFIG:-}" ]; then export DOCKER_CONFIG="$MINIAUTH_DOCKER_CONFIG"; fi
git fetch -q origin main
git rebase -q origin/main
git push -q --force-with-lease -u origin "$branch"
number=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number')
if [ -z "$number" ]; then
  gh pr create --base main --head "$branch" --title "$title" --body-file "$body" >/dev/null
  number=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number')
fi
echo "PR #$number"
sleep 15
if ! gh pr checks "$number" --watch --interval 20 >/dev/null; then
  gh pr checks "$number" || true
  echo "SHIP: CI FAILED #$number"
  exit 1
fi
gh pr merge "$number" --rebase
echo "SHIP: MERGED #$number"
if [ -n "$task" ]; then td task complete "id:$task"; fi

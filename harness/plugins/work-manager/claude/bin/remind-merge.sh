#!/usr/bin/env bash
# Stop / SubagentStop hook: remind to merge a dangling impl-subtree worktree.
# An unmerged `<task-slug>/TODO-N` branch+worktree only exists while the impl-subtree flow is
# mid-TODO. When the agent stops with one still open, nudge user + agent to run
# impl-subtree Step 5 (analyze fixups → CLAUDE.local.md → squash-merge → cleanup).
set -euo pipefail

cat >/dev/null   # drain hook JSON on stdin; nothing needed from it

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[[ -z "$ROOT" ]] && exit 0

# Branches named <task-slug>/TODO-N checked out in a worktree => not yet merged
# (merge-subtree removes the worktree and deletes the branch after a clean squash-merge).
PENDING=$(git -C "$ROOT" worktree list 2>/dev/null \
  | grep -oE '\[[^]]*TODO-[0-9]+\]' | tr -d '[]' | paste -sd, - 2>/dev/null) || true

[[ -z "${PENDING:-}" ]] && exit 0

MSG="⚠ impl-subtree: unmerged worktree branch(es): ${PENDING}. Before finishing, run impl-subtree Step 5 — analyze commits + fixups, write lessons to CLAUDE.local.md (## Self-improvement), then \`git merge --squash <branch>\` and commit with the TODO's spec ## Commit message, then \`git worktree remove\` + \`git branch -D\`."

if command -v jq >/dev/null 2>&1; then
  jq -cn --arg m "$MSG" '{systemMessage:$m}'
else
  printf '{"systemMessage":%s}\n' "\"${MSG//\"/\\\"}\""
fi
exit 0

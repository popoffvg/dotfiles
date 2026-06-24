#!/usr/bin/env bash
# Stop / SubagentStop hook: remind to merge a dangling `/code tree` worktree.
# An unmerged `<task-slug>/TODO-N` branch+worktree only exists while the `/code tree` flow is
# mid-TODO. When the agent stops with one still open, nudge user + agent to run
# `/code tree merge` (analyze fixups via `/code squash` → CLAUDE.local.md → `wt merge` → cleanup).
set -euo pipefail

cat >/dev/null   # drain hook JSON on stdin; nothing needed from it

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[[ -z "$ROOT" ]] && exit 0

# Branches named <task-slug>/TODO-N checked out in a worktree => not yet merged
# (`/code tree merge` / `wt merge` removes the worktree and deletes the branch after a clean squash-merge).
PENDING=$(git -C "$ROOT" worktree list 2>/dev/null \
  | grep -oE '\[[^]]*TODO-[0-9]+\]' | tr -d '[]' | paste -sd, - 2>/dev/null) || true

[[ -z "${PENDING:-}" ]] && exit 0

MSG="⚠ /code tree: unmerged worktree branch(es): ${PENDING}. Before finishing, run \`/code tree merge\` — analyze fixups via \`/code squash\` (write lessons to CLAUDE.local.md ## Self-improvement), then \`wt merge\` (squash + rebase + ff + remove worktree) using the TODO's spec ## Commit message."

if command -v jq >/dev/null 2>&1; then
  jq -cn --arg m "$MSG" '{systemMessage:$m}'
else
  printf '{"systemMessage":%s}\n' "\"${MSG//\"/\\\"}\""
fi
exit 0

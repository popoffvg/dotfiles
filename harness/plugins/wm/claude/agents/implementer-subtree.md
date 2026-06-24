---
name: implementer-subtree
description: >
  Implements one TODO in isolated worktree.
model: sonnet
color: purple
---

# Implementer-Subtree Agent

## Source of truth

Follow the `code` skill's `tree` subcommand (`${CLAUDE_PLUGIN_ROOT}/skills/code/references/tree.md`) — it owns the full worktree procedure (`wt`-backed create + `tree merge`). The rules below are agent-level constraints.

## Contract

- Execute exactly one TODO inside a `<task-slug>/TODO-N` worktree. Never touch the main working tree.
- The actual implementation delegates to `/code impl` (via `/code tree`).
- Record planned Outcome before work, achieved Outcome after.
- Bug fixes follow red-green-refactor (`${CLAUDE_PLUGIN_ROOT}/skills/red-green-refactor/SKILL.md`): test first, then fix, then clean.

## Main repo awareness

```bash
ROOT=$(git rev-parse --show-toplevel)                                    # current tree
MAIN=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")  # main repo
```

Use `$MAIN` for `<notes-dir>/`, `.pi/work.settings.json`, `CLAUDE.local.md`. Use `$ROOT` for file ops inside the current tree.

## Commit rules

- Commit each logical chunk with `code commit` format. Spec's `## Commit` block is the primary message.
- Commit after green Autotest. Don't wait for the user — you own the commit boundary.
- Don't stage unrelated files.

## Fixup rules

- User correction → `git commit --fixup=<sha>`. Never a normal commit.
- The squashed commit message comes from the spec, never from fixup history.
- Merge is handled by `/code tree merge` (calls `/code squash` for fixup analysis, then human-guarded `wt merge`). Never merge inline.

## Hard stop

Stop and hand back when:
- 3+ edits to same file without Autotest passing.
- Task touches >5 files in a single TODO.
- 2 failed fix attempts on same error.
- Tool permission/access error.
- TODO contradicts itself or is missing critical detail.
- User says "refactor", "rethink", "change the plan" → delegate to `planner` (`code` skill).
- Merge conflict during squash-merge.

## DO NOT

- Commit a user correction as a plain commit.
- Let fixup comments reach the feature branch.
- Merge inline or unattended.
- Touch the main working tree during implementation.
- Ask questions — write a handoff via `handoff` skill instead.
- Run more than one TODO per invocation.

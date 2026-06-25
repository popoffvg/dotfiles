# code — tree

Worktree-per-TODO variant of `impl`. Isolates one TODO in its own `wt` worktree+branch so work commits freely and lands as one clean commit. Backed by the `wt` (worktrunk) CLI.

## `tree new` *(default)*

1. Create the worktree+branch: `wt new <task-slug>/TODO-N` (or the repo's `wt` create command).
2. Implement the TODO inside it — follow `references/impl.md`.
3. Commit fixups freely as work and user corrections come in (`git commit --fixup=<sha>`). No need to keep history clean here; `tree merge` collapses it.

## `tree merge`

Finish the worktree:

1. Run `squash` (`references/squash.md`) — analyze the fixups, distill lessons into `CLAUDE.local.md`.
2. `wt merge` the branch back into its parent, squash-merging into **one** commit using the spec's `## Commit` message.
3. Sync the spec if what shipped diverged (`/code revise`), then remove the worktree/branch.

## Rules

- Every history-changing or tree-removing `git`/`wt` action needs explicit user confirmation first — nothing runs unattended.
- See `worktrunk` skill for `wt` mechanics.

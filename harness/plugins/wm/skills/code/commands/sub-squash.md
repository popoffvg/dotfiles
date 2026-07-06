# code — squash

Collapse a worktree's fixup history into one clean commit, harvesting what the fixups taught. Invoked by `tree merge`; can run standalone on a branch with `--fixup` commits.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

## Steps

1. **Analyze the fixups** — list the `git commit --fixup=<sha>` commits on the branch. Each fixup records a user correction: read its diff and the commit it corrects. Ask *why* the first attempt was wrong.
2. **Distill lessons → `CLAUDE.local.md`** — when a fixup reveals a generalizable mistake (a convention missed, a wrong assumption), capture it by invoking the **`improve-claude-local`** skill (`self-improvement` plugin), which owns the `CLAUDE.local.md` format: it wraps each lesson in a `<task-relevant when="…">` block, merges duplicates, and drops stale rules. Skip one-off typos; capture only repeatable lessons.
3. **`git` squash** — squash-merge the branch as **one** commit:
   - `git rebase --autosquash` to fold fixups into their targets, or
   - `wt merge` (squash mode) when called from `tree merge`.
   Use the spec's `## Commit` block as the final message.

## Rules

- Lessons are behavioral rules ("next time do X instead of Y"), not raw facts — match the `CLAUDE.local.md` `<task-relevant>` format.

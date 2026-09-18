# code — squash

Collapse a fixup history into one clean commit, harvesting what the fixups taught. Run by hand over the worktree branch an `impl` under `where: worktree` left behind (`arch:ref-write.md` § Where the work happens), and by `auto` after each TODO's gates clear; can run standalone on any branch with `--fixup` commits.

The caller sets the scope: a worktree run squashes the whole branch, `auto` squashes only the fixups of the TODO the round just implemented, so the one-commit-per-TODO rule holds.

Obeys the shared subcommand rules — see `code:ref-subcommand-rules.md`.

## Steps

1. **Analyze the fixups** — list the `git commit --fixup=<sha>` commits in scope. Each fixup records a correction the first attempt earned — from the user under `impl`, from a gate under `auto`: read its diff and the commit it corrects. Ask *why* the first attempt was wrong.
2. **Distill lessons → a skill** — when a fixup reveals a generalizable mistake (a convention missed, a wrong assumption), capture it by invoking the **`capture-lesson`** skill (`self-improvement` plugin): it extends an existing skill whose trigger covers the lesson, or writes a new one. Skip one-off typos; capture only repeatable lessons.
3. **`git` squash** — leave **one** commit behind for the scope the caller set:
   - `git rebase --autosquash` to fold fixups into their targets — the form `auto` uses, and the standalone form, or
   - `wt merge` (squash mode) over a `where: worktree` branch, which merges it back in the same step.
   Use the spec's `## Commit` block as the final message.

## Rules

- Lessons are behavioral rules ("next time do X instead of Y"), not raw facts. `capture-lesson` owns their shape and their home — this file adds no format of its own.

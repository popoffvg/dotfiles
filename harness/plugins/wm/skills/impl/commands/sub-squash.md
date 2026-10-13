# code — squash

Fold a fixup history into the commits it fixes, harvesting what the fixups taught. A TODO keeps one commit per `### Commit` section. Run by hand over the worktree branch an `impl` under `where: worktree` left behind (`arch:ref-write.md` § Where the work happens), and by `auto` after each TODO's gates clear; can run standalone on any branch with `--fixup` commits.

The caller sets the scope: a worktree run squashes the whole branch, `auto` squashes only the fixups of the TODO the round just implemented, so each `### Commit` section of that TODO stays one commit.

Obeys the shared subcommand rules — see `code:ref-subcommand-rules.md`.

## Steps

1. **Analyze the fixups** — list the `git commit --fixup=<sha>` commits in scope. Each fixup records a correction the first attempt earned — from the user under `impl`, from a gate under `auto`: read its diff and the commit it corrects. Ask *why* the first attempt was wrong.
2. **Distill gotchas → `GOTCHAS.md`** — read `## Gotchas` of each `TODO-N.agent.md` in scope beside the fixups. When a bullet or a fixup reveals a repeatable mistake (a convention missed, a wrong assumption), follow the **`capture-gotcha`** skill: it extends the entry for that trigger in `<notes-dir>/GOTCHAS.md`, or appends a new one. A bullet only this TODO can meet stays where it is.
3. **`git` squash** — leave **one commit per `### Commit` section** behind for the scope the caller set, each with that section's **Title** and **Body**:
   - `git rebase --autosquash` folds each fixup into the commit it targets — the form `auto` uses, and the standalone form.
   - Over a `where: worktree` branch, run that rebase first, then `wt merge --no-squash`: squash mode collapses every commit of the branch into one.

## Rules

- Gotchas are behavioral rules ("next time do X instead of Y"), not raw facts. `capture-gotcha` owns their shape — this file adds no format of its own.

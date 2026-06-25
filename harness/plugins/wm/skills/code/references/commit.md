# code — commit

Commit-message conventions, shared by `impl`, `tree`, and `fix`.

## Format

```
<prefix>: <why>
```

- **prefix** — `feat`, `fix`, `refactor`, `docs`, `test`, `chore` (conventional-commits set).
- **why** — the reason/outcome, not a file list. The spec's `## Commit` block is the primary message when present.

## Rules

- Commit only after the Autotest is green.
- One commit per logical chunk — never batch unrelated changes.
- Never stage unrelated files; never commit test-only changes under `feat`/`fix`.

## Fixups — user corrections

When the user reviews and asks for a change after a commit:

1. Make the edit, re-run the Autotest.
2. `git commit --fixup=<sha-of-commit-this-corrects>`.
3. Never fold a user correction into a normal commit — the fixup trail is what `squash` reads to distill lessons.

On "looks good, squash"/"merge": interactively rebase-squash the fixups, or hand to `tree merge` if this was a `tree` worktree flow.

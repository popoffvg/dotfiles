---
name: impl
description: >
  The coding half of the wm flow — every operation that writes source or git history: execute one
  TODO increment by increment (impl), run the whole ledger unattended (auto), close a gap in the
  thought and then the code (fix), distill a fixup trail and squash-merge (squash), and the commit
  rules all three share (commit). Load it when the `code` skill routes to impl, auto, fix, squash,
  or commit, or when writing code against a TODO body. The message text itself: `commit-message`.
user-invocable: false
---

# impl — the source-editing operations

The `code` skill routes here; it holds no procedure of its own for these five. Pick the operation,
read its file in `commands/`, follow it.

Before writing any commit message, load the `commit-message` skill — the message contract is not in
this skill.

| Operation | Does | File |
|---|---|---|
| `impl` | Execute one TODO — read context, replan guard, apply each increment for user approval, autotest, commit, report. | `commands/sub-impl.md` |
| `auto` | Unattended run of the whole ledger: arm the `/goal` Stop hook → per TODO (read `LESSONS.md` → impl → `lint-tester` → `reviewer` → `tester` gates → append `LESSONS.md`) → optional deploy → verify E2E. No per-increment approval. | `commands/sub-auto.md` |
| `fix` | Close a gap (bug / missing / adjust) by fixing the thought, then the code. | `commands/sub-fix.md` |
| `squash` | Read the fixup trail → distill lessons into `CLAUDE.local.md` → squash-merge as one commit. Called by `tree merge`. | `commands/sub-squash.md` |
| `commit` | When to commit and how a correction lands (fixups) — shared by `impl`, `tree`, `fix`. The message itself: the `commit-message` skill. | `commands/sub-commit.md` |

## What these five read

They write source; they design nothing. Everything they read is owned by another skill, and this
skill restates none of it — the map is `wm:INDEX.md`.

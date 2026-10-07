---
name: option-diffs
description: Build each option of a design fork as a small diff in its own fork agent and show the diffs side by side, so the user picks one by its letter. Use when a grill or a review reaches a one-way door between two or three designs, or when the user says "build both and let me pick".
---

# option-diffs

**Show the options built, not described.** A user who reads two prose options imagines a third design and answers "No! I mean…". A diff leaves nothing to imagine.

## Steps

1. **Name the fork.** One decision, two or three options, one sentence each. Each option is a real position: one that keeps the defect the change exists to remove is filler, so delete it. Done when two or more options are left; with one left, decide it and stop.
2. **Build each option in its own fork agent**, all in one message: `subagent_type: "fork"`, `isolation: "worktree"`. Each prompt names its option and the other options it must not build. The fork builds the surface only: types, signatures, and the changed call sites, no bodies past a stub, no tests, at most 80 changed lines. It returns the worktree path and `git diff --stat`. Done when every fork returned a path, or failed with a reason you write into the block.
3. **Write one `[decide]` block in the `to-user` shape.** Detail holds each diff in a fenced `diff` block under its letter. The options table compares on "Files touched", "Lines changed", and "Callers that change". A diff past 80 lines shows its stat and the hunks that change a signature. Done when the user can pick a letter without opening a file.
4. **Hand the block over through the caller.** Inside `grilling`, the block is one of its one-way-door blocks. Alone, it goes out through `to-user` step 2.
5. **Keep the picked worktree, remove the others.** The picked diff is the start of the work, not the work: bodies and tests come after. Done when one worktree is left and the user's letter is written beside the decision.

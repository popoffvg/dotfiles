---
name: working-tree-removal-is-intent
description: Use when a test or build breaks because an uncommitted working-tree change removed a guard, condition, branch, or check, and about to re-add that code to make it pass again.
---

An uncommitted removal in the working tree is a deliberate in-progress change, not an accident to repair.

Before restoring removed code to make a stale test/build pass:

1. Run `git diff <file>` — confirm the removal was intentional working-tree state, not something you dropped.
2. Do NOT re-add the removed code. Restoring it reverts the user's edit behind their back.
3. Instead, follow the removal forward: update or delete the now-stale test/caller to match the new shape.
4. If the removal's intent is unclear (e.g. it looks like it breaks a real invariant), ask — don't silently restore.

Defensive guards for states the caller guarantees (a nil check on a value always constructed via its constructor) are exactly the kind of code a removal deliberately drops. Don't reintroduce them.

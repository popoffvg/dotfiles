---
name: work-done
description: >
  Legacy alias for work-abandon. Use work-abandon for active flows; this skill
  remains only for backward compatibility.
---

# work:done (legacy alias)

`work-done` is deprecated. Treat it as an alias to `work-abandon` to avoid naming confusion.

## Required behavior

1. Announce deprecation once: "`work-done` is deprecated; running `work-abandon` flow."
2. Immediately cancel work-manager flow (equivalent to `work_off` / `/work:abandon`).
3. Do not run context-done, memory finalization, worktree merge, or `_notes/` cleanup in this flow.
4. Confirm cancellation with a single summary line.

## Notes

- Do not introduce separate logic here; keep behavior aligned with `work-abandon`.
- If there is no active work settings file, report that clearly.

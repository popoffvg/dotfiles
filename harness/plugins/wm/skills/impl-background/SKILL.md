---
name: impl-background
description: >
  Run `/code impl` for one TODO whose `approve` key resolves to `none`, in a background fork, so the
  calling session stays free and gets a notification when the TODO is done. Load it when the `code`
  skill routes to impl and `approve` resolves to `none`.
user-invocable: false
context: fork
agent: wm:implementer
background: true
---

# impl-background — one TODO, no approvals, in the background

A background fork cannot ask the user anything. The skill args name the TODO (`impl TODO-N`); the notes-dir is the one the calling session uses.

1. **Resolve `approve`** as `impl:sub-impl.md` § Approval says. Not `none` → stop, apply nothing, and report: "impl-background: TODO-N resolves `approve: <value>`, run `/code impl` in the foreground". Done when the key is `none`; the step 9 report names the file that set it.
2. **Follow `impl:sub-impl.md` under `approve: none`**, with these changes:
   - Apply each increment yourself. You already run as `wm:implementer`; a child agent can outlive this fork.
   - Step 6 needs a new or renamed glossary term → do not write the row. Put the term and its proposed row in the step 9 report under "Needs your approval".
   - Any other point where `sub-impl.md` asks the user → set `status: blocked`, apply nothing after it (no hand-off to another skill either), and put the question in the step 9 report.

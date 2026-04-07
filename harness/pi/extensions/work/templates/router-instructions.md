## Work Manager — Phase Rules

### Plan Phase (CRITICAL)
**In plan phase, you are a PLANNER, not an executor.**
- NEVER write code, edit source files, run tests, or make changes outside `_notes/`.
- ALL user messages are plan input — requirements, refinements, priorities.
- User says "add X" → add it as a TODO, do NOT implement X.
- The plan is a TODO list (`- [ ]` checkboxes) in `_notes/plan.md`.
- You may READ source files. You may ONLY WRITE to `_notes/plan.md` and `_notes/worklog.md`.

### Implement Phase
- Execute TODOs from `_notes/plan.md` in order.
- Work directly in the current branch/repository (no worktree).
- **Each TODO = one git commit.** Before each commit: verify TODO completion, run relevant tests, re-test after fixes.{{IMPLEMENT_APPROVAL_SENTENCE}} Stage and commit in one step: `git add -A && git commit -m "..."`.
- **After each TODO: call `work_compact`** to free context and re-orient on remaining work.
- In `_notes/plan.md`, you may update TODO text/order and check off completed TODOs. Log non-checkbox plan edits to `_notes/worklog.md` with reason.
- Log implementation details as items in `_notes/worklog.md`.
- **FIX/FIXUP messages:** When user sends a message starting with FIX or FIXUP, create a `git commit --fixup=<target-sha>` for the relevant prior commit. Do not check off any TODO — resume current work after.

### Todo Phase
- Todo is ordinary chat mode within active work context.
- Execute user requests normally (not planning-only behavior).
- **NEVER run `git push`** (including force-push or tag pushes) without explicit user request.
- **Todo commit flow (MANDATORY):** After code changes: (1) run tests, (2) {{TODO_APPROVAL_SEGMENT}} **`git add -A && git commit -m "..."`**, ({{TODO_LOG_STEP_NUMBER}}) log to worklog. **You are NOT done until the commit is made.**{{TODO_APPROVAL_WARNING}}
- **Autonomy rule:** In todo phase, try to complete the request end-to-end without requiring additional user interaction.
- **Log every action** to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: [todo] <action summary>`
- Return to plan with `/work:plan`.

### Phase Transitions

Allowed transitions:
- research → plan
- plan → research (if unknowns found)
- plan → implement (via `/work:implement` command ONLY)
- implement → plan (via `/work:plan`)
- plan/implement → todo (via `/work:todo`)
- todo → plan (via `/work:plan`)
- implement → verify (LLM sets phase to "verify" when all TODOs done)
- verify → verified (user approves in verify dialog)

**Important rules:**
- plan → implement: NEVER transition manually. User must use `/work:implement`.
- plan-mode restrictions apply ONLY when current phase is `plan`.
- After all TODOs are done, LLM sets phase to "verify" and the extension shows a UI verify dialog.
- Do NOT manage the verify phase — the extension owns it.

When transitioning phases:
1. Update `.pi/work.settings.json`: set `"phase": "<new>"`
2. Append to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: Phase transition: <old> → <new>`

## Worklog Rule

After completing ANY work action, append to `_notes/worklog.md`:
```
- YYYY-MM-DD HH:MM: <action summary>
```

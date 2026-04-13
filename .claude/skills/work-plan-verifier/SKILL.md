---
name: work-plan-verifier
description: >
  This skill should be used when work-manager enters "plan-verify" phase.
  Audits _notes/plan.md quality before implementation and auto-routes to
  implement (ready) or back to plan (needs revision).
---

# work:plan-verify

You are an **auditor**. Validate plan quality before implementation starts.

## Scope

- Read-only for source code.
- You may write only under `_notes/`.
- Do **not** implement, do **not** run migrations, do **not** modify app code.

## Inputs to review

1. `_notes/plan.md` (required)
2. `_notes/worklog.md` (required)
3. `_notes/research-*.md` (if present)
4. Referenced source files from TODOs (read only, to validate feasibility)

## Verification checks (pass/fail)

### A. Plan completeness
- [ ] Plan has both **Acceptance Criteria** and **TODOs** sections
- [ ] Every TODO uses checkbox format (`- [ ]` / `- [x]`)
- [ ] Every TODO points to concrete files/areas (not vague)

### B. Execution readiness
- [ ] TODO order is executable without hidden prerequisites
- [ ] TODOs are scoped as single logical commits
- [ ] Each behavior-changing TODO has a test strategy (level/file/cases)
- [ ] Risky/destructive changes are explicit and justified

### C. Scope discipline
- [ ] TODOs align with current user goal (no unrelated expansion)
- [ ] No missing blocker TODO discovered from referenced files

## Output contract

Write `_notes/plan-verify.md`:

```markdown
# Plan Verification Report

Date: YYYY-MM-DD HH:MM
Result: READY | NEEDS REVISION

## Summary
- <1-3 bullets>

## Checks
- [PASS|FAIL] <check>

## Blocking issues
- <issue + exact TODO/AC reference>

## Required plan edits
- <specific change request>
```

Then append to `_notes/worklog.md`:
- `- YYYY-MM-DD HH:MM: Plan verification passed (auto-transition to implement)`
  or
- `- YYYY-MM-DD HH:MM: Plan verification failed (auto-transition to plan)`

## Transition behavior (work-manager active)

When work-manager is active, **do not ask a generic follow-up question**.
Decide and transition immediately:

- If **0 blocking failures** → transition to `implement`
- If **1+ blocking failures** → transition to `plan` with concise feedback

Use `work_transition` when available. If transition tool is unavailable, report exact next command (`/work:implement` or `/work:plan`) plus the blocking list.

## Decision rule

- **READY**: all blocking checks pass, no critical unknowns
- **NEEDS REVISION**: at least one blocking issue or unclear dependency

Be strict on blockers, concise on style nits.

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

1. `_notes/plan.md` (required) — index, Goal, decisions
2. `_notes/todos/TODO-N.md` (required, one per TODO in the index)
3. `_notes/worklog.md` (required)
4. `_notes/research-*.md` (if present)
5. Referenced source files from each TODO (read only, to validate feasibility)

## Verification checks (pass/fail)

### A. Plan completeness (`plan.md`)
- [ ] Has Description, Terms, Implementation Guidelines, Goal, Design Decisions, TODOs sections
- [ ] **Goal** section is plain language describing user-visible outcome — no IDs, no `AC-N`, no checkboxes
- [ ] Every TODO index entry is a checkbox `- [ ]` linking to `todos/TODO-N.md`
- [ ] No TODO body text in `plan.md` (only index lines)

### B. Per-TODO files (`todos/TODO-N.md`)
- [ ] One file exists for each TODO in the index, contiguous numbering
- [ ] Each file has: Type, Depends on, Outcome, Files, Pre-reads, Skills to load, Changes, Autotest, Manual test, Commit, Definition of done
- [ ] No `AC-` identifiers and no `Satisfies:` field in TODO files (Goal lives only in `plan.md`)
- [ ] **Files** lists concrete paths (no globs, no vague areas)
- [ ] **Changes** is a single TS pseudocode block (≤ 40 lines) matching the **Type** — see `work-plan-flow` for patterns
- [ ] **Autotest** has a runnable command and concrete cases (or `none` with one-line justification)
- [ ] **Manual test** has steps + expected (or `skip` with concrete reason)

### C. Execution readiness
- [ ] TODO order executable without hidden prerequisites (**Depends on:** is consistent)
- [ ] Each TODO is one logical commit
- [ ] Risky/destructive changes are explicit and justified

### D. Scope discipline
- [ ] TODOs align with current user goal (no unrelated expansion)
- [ ] No missing blocker TODO discovered from referenced files

### E. Test honesty (hard block)

Read **Files** for each TODO and classify its surface. If any file matches a category below, the TODO **cannot** justify `Manual test: skip` with reasons like "fully covered by unit tests", "covered by autotests", or "no manual step needed":

| Category | Match signal | Required |
|---|---|---|
| RPC / gRPC handler | server, handler, `*_grpc.pb.go`, `pb.RegisterX`, `mux.Handle`, `http.HandlerFunc` | Integration test OR manual test with concrete request/response |
| Persistence | rocksdb, sqlite, sql.DB, KV store, migration, schema | Manual test verifying state survives restart, OR integration test with real backend |
| Cross-process / IPC | gRPC client+server, message queue, pubsub, websocket | End-to-end test crossing the boundary, OR manual test from real client |
| Code generation | `.proto`, `buf.gen.yaml`, generator templates | Manual test: regenerate, build downstream, verify wire bytes |
| Concurrency primitive | new goroutine, lock, channel, atomic | `go test -race` in Autotest OR explicit justification why race impossible |
| External integration | k8s, S3, OAuth, HTTP client to third party | Manual test or recorded fixture; never "unit-tested" alone |
| UI / frontend | `.vue`, `.tsx`, `.svelte`, css | Manual test with screenshot or browser steps |

For each matching TODO, verify:
- [ ] **Manual test** is not `skip` (or, if `skip`, the justification names a specific integration/e2e test command that exercises the same boundary)
- [ ] The Autotest command actually runs against the relevant boundary (e.g., `go test ./pkg/server/...` for an RPC change, not just `go test ./pkg/types/...`)
- [ ] If the TODO claims existing tests cover the change, the verifier **reads** at least one of those test files and confirms it asserts on the changed behavior — not just on adjacent code

This is a **blocking** check. A failing E-category turns the result to NEEDS REVISION with `Required plan edits` listing exactly which TODOs need a real manual or integration step.

Banned skip-justifications (auto-fail when present in `Manual test: skip — <reason>`):
- "fully covered by unit tests" / "covered by autotests" / "covered by tests"
- "no manual step needed" / "trivial change"
- "covered by existing tests" (without naming the specific test file + test name)

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
- <issue + exact TODO reference>

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

# spec — verify

Adversarial spec audit before implementation. Runs in a **separate `spec-verifier` agent** (sonnet, read-only, no Write tool) — a fresh context that did not write the spec, so it reads it as an outsider would.

## Execution — two phases

Phase 0 is cheap and inline; it gates the expensive Phase 1 fan-out. Pass the real `<notes-dir>`.

### Phase 0 — static gate (inline, no agent)

The caller runs the checkbox checks in **Verification checks A–F** directly — text/field inspection over `spec.md` + `todos/*.md`, no adversarial reasoning. Grep the fields; read only the TODO `Files` *lists* (not their source) for F's field-presence part.

If **any** A–F check fails → write the report with `Result: NEEDS REVISION` listing the failures, and **stop**. Do not spawn agents — no point paying one to notice an empty field.

If all pass → proceed to Phase 1.

### Phase 1 — adversarial hunt (parallel agents)

Fan out **one `spec-verifier` agent per TODO** plus one cross-TODO agent. Send them in a single message so they run concurrently — wall-clock = slowest single TODO, not the sum.

Per-TODO (one per `todos/TODO-N.md`):
```
Agent(subagent_type="wm:spec-verifier", prompt=
  "[VERIFY TODO-N] Hunt contradictions / missing-parts / edge-cases in <notes-dir>/todos/TODO-N.md.
   Read only that TODO + its Files (source). Follow ${CLAUDE_PLUGIN_ROOT}/skills/code/SKILL.md
   → references/verify.md 'Mission'. Return findings as your final message.")
```

Cross-TODO (one agent, reads `spec.md` + each TODO's **index line + Outcome + Depends on** only — not full bodies):
```
Agent(subagent_type="wm:spec-verifier", prompt=
  "[VERIFY CROSS] Read <notes-dir>/spec.md + every todos/TODO-N.md index line, Outcome, Depends on.
   Hunt global contradictions and `Depends on` cycles across TODOs. Follow …/references/verify.md 'Mission'.
   Return findings as your final message.")
```

The agents have no Write tool: they **return** findings. The caller merges the returned findings + the Phase 0 checkbox results into the Output-contract report, writes it to `<notes-dir>/spec-verify.md`, and records the verdict with `jj commit` in `<notes-dir>`.

## Mission — hunt three failure modes (Phase 1)

Run per-TODO in parallel — see Execution. The point of the audit is not to tick boxes. It is to find what breaks the spec before code does:

1. **Contradictions** — two TODOs, or a TODO and a Decision/Term/Goal, that cannot both hold. Conflicting interface signatures, a Term used two ways, a `Depends on` cycle, an Outcome that undoes an earlier Outcome, a Decision the TODOs violate.
2. **Missing parts** — work the Goal implies but no TODO covers. Error/failure paths, teardown for every setup, a caller left unmigrated after a signature change, auth/validation on a new boundary, a persistence write with no read (or vice versa), config/flags referenced but never defined.
3. **Edge cases** — inputs and states the Outcomes ignore. Empty/nil/zero, concurrent access, retry/idempotency, partial failure, boundary limits (TTL, size, count), first-run vs steady-state, ordering.

For each finding: name the exact TODO/section, state the concrete scenario that fails, and say what edit closes it. A finding without a reproducing scenario is a style nit, not a blocker.

## Scope

- Read-only. The agent has no Write tool — return the report, do not write files.
- Do **not** implement, run migrations, or modify app code.

## Inputs to review

1. `.notes/spec.md` (required) — index, Goal, decisions
2. `.notes/todos/TODO-N.md` (required, one per TODO in the index)
3. `.notes/research-*.md` (if present)
4. Referenced source files from each TODO (read only, to validate feasibility)

## Verification checks (pass/fail) — Phase 0

The floor beneath the mission — a spec that fails these is unfinished regardless of what the hunt found. Run them **inline before spawning any agent** (Phase 0); a failure short-circuits to NEEDS REVISION. The findings above are what make the Phase 1 fan-out worth spawning.

### A. Spec completeness (`spec.md`)
- [ ] Has Description, Implementation Guidelines, Goal, What we're NOT doing, Design Decisions, Open Questions, TODOs sections
- [ ] `GLOSSARY.md` exists (sibling of spec.md), covers every entity/command/event used in the spec, and is current
- [ ] **Goal** section is plain language describing user-visible outcome — no IDs, no `AC-N`, no checkboxes
- [ ] **What we're NOT doing** is present and non-empty (explicit out-of-scope list)
- [ ] **Open Questions is empty (hard block).** Any unchecked `- [ ]` question → result is NEEDS REVISION; route to `new` to resolve before READY
- [ ] Every TODO index entry is a checkbox `- [ ]` linking to `todos/TODO-N.md`
- [ ] No TODO body text in `spec.md` (only index lines)

### B. Per-TODO files (`todos/TODO-N.md`)
- [ ] One file exists for each TODO in the index, contiguous numbering
- [ ] Each file has: Type, Depends on, Risk / blast radius, Outcome, Files, Pre-reads, Skills to load, Changes, Autotest, Manual test, Commit, Definition of done
- [ ] **Risk / blast radius** is 1–5 with a one-line justification; score ≥ 3 → Autotest/Manual test covers the callers, not just the new code
- [ ] No `AC-` identifiers and no `Satisfies:` field in TODO files (Goal lives only in `spec.md`)
- [ ] **Files** lists concrete paths (no globs, no vague areas)
- [ ] **Changes** is a single TS pseudocode block (≤ 40 lines) matching the **Type** — see `flow` for patterns
- [ ] **Autotest** has a runnable command and concrete cases (or `none` with one-line justification)
- [ ] **Manual test** has steps + expected (or `skip` with concrete reason)

### C. Execution readiness
- [ ] TODO order executable without hidden prerequisites (**Depends on:** is consistent)
- [ ] Each TODO is one logical commit
- [ ] Risky/destructive changes are explicit and justified

### D. Scope discipline
- [ ] TODOs align with current user goal (no unrelated expansion)
- [ ] No missing blocker TODO discovered from referenced files

### E. Test suite filled (hard block)

Every TODO's **Autotest** must be filled — not an empty field, `TBD`, `...`, or a bare header. Filled means one of:
- A runnable command **plus** ≥1 concrete case (input → expected), or
- The literal `none` with a one-line justification.

An empty, placeholder, or command-without-cases Autotest → **NEEDS REVISION**, listing each unfilled TODO. Same for **Manual test**: must be filled steps+expected or `skip — <concrete reason>`.

### F. Test honesty (hard block)

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

This is a **blocking** check. A failing F-category turns the result to NEEDS REVISION with `Required spec edits` listing exactly which TODOs need a real manual or integration step.

Banned skip-justifications (auto-fail when present in `Manual test: skip — <reason>`):
- "fully covered by unit tests" / "covered by autotests" / "covered by tests"
- "no manual step needed" / "trivial change"
- "covered by existing tests" (without naming the specific test file + test name)

## Output contract

Return this report as the final message (the caller persists it to `.notes/spec-verify.md`):

```markdown
# Spec Verification Report

Date: YYYY-MM-DD HH:MM
Result: READY | NEEDS REVISION

## Summary
- <1-3 bullets>

## Contradictions
- <TODO/section pair + the scenario where both cannot hold + the edit that resolves it>

## Missing parts
- <what the Goal implies + which TODO should cover it + the edit that adds it>

## Edge cases
- <the ignored input/state + the TODO whose Outcome must handle it + how>

## Checks
- [PASS|FAIL] <check>

## Blocking issues
- <issue + exact TODO reference>

## Required spec edits
- <specific change request>
```

The caller (the agent has no Write tool) then runs, in `<notes-dir>`:
- `jj commit -m "Spec verification passed (auto-transition to implement)"`
  or
- `jj commit -m "Spec verification failed (auto-transition to spec)"`

## Transition behavior (wm active)

Handled by the caller after the agent returns — **do not ask a generic follow-up question**.
Decide and transition immediately:

- If **0 blocking failures** → transition to `impl`
- If **1+ blocking failures** → transition to `spec` with concise feedback

Use `work_transition` when available. If transition tool is unavailable, report exact next command (`/work:implement` or `/work:spec`) plus the blocking list.

## Decision rule

- **READY**: all blocking checks pass, no critical unknowns
- **NEEDS REVISION**: at least one blocking issue or unclear dependency

Be strict on blockers, concise on style nits.

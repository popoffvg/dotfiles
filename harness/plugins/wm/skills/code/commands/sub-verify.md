# code — verify (the audit)

Adversarial spec **audit** before impl, in a separate read-only `spec-verifier` agent (no Write
tool) that did not write the spec — it reads it as an outsider. Vocabulary: `../GLOSSARY.md`.
Readiness criteria: `ref-write.md`. TODO elements: `sub-todo.md`.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

## Execution — two phases

Phase 0 is cheap and inline; it gates the expensive Phase 1 fan-out. Pass the real `<notes-dir>`.

### Phase 0 — static gate (inline, no agent)

The caller runs the pass/fail checks (below) directly — field inspection over `spec.md` +
`todos/*.md`, no adversarial reasoning. Any fail → write the report `Result: NEEDS REVISION`
listing the failures and **stop**. No point paying an agent to notice an empty field.

### Phase 1 — adversarial hunt (parallel agents)

All pass → fan out **one `spec-verifier` per TODO** plus one cross-TODO agent, in a single message (wall-clock = slowest TODO, not the sum).

Per-TODO:
```
Agent(subagent_type="wm:spec-verifier", prompt=
  "[VERIFY TODO-N] Hunt contradictions / missing-parts / edge-cases in <notes-dir>/todos/TODO-N.md.
   Read only that TODO + its Files (source). Follow ${CLAUDE_PLUGIN_ROOT}/skills/code/commands/sub-verify.md § Mission.
   Return findings as your final message.")
```

Cross-TODO (reads `spec.md` + each TODO's ledger row + Outcome + Depends on — not full bodies):
```
Agent(subagent_type="wm:spec-verifier", prompt=
  "[VERIFY CROSS] Read <notes-dir>/spec.md + every TODO's row, Outcome, Depends on.
   Hunt global contradictions and Depends-on cycles. Follow …/verify.md § Mission. Return findings.")
```

The agents have no Write tool — they **return** findings. The caller merges returned findings + Phase 0 results into the report and writes `<notes-dir>/spec-verify.md`.

## Mission — hunt three failure modes (Phase 1)

Find what breaks the spec before code does:

1. **Contradictions** — two TODOs, or a TODO and a Decision/Term/Goal, that can't both hold: conflicting signatures, a term used two ways, a `Depends on` cycle, an outcome that undoes an earlier one, a Decision the TODOs violate.
2. **Missing parts** — work the Goal implies but no TODO covers: error paths, teardown for every setup, a caller left unmigrated after a signature change, auth/validation on a new boundary, a persistence write with no read, config referenced but never defined.
3. **Edge cases** — inputs and states the outcomes ignore: empty/nil/zero, concurrent access, retry/idempotency, partial failure, boundary limits (TTL, size, count), first-run vs steady-state, ordering.

Each finding names the exact TODO/section, states the concrete scenario that fails, and the edit that closes it. A finding without a reproducing scenario is a nit, not a blocker.

## Phase 0 checks (pass/fail)

The floor beneath the mission — a spec that fails these is unfinished regardless of the hunt.

### A. Spec readiness
Run `ref-write.md` § Spec-Readiness Checklist against `spec.md` + `GLOSSARY.md`. **Open Questions non-empty → NEEDS REVISION** (hard block; route to `new`). This covers spec sections, the ledger shape, outcome rules, and GLOSSARY.md currency in one place.

### B. Per-TODO completeness
One `todos/TODO-N.md` per ledger row, contiguous. Each has every `always` element in order (`sub-todo.md` § Required elements). Spot-check: **Risk / blast radius** 1–5 with a justification (score ≥ 3 → tests cover callers); **Files** concrete paths, no globs; **Changes** one TS block ≤ 40 lines matching the Type; **Thoughts** links resolve.

### C. Execution readiness
`Depends on` consistent and acyclic; each TODO one logical commit; destructive changes explicit and justified.

### D. Scope discipline
TODOs align with the current Goal — no unrelated expansion; no missing blocker TODO surfaced by referenced files.

### E. Test suite filled (hard block)
Every **Autotest** is filled — a runnable command **plus** ≥1 concrete case (input → expected), or literal `none` with a one-line justification. Empty, `TBD`, `...`, or command-without-cases → NEEDS REVISION, listing each unfilled TODO. Same for **Manual test**: filled steps+expected, or `skip — <concrete reason>`.

### F. Test honesty (hard block)
Read **Files** per TODO and classify its surface. A file matching a category below **cannot** justify `Manual test: skip` with "covered by unit tests" or similar:

| Category | Match signal | Required |
|---|---|---|
| RPC / gRPC handler | server, handler, `*_grpc.pb.go`, `pb.RegisterX`, `mux.Handle`, `http.HandlerFunc` | integration test OR manual test with concrete request/response |
| Persistence | rocksdb, sqlite, sql.DB, KV store, migration, schema | manual test verifying state survives restart, OR integration test with real backend |
| Cross-process / IPC | gRPC client+server, message queue, pubsub, websocket | e2e test crossing the boundary, OR manual test from a real client |
| Code generation | `.proto`, `buf.gen.yaml`, generator templates | manual test: regenerate, build downstream, verify wire bytes |
| Concurrency primitive | new goroutine, lock, channel, atomic | `go test -race` OR explicit justification why a race is impossible |
| External integration | k8s, S3, OAuth, HTTP client to third party | manual test or recorded fixture — never "unit-tested" alone |
| UI / frontend | `.vue`, `.tsx`, `.svelte`, css | manual test with screenshot or browser steps |

For each matching TODO: **Manual test** is not `skip` (or the skip names a specific integration/e2e command exercising the same boundary); the Autotest command runs against the relevant boundary (`go test ./pkg/server/...` for an RPC change, not `./pkg/types/...`); if the TODO claims existing tests cover it, the verifier **reads** one of those test files and confirms it asserts on the changed behavior.

Auto-fail skip-justifications: "fully covered by unit tests" / "covered by autotests" / "covered by tests" / "no manual step needed" / "trivial change" / "covered by existing tests" (without naming the test file + name). A failing F turns the result to NEEDS REVISION with `Required spec edits` naming which TODOs need a real manual or integration step.

## Output contract

Return this report as the final message (the caller persists it to `<notes-dir>/spec-verify.md`):

```markdown
# Spec Verification Report

Date: YYYY-MM-DD HH:MM
Result: READY | NEEDS REVISION

## Summary
- <1-3 bullets>

## Contradictions
- <TODO/section pair + the scenario where both can't hold + the resolving edit>

## Missing parts
- <what the Goal implies + which TODO should cover it + the edit>

## Edge cases
- <the ignored input/state + the TODO whose Outcome must handle it + how>

## Checks
- [PASS|FAIL] <check>

## Required spec edits
- <specific change request>
```

## Verdict + transition (caller, after the agents return)

Decide and transition immediately — no generic follow-up question.

- **READY** — all blocking checks pass, no critical unknowns → transition `Status` to `impl`. `jj commit -m "Spec verification passed"` in `<notes-dir>`.
- **NEEDS REVISION** — ≥1 blocking issue or unclear dependency → stay at `review` with concise feedback. `jj commit -m "Spec verification failed"`.

Use `work_transition` if available; else report the next command (`/work:implement` or `/work:spec`) plus the blocking list. Strict on blockers, concise on style nits.

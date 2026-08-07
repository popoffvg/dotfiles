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

**Every verify agent runs on sonnet.** Pass `model="sonnet"` on each call — never opus, never haiku, never the caller's model. Sonnet is also the `spec-verifier` frontmatter default; the explicit argument keeps the pin if that default moves.

Per-TODO:
```
Agent(subagent_type="wm:spec-verifier", model="sonnet", prompt=
  "[VERIFY TODO-N] Hunt contradictions / missing-parts / edge-cases in <notes-dir>/todos/TODO-N.md.
   Read only that TODO + its Files (source). Follow ${CLAUDE_PLUGIN_ROOT}/skills/code/commands/sub-verify.md § Mission.
   Run the claim pass first and return the claim table with your findings.")
```

Cross-TODO — the contradiction agent. It reads `spec.md`, the Decisions in `thoughts/`, and from **every** TODO: the ledger row, Outcome, Depends on, `## Files`, and the signatures in `## Changes`. Headers alone hide the conflicts: two TODOs give one function two signatures inside their diffs, not in their outcomes.
```
Agent(subagent_type="wm:spec-verifier", model="sonnet", prompt=
  "[VERIFY CROSS] Read <notes-dir>/spec.md, thoughts/ decisions, and every TODO's row, Outcome,
   Depends on, Files, and the signatures in its Changes diffs.
   Run the claim pass over the whole set — pairwise, not per-TODO. Report every collision plus
   Depends-on cycles. Follow ${CLAUDE_PLUGIN_ROOT}/skills/code/commands/sub-verify.md § Mission.
   Return the claim table with your findings.")
```

The agents have no Write tool — they **return** findings. The caller merges returned findings + Phase 0 results into the report and writes `<notes-dir>/spec-verify.md`.

## Mission — hunt three failure modes (Phase 1)

Find what breaks the spec before code does. **Contradictions come first** — they are the only failure mode that makes two correct implementations impossible at once, so the claim pass below runs before any missing-part or edge-case reading.

### 1. Contradictions — run the claim pass

Do not scan for contradictions by reading and hoping. Extract, then collide.

**Step 1 — extract claims.** Read the TODO (per-TODO agent) or the whole set (cross agent) and write one row per claim. A claim is any statement the implementation must honour:

| Kind | Where it hides | Example claim |
|---|---|---|
| Signature | `## Changes` diffs, **Behavior** TS block | `loadSpec(dir: string): Spec` |
| Term meaning | Outcome, Constraints, GLOSSARY row | `"wave" = a set of TODOs with no shared Files` |
| File ownership | `## Files`, increment **Files** | `TODO-3 rewrites src/gate.ts` |
| Order | `Depends on`, wave table, increment `n` | `TODO-5 lands after TODO-2` |
| State transition | Outcome, **Blast radius** | `status moves review → impl` |
| Decision | `thoughts/` decision notes, Constraints | `no new dependency in the plugin dir` |

**Step 2 — collide pairwise.** Compare every claim against every other claim of the same kind. A collision is two claims that cannot both hold:

- same symbol, two signatures (or one call site passing the other TODO's arity)
- same term, two meanings — the sharpest signal that the spec was written in two sittings
- same file owned by two TODOs in one wave
- an order claim whose edge reverses another, or closes a `Depends on` cycle
- a state transition whose start state an earlier Outcome already consumed
- a Decision that a TODO's diff violates

**Step 3 — report the collision, not the suspicion.** Each contradiction names both sides with `TODO-N § section` and quotes the two conflicting lines verbatim. Then state which one the rest of the spec supports, and the edit to the loser.

**Step 4 — report the pass itself.** The `## Contradictions` section is never left blank. With no collision, write `none — N claims extracted, M pairs checked` so the reader can tell a clean spec from a skipped hunt.

### 2. Missing parts

Work the Goal implies but no TODO covers: error paths, teardown for every setup, a caller left unmigrated after a signature change, auth/validation on a new boundary, a persistence write with no read, config referenced but never defined.

### 3. Edge cases

Inputs and states the outcomes ignore: empty/nil/zero, concurrent access, retry/idempotency, partial failure, boundary limits (TTL, size, count), first-run vs steady-state, ordering.

Each finding names the exact TODO/section, states the concrete scenario that fails, and the edit that closes it. A finding without a reproducing scenario is a nit, not a blocker.

## Phase 0 checks (pass/fail)

The floor beneath the mission — a spec that fails these is unfinished regardless of the hunt.

### A. Spec readiness
Run `ref-write.md` § Spec-Readiness Checklist against `spec.md` + `GLOSSARY.md` + `thoughts/`. **Any `status: open` question note → NEEDS REVISION** (hard block; route to `new`) — check with `~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts`. Also a hard block: a `Design Decisions` or `Open Questions` section surviving in `spec.md`, or a decision-trail table in `## Plan` — decisions belong to `thoughts/` alone. This covers spec sections, the ledger shape, outcome rules, and GLOSSARY.md currency in one place.

### B. Per-TODO completeness
One `todos/TODO-N.md` per ledger row, contiguous. Each has every `always` element in order (`sub-todo.md` § Required elements). Spot-check: **Risk / blast radius** 1–5 with a justification (score ≥ 3 → tests cover callers); **Files** concrete paths, no globs; **Thoughts** links resolve and each has a **Constraints** row.

**Changes — the increment sequence.** `n` contiguous from 1, ≤ 10 increments, each naming one **Components** row. Every increment carries **Files** (a subset of `## Files`), a **Blast radius**, and a ```diff of ≤ 25 changed lines. A **Blast radius** that names no symbol or caller (`"low"`, `"minimal"`, `"none"` on a non-additive increment) → NEEDS REVISION: an unpredicted blast radius is what the increment review exists to catch. Order must be deepest-first — a caller migrated before its callee, without a `builds: only with increment <n>` marker, is a finding. Any **Behavior** snippet: one TS block ≤ 40 lines matching the Type.

**Self-containment (hard block).** Read one TODO with `spec.md` and `thoughts/` closed. If a constraint it obeys, a term it uses, or a test expectation is knowable only from those files, → NEEDS REVISION naming the missing restatement.

### B2. Wave plan
`## Plan` has the wave table; every ledger row appears in exactly one wave; no two TODOs in one wave share a **Files** path or a `depends_on` edge; every `depends_on` is a real edge per `ref-write.md` § Waves. A chain where each wave holds one TODO → report it as a finding (serialized spec) with the edges that look false.

### C. Execution readiness
`Depends on` consistent and acyclic; each TODO one logical commit; destructive changes explicit and justified.

### D. Scope discipline
TODOs align with the current Goal — no unrelated expansion; no missing blocker TODO surfaced by referenced files.

### E. Test suite filled — both levels (hard block)
Every TODO's **Autotest** carries a `Unit` **and** an `E2E` sub-block, each with a runnable command **plus** ≥1 concrete case (input → expected). Empty, `TBD`, `...`, a missing level, or command-without-cases → NEEDS REVISION, listing each unfilled TODO and level.

`none` is accepted only with a concrete reason: for `Unit`, a non-behavioral change; for `E2E`, either a stated no-observable-behavior refactor or a named TODO whose e2e case covers this path (the named TODO must exist and its E2E cases must mention it). Auto-reject reasons: "covered by the unit test", "trivial", "no e2e harness" (name the missing harness — that is its own TODO), "will add later".

Same for **Manual test**: filled steps+expected, or `skip — <concrete reason>`.

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
Claim pass: <N> claims extracted, <M> pairs checked.
- <TODO-A § section vs TODO-B § section — the two quoted lines + which side the spec supports + the edit to the loser>

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

- **READY** — all blocking checks pass, no critical unknowns → transition the spec frontmatter `status` to `impl`. `jj commit -m "Spec verification passed"` in `<notes-dir>`.
- **NEEDS REVISION** — ≥1 blocking issue or unclear dependency → stay at `review` with concise feedback. `jj commit -m "Spec verification failed"`. **Any collision from the claim pass is blocking** — two live claims mean the implementer must guess, and a guess is not a spec.

Use `work_transition` if available; else report the next command (`/work:implement` or `/work:spec`) plus the blocking list. Strict on blockers, concise on style nits.

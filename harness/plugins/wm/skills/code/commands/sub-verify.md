# code — verify (the audit)

Adversarial spec **audit** before impl, in a separate read-only `spec-verifier` agent (no Write
tool) that did not write the spec — it reads it as an outsider. Vocabulary: `wm:GLOSSARY.md`.
Readiness criteria: `arch:ref-write.md`. TODO elements: `arch:sub-todo.md`.

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
  "[VERIFY TODO-N] Hunt contradictions / missing-parts / edge-cases in the <notes-dir>/todos/TODO-N.md
   + TODO-N.agent.md pair. Read only those two + <notes-dir>/CONSTRAINTS.md + the pair's Files (source). Follow ${CLAUDE_PLUGIN_ROOT}/skills/code/commands/sub-verify.md § Mission.
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
| Term meaning | Outcome, CONSTRAINTS.md, GLOSSARY row | `"wave" = a set of TODOs with no shared Files` |
| File ownership | `## Files`, increment **Files** | `TODO-3 rewrites src/gate.ts` |
| Order | `Depends on`, wave table, increment `n` | `TODO-5 lands after TODO-2` |
| State transition | Outcome, **Blast radius** | `status moves review → impl` |
| Decision | `thoughts/` decision notes, CONSTRAINTS.md | `no new dependency in the plugin dir` |

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
Run `arch:ref-write.md` § Spec-Readiness Checklist against `spec.md` + `GLOSSARY.md` + `thoughts/`. **Any `status: open` question note → NEEDS REVISION** (hard block; route to `new`) — check with `~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts`. Also a hard block: a `Design Decisions` or `Open Questions` section surviving in `spec.md`, or a decision-trail table in `## Plan` — decisions belong to `thoughts/` alone. Same for an `Implementation Guidelines` section or any pattern content in `spec.md` — patterns belong to `PATTERNS.md`, which the spec only mentions. This covers spec sections, the ledger shape, outcome rules, and GLOSSARY.md currency in one place.

### B. Per-TODO completeness
Two files per ledger row, contiguous: `todos/TODO-N.md` (the human half) and `todos/TODO-N.agent.md` (the agent half). A row missing either is a finding — the human half alone is unimplementable, the agent half alone is work nobody approved. Each file has every `always` element in order (`arch:sub-todo.md` § Required elements), and **nothing belonging to the other**: a `## Changes` in the human half, a `## Surface` or `## Commit` in the agent half, or **any ```diff outside the human half**, means the split was never made.

Spot-check the human half: **risk** 1–5 with a justification (score ≥ 3 → tests cover callers); `## Components` has exactly one `main`; `## Surface` covers every Components symbol and no others, one ```diff per file, ≤ 150 changed lines each or a declared **Compile floor**. Spot-check the agent half: **Files** concrete paths, no globs; `## Constraints` is the fixed pointer line at `CONSTRAINTS.md` and carries no rule text, no id list, and no table.

**The rules file.** `CONSTRAINTS.md` holds every settled decision an increment can violate, one row each, and no TODO holds one. Every row carries an `R<n>` id (contiguous, never renumbered), the rule alone, and an `Origin` that resolves: a `[[NNN-type-slug]]` to a **live** note in `thoughts/`, or a document with a section and a `read <YYYY-MM-DD>` date. **A note that resolves only under `thoughts/archived/` is a hard block** — the decision was superseded while the corpus still obeys it, so the pairs built on it may be wrong; route to `revise`. A rule no increment in any TODO can violate is a finding in the other direction: it is a fact, and it belongs in `thoughts/`. `python3 <plugin>/bin/budget-check.py <notes-dir>/CONSTRAINTS.md` reports the mechanical half of this; whether a rule still binds anything is the audit's.

**Changes — the increment sequence** (agent half). `n` contiguous from 1, ≤ 10 increments, each naming one row of the human half's **Components** table, and every row there named by at least one increment. Every increment carries **Files** (a subset of `## Files`), a **Surface** bullet naming the symbols it lands (or `none`), a **Do** of one to four imperative sentences, and a **Blast radius** — and **no diff**, per `arch:sub-todo.md` § Changes. Two findings live here: a **Do** carrying code or a pasted signature (the signature belongs to § Surface alone), and a signature that changes in § Surface whose call sites appear in no increment's **Do** — the second is a caller that will be left broken, and § Surface cannot show it. A **Blast radius** that names no symbol or caller (`"low"`, `"minimal"`, `"none"` on a non-additive increment) → NEEDS REVISION: an unpredicted blast radius is what the increment review exists to catch. Order must be deepest-first — a caller migrated before its callee, without a `builds: only with increment <n>` marker, is a finding. Any **Behavior** snippet: one TS block ≤ 40 lines matching the Type.

**A body in the `## Surface` diff is a finding, and one of the most common.** Read every ```diff for content that *is* the implementation rather than the surface a caller sees: a function body, a loop or branch chain, a shell script, a SQL query, a regex, a fixture, a table of literal expected values, a test file's assertions. Each one is a NEEDS REVISION with the same edit — delete the body, keep the signature, move the logic into the increment's **Behavior** sketch, and use a plain contract block if the file has no surface at all (`arch:sub-todo.md` § A diff carries the surface, not a body). **The one legal body is one the human asked for**, and it carries a `**Body requested:**` bullet naming the symbol; a body without that marker is a finding no matter how reasonable it looks. Check `## Autotest` in the human half the same way: its Cases are sentences, never test source. This is a judgment the `budget-check` hook cannot make, which is why the audit owns it.

**Self-containment (hard block).** Read one TODO with `spec.md` and `thoughts/` closed, `CONSTRAINTS.md` open. If a term it uses or a test expectation is knowable only from the closed files, → NEEDS REVISION naming the missing restatement.

**Over-statement (hard block, the same gate in reverse).** The gate cuts both ways — it may only ever push text *in* if it can also push text *out*, or every pass grows the file. → NEEDS REVISION when a rule was copied out of `CONSTRAINTS.md` into a TODO, when spec Description/Goal/target-picture prose was copied into the human half, when `## Surface` carries a symbol no Components row claims, or when that half exceeds 550 lines (name the cut, not the passage to compress — and never a move into the agent half, which has no line budget to absorb it). Get every budget count in one call: `python3 <plugin>/bin/budget-check.py <file>` — exit 1 lists each overrun with its split (`arch:sub-todo.md` § Budget).

### B2. Wave plan
`## Plan` has the wave table; every ledger row appears in exactly one wave; no two TODOs in one wave share a **Files** path or a `depends_on` edge; every `depends_on` is a real edge per `arch:ref-write.md` § Waves. A chain where each wave holds one TODO → report it as a finding (serialized spec) with the edges that look false.

### C. Execution readiness
`Depends on` consistent and acyclic; each TODO one logical commit; destructive changes explicit and justified.

### D. Scope discipline
TODOs align with the current Goal — no unrelated expansion; no missing blocker TODO surfaced by referenced files.

### E. Test suite filled — both levels (hard block)
Every TODO's **Autotest** carries a `Unit` **and** an `E2E` sub-block, each with a runnable command **plus** ≥1 concrete case (input → expected). Empty, `TBD`, `...`, a missing level, or command-without-cases → NEEDS REVISION, listing each unfilled TODO and level.

`none` is accepted only with a concrete reason: for `Unit`, a non-behavioral change; for `E2E`, either a stated no-observable-behavior refactor or a deferral meeting every condition in `arch:sub-todo.md` § Autotest — check them there rather than from memory, and reject the deferral if any one fails. Auto-reject reasons: "covered by the unit test", "trivial", "no e2e harness" (name the missing harness — that is its own TODO), "will add later".

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

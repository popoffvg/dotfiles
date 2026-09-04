# code — verify (the audit)

Adversarial spec **audit** before impl, in a separate read-only `spec-verifier` agent (no Write
tool) that did not write the spec — it reads it as an outsider. Vocabulary: `wm:GLOSSARY.md`.
Readiness criteria: `arch:ref-write.md`. TODO elements: `arch:sub-todo.md`.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

## Execution — three phases

Phase 0 is a script and gates the expensive Phase 1 fan-out; Phase 2 judges the names the corpus
declares, once the round has returned. Pass the real `<notes-dir>`.

### Phase 0 — static gate (one call, no agent)

```
${CLAUDE_PLUGIN_ROOT}/bin/spec-lint.py <notes-dir>
```

One call, about a second. It parses `spec.md` and both halves of every ledger row and prints every
countable check with its verdict — the budgets (it runs `budget-sweep.sh` itself), the frontmatter
ranges, the section sets and their order, the Components table, the increment sequence, both
Autotest levels, the wave plan, the rule set, the open questions. **Exit 1 → write the report
`Result: NEEDS REVISION` with the findings under `## Checks` and stop.** No agent is paid to notice
an empty field, and no driver reads the corpus to count what a parser counts.

Take the remedy each finding names — never a raised budget, never a loosened check. `--json` gives
the same rows for a caller that merges them into a larger report.

**A green line is evidence the check ran.** The script prints every check, passed or failed, so a
missing id means a missing check rather than a clean corpus.

### Phase 1 — adversarial hunt (parallel agents)

All pass → fan out **one `spec-verifier` per TODO** plus one cross-TODO agent, in a single message (wall-clock = slowest TODO, not the sum).

**Every verify agent runs on sonnet.** Pass `model="sonnet"` on each call — never opus, never haiku, never the caller's model. Sonnet is also the `spec-verifier` frontmatter default; the explicit argument keeps the pin if that default moves.

Per-TODO:
```
Agent(subagent_type="wm:spec-verifier", model="sonnet", prompt=
  "[VERIFY TODO-N] Hunt contradictions / missing-parts / edge-cases in the <notes-dir>/todos/TODO-N.md
   + TODO-N.agent.md pair. Read only those two + the rules `~/.claude/scripts/wm-constraints.py
   <notes-dir>/thoughts --todo TODO-N` prints + the pair's Files (source). Follow ${CLAUDE_PLUGIN_ROOT}/skills/code/commands/sub-verify.md
   § Mission and § What the script cannot judge — the countable checks already ran, so report none of them.
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

### Phase 2 — the naming pass (after the round returns)

Every round ends with one naming review over the names this spec **mints**, before `status` moves to
`impl`. A name fixed here is one edit in a table; the same name fixed after the code lands is a
rename across every file that carries it.

**Only the new names are in scope.** A term `GLOSSARY.md` marks `existing` names something the code
already calls that, and renaming it is a refactor with its own TODO — not a finding against this
spec. The gate reads the `Status` column and judges the `new` rows alone
(`arch:examples/glossary.md` § Status). A spec whose glossary has no `Status` column is not ready
for this phase: fill the column first, or every existing name is re-litigated every round.

Run the mechanical half first — it is a second and it hands the agent its list:

```
${CLAUDE_PLUGIN_ROOT}/bin/term-variants.py <notes-dir>/todos/*.md <notes-dir>/spec.md
```

Exit 1 means one concept is spelled two ways (`idpId` beside `IdPID`). Each group is a finding: pick
the spelling `GLOSSARY.md` carries, and fix the others.

Then the judgment half, one agent over the whole corpus:

```
Agent(subagent_type="wm:name-critic", model="haiku", prompt=
  "[NAME spec] Judge the names <notes-dir> MINTS, not a diff. In scope: every `## New terms` row,
   every `## Components` symbol whose Touch is `create`, and every symbol a `## Surface` diff adds,
   across all TODO pairs. Out of scope, silently: every term GLOSSARY.md marks `Status: existing`,
   and every symbol the code already carries — the diff modifies it, it does not name it.
   GLOSSARY.md is the domain vocabulary; a new name that contradicts a row there is a Failure.
   Also judge these term-variants groups, where the existing spelling wins: <term-variants.py output>.
   report: <notes-dir>/review/spec/name.md")
```

A Failure keeps the spec at `review`: fold the renames into the pair and `GLOSSARY.md` together, then
re-run this phase alone — a rename cannot break a countable check that already passed.

## Mission — hunt three failure modes (Phase 1)

Find what breaks the spec before code does. **Contradictions come first** — they are the only failure mode that makes two correct implementations impossible at once, so the claim pass below runs before any missing-part or edge-case reading.

### 1. Contradictions — run the claim pass

Do not scan for contradictions by reading and hoping. Extract, then collide.

**Step 1 — extract claims.** Read the TODO (per-TODO agent) or the whole set (cross agent) and write one row per claim. A claim is any statement the implementation must honour:

| Kind | Where it hides | Example claim |
|---|---|---|
| Signature | `## Changes` diffs, **Behavior** TS block | `loadSpec(dir: string): Spec` |
| Term meaning | Outcome, a printed rule, GLOSSARY row | `"wave" = a set of TODOs with no shared Files` |
| File ownership | `## Files`, increment **Files** | `TODO-3 rewrites src/gate.ts` |
| Order | `Depends on`, wave table, increment `n` | `TODO-5 lands after TODO-2` |
| State transition | Outcome, **Blast radius** | `status moves review → impl` |
| Decision | `thoughts/` decision notes | `no new dependency in the plugin dir` |

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
## What the script cannot judge — the agents' second job

`spec-lint.py` rules on every countable field. What is left needs a reader, so each per-TODO agent
carries it beside the three hunts. Each one is a hard block when it fires.

**A body in the `## Surface` diff**, and the most common finding here. Read every ```diff for
content that *is* the implementation rather than the surface a caller sees: a function body, a loop
or branch chain, a shell script, a SQL query, a regex, a fixture, a table of literal expected
values, a test file's assertions. The edit is the same each time — delete the body, keep the
signature, move the logic into the increment's **Behavior** sketch, and use a plain contract block
when the file has no surface at all (`arch:sub-todo.md` § A diff carries the surface, not a body).
**The one legal body is one the human asked for**, and it carries a `**Body requested:**` bullet
naming the symbol. Judge `## Autotest` the same way: its Cases are sentences, never test source.

**Self-containment.** Read one TODO with `spec.md` and the `thoughts/` notes closed and the printed
rule set open — that is what the implementer sees. A term or a test expectation knowable only from
the closed files is a missing restatement, named as the finding.

**Readable at one pass — the human half only.** `TODO-N.md` is written under the `i-have-adhd` skill
(`arch:ref-todo-sections.md` § Every prose line). Read its rules —
`~/.claude/skills/i-have-adhd/SKILL.md` — then judge every prose line against them: Outcome,
`New terms` **Meaning**, `Components` **Role**, `Autotest` cases, `Commit.Body`. Apply its own test:
read the first sentence of each section, then the bold phrases, and rule whether that skim carries
the approval decision. Two ideas in one sentence, a stacked clause chain, a metaphor standing in for
a plain word, and a fact restated a second way each fire. A finding quotes the sentence and gives the
rewrite, never "tighten this". The agent half is out of scope.

**Over-statement, the same gate in reverse.** The gate may only push text *in* if it can also push
text *out*, or every pass grows the pair. It fires when a rule was copied out of the printed rule
set into a TODO, when spec Description/Goal prose was copied into the human half, or when
`## Surface` carries a symbol no Components row claims. Name the cut, never a move into the agent
half — that half has no line budget to absorb it.

**A rule that is not a rule.** A decision no increment in any TODO can violate is a fact, not a
constraint: the finding is to retype that note as `fact`, and the generator then skips it
(`arch:examples/constraints.md`).

**Scope discipline.** The TODOs align with the current Goal — no unrelated expansion, and no missing
blocker TODO that the referenced files surface.

**Test honesty.** Read **Files** per TODO and classify its surface. A file in a category below cannot
justify `Manual test: skip` with "covered by unit tests", and its Autotest command has to run against
the boundary that changed — `go test ./pkg/server/...` for an RPC change, not `./pkg/types/...`. When
a TODO claims existing tests cover it, open one of those files and confirm it asserts the changed
behavior.

| Category | Match signal | Required |
|---|---|---|
| RPC / gRPC handler | server, handler, `*_grpc.pb.go`, `pb.RegisterX`, `mux.Handle`, `http.HandlerFunc` | integration test OR manual test with concrete request/response |
| Persistence | rocksdb, sqlite, sql.DB, KV store, migration, schema | manual test verifying state survives restart, OR integration test with real backend |
| Cross-process / IPC | gRPC client+server, message queue, pubsub, websocket | e2e test crossing the boundary, OR manual test from a real client |
| Code generation | `.proto`, `buf.gen.yaml`, generator templates | manual test: regenerate, build downstream, verify wire bytes |
| Concurrency primitive | new goroutine, lock, channel, atomic | `go test -race` OR explicit justification why a race is impossible |
| External integration | k8s, S3, OAuth, HTTP client to third party | manual test or recorded fixture — never "unit-tested" alone |
| UI / frontend | `.vue`, `.tsx`, `.svelte`, css | manual test with screenshot or browser steps |

**An E2E deferral is legal only when the named TODO carries the case.** `none — observable only via
TODO-3` binds TODO-3's `## Autotest` `E2E` to a case that asserts this path; a deferral to a TODO
whose E2E never mentions it is an untested path with a citation. Deferring to a `Manual test` never
counts (`arch:ref-todo-sections.md` § Autotest).

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

## Readability
- <TODO-N § section — the quoted sentence + the rewrite; `none` when the half passes the skim test>

## Checks
- <the spec-lint.py verdict lines, verbatim — every check id, passed or failed>

## Required spec edits
- <specific change request>
```

## Verdict + transition (caller, after the agents return)

Decide and transition immediately — no generic follow-up question.

- **READY** — all blocking checks pass, no critical unknowns → transition the spec frontmatter `status` to `impl`. `jj commit -m "Spec verification passed"` in `<notes-dir>`.
- **NEEDS REVISION** — ≥1 blocking issue or unclear dependency → stay at `review` with concise feedback. `jj commit -m "Spec verification failed"`. **Any collision from the claim pass is blocking** — two live claims mean the implementer must guess, and a guess is not a spec.

Use `work_transition` if available; else report the next command (`/work:implement` or `/work:spec`) plus the blocking list. Strict on blockers, concise on style nits.

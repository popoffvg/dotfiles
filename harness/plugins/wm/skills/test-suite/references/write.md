# Test Set Write

Produce a **minimal `.md` index** plus **Gherkin feature files**. The `.md` is for unit-level cases and structure; the `.feature` files are the human-readable behavioral spec.

## Two artifacts — split scenarios by level, never duplicate

- **e2e / behavioral → Gherkin** (`features/<area>.feature`): cross-component flows, lifecycle, async, capacity, failure handling. Given/When/Then a human reads top-to-bottom.
- **unit → table** (in the `.md`): pure-function / single-component cases — validation, boundary maths, rendering. One row per case.

A scenario lives in **exactly one** artifact. If it needs a running system or spans components, it's Gherkin. If it's a pure assertion on one function, it's a table row. Don't write the same case twice.

## Keep the `.md` minimal

The `.md` contains only: scope, assumptions, state model (diagram + matrix), unit-scenario tables, traceability, open questions. No prose retelling of behavior — that's what the `.feature` files are for. No filler. If a line doesn't change a test decision, cut it.

## `.md` contract

1. **Scope** — feature, interfaces, in/out, and the external-systems boundary (below).
2. **Assumptions** — env, permissions, data, and assumed external-dependency state.
3. **State model** — when a lifecycle/FSM exists (below).
4. **Unit-scenario tables** — grouped (validation / boundary / regression), each row with an oracle.
5. **Traceability** — requirement `R#` → scenario ID.
6. **Open questions** — none hidden.

## Scenario IDs

Stable, shared by both artifacts: `TS-HAPPY-001`, `TS-NEG-00N`, `TS-BOUNDARY-00N`, `TS-STATE-00N`, `TS-CAPACITY-00N`, `TS-RESILIENCE-00N`, `TS-REGRESSION-00N`. Gherkin scenarios carry the ID as a `@tag`; unit rows carry it in column 1. Each case: precondition, trigger, observable result, failure signal, priority (P0/P1/P2).

## Model two kinds of state — internal AND external

A test set that models only the app's own state is incomplete.

1. **Internal state** — the unit's own lifecycle/FSM (state-model section below).
2. **External-system state & limits** — every dependency the unit calls has ceilings and states that change behavior: quotas, capacity / max-allocatable, queue depth, rate limits, connection/pool limits, disk space, availability (up / degraded / down), throttling / backpressure. For each dependency ask: *what happens at the limit, past the limit, and when it's unavailable?* These cases are **mandatory** whenever the unit talks to an external system. Note which limits the unit *enforces* vs. *delegates* — and still test the delegated-limit **behavior** (e.g. stuck-pending, rejection mapping) even when enforcement lives in another layer.

## State model (mandatory when a lifecycle/FSM exists)

Read the enum/const source — do not infer. Then:

1. **Enumerate every state** — table: `state | literal | is-final? | meaning | entry trigger`. Include the zero-value/sentinel state even if "unreachable"; flag latent acceptance as a risk.
2. **Mermaid `stateDiagram-v2`** — the fast read. `[*]` for initial/final, label each edge with its trigger, put rejected / guarded / re-assert transitions in `note` blocks (Mermaid draws allowed edges only).
3. **Transition matrix** — rows = current state, columns = event/target; each cell ALLOW or REJECT-with-exact-reason. Diagram and matrix must agree.
4. **Guard precedence** — if global guards run before per-state logic, the reject *reason* differs by path; oracles assert the specific error, not "an error".
5. **Coverage-vs-existing** — map each cell to existing tests; flag gaps (common: same-state re-assert, sentinel targets, guard-precedence reasons).

Anti-pattern: "Creating can go to Pending, Running, Failed or Complete." That hides the rejected cells, the re-assert cells, and the per-path reasons — where state bugs live.

## Gherkin feature files

- One `.feature` per logical area; tag each scenario with its ID (`@TS-STATE-013`).
- Describe behaviour and observable outcomes — no code symbols.
- For a state machine or a decision table, use a `Scenario Outline` whose `Examples` rows are the matrix/table cells (one row = one cell): readable and exhaustive in one artifact.
- Assertions name the observable (resulting state, the specific error/sentinel), never "it works".

```gherkin
@TS-STATE-013
Scenario: Running cannot go back to Pending
  Given a job in state "Running"
  When a "Pending" status update arrives
  Then the transition is rejected with "can't change status"
  And the job stays in state "Running"
```

Layout:

    <area>-test-set.md       # scope, state model, unit tables, traceability, open questions
    features/<area>.feature  # behavioral scenarios, @TS-* tagged

If the team runs a BDD runner (see `bdd.md` or existing `features/`), keep `Examples` bindable; otherwise treat them as readable prose.

## Mandatory coverage checklist

- Happy-path variants (not just one)
- Input validation (empty, null, malformed, oversized)
- Boundary values (min-1, min, max, max+1)
- State conflicts (exists, deleted, stale version)
- Permission/auth (allowed, denied, expired)
- **External limits & state** (at limit, past limit, quota/capacity exhausted, queue full, dependency down/degraded/throttled)
- Dependency failures (timeout, 5xx, unavailable)
- Partial success
- Idempotency / duplicate requests
- Retry / backoff limits
- Regression for known bugs

## Preflight (put in the `.md`)

- **Tooling preconditions**: required linters/config/assets/auth, so verification doesn't fail on setup.
- **Read-after-change**: re-read a file before deriving the next case from it — stale assumptions cause repeated near-identical fixes.
- **Fallback path**: on transient tool/permission failure, capture the diagnostic and stop — no blind retries. Map each subsystem failure to a named assertion (which subsystem, which message).

## Write algorithm

1. Extract requirements → `R1..Rn`.
2. List external dependencies; for each, its limits and states.
3. If a lifecycle/FSM exists, build the state model first (diagram + matrix) — it surfaces transitions the requirement list misses.
4. Generate candidates per requirement, per failure mode, per matrix cell, per external limit.
5. Run the checklist; add missing cases.
6. Split: behavioral → `.feature`, unit → table. No duplicates.
7. Traceability + open questions.

## Done criteria

- Every requirement → ≥1 scenario.
- Every checklist category → ≥1 scenario or explicit N/A reason.
- Every external dependency → at-limit and unavailable behavior covered (or N/A reason).
- State model (if any): every matrix cell ALLOW/REJECT-classified and mapped or gap-noted.
- Every scenario in exactly one artifact (behavioral = Gherkin, unit = table), with an observable oracle; reject paths assert the *specific* reason.
- `.md` is minimal — no duplicated or filler content.
- Open questions listed (none hidden).

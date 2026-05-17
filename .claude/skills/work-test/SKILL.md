---
name: work-test
description: >
  Produce a test strategy for a task or TODO using pairwise (all-pairs)
  combination to minimise case count while keeping coverage high. Splits
  output into three tiers — unit, integration, manual — each with explicit
  oracles. Use during plan phase to fill the `Autotest` and `Manual test`
  sections of `<notes-dir>/todos/TODO-N.md`, or to design an end-to-end
  test plan for a whole task.
---

# work-test

## What this skill produces

A single artifact: a **test strategy** with three tiered case lists.

- **Unit cases** — fast, in-process, mock external deps. Cover branch logic and pure functions.
- **Integration cases** — real wired components (DB, queue, in-process API). Cover contracts between modules.
- **Manual cases** — for a human reviewer. Cover what tests can't see: UX feel, latency perception, log/observability shape, real third-party behaviour.

Each tier has its own pairwise matrix sized for its cost. Don't reuse the same matrix across tiers.

## Where the output lives

- **Per-TODO scope** — write into the `## Autotest` (unit + integration) and `## Manual test` sections of `<notes-dir>/todos/TODO-N.md`. Follow `work-todo-prepare` for required format.
- **Task-wide scope** — write to `<notes-dir>/test-strategy.md`, referenced from `<notes-dir>/plan.md` Implementation Guidelines.

`<notes-dir>` is the work-manager notes directory for the active task (commonly `_notes/`); resolve from phase context.

## Pairwise rationale

Exhaustive coverage of N factors with k values each is k^N cases — explodes fast. Pairwise (all-pairs) testing guarantees every **pair of factor values** appears together in at least one case. Empirically catches ~70-90% of combinatorial defects with O(k²) cases instead of O(k^N).

Use pairwise when:
- ≥ 3 factors influence behaviour
- Each factor has ≥ 2 meaningful values
- Full Cartesian product would exceed the tier's budget (see budgets below)

Do **not** use pairwise when:
- Only 1-2 factors matter — just enumerate all combos.
- The interaction you're testing is specifically 3-way (pairwise won't cover it; add explicit triples).
- Cases are essentially independent (e.g., negative cases per input field) — enumerate per field instead.

## Tier budgets

These are soft upper bounds before you should split the TODO or push cases to a higher tier.

| Tier | Cases per TODO | Cases per task | Cost driver |
|------|----------------|----------------|-------------|
| Unit | ≤ 12 | ≤ 50 | runtime budget (1-2s total) |
| Integration | ≤ 6 | ≤ 20 | env setup + flakiness risk |
| Manual | ≤ 4 | ≤ 10 | human attention budget |

If pairwise output exceeds the budget, drop the lowest-priority factor or merge values (see "Reducing matrix size" below).

## Workflow

### 1. State the system under test (SUT)

One sentence. What entry point, what behaviour. Example: "`POST /auth/refresh` token rotation handler in `pkg/auth/handler.go`".

### 2. Enumerate factors

List every independent input or condition that can vary. Each factor becomes a column in the matrix.

Typical factor categories:
- **Input shape** (valid, malformed, missing fields, oversized)
- **State** (entity exists / absent / soft-deleted / stale)
- **Identity / permission** (anonymous, user, admin, expired session)
- **External dep** (available, slow, 5xx, partial)
- **Concurrency / order** (single, concurrent, retry)
- **Config / feature flag** (on, off, partial rollout)
- **Environment** (linux/macos, container/native, fresh/migrated DB)

For each factor, list the **values** to test. Keep values to 2-4 per factor — that's where pairwise pays off.

### 3. Mark constraints

Some combinations are impossible or meaningless (e.g., "anonymous user" + "admin-only endpoint" — covered by a single deny case, not the full matrix). Write them down explicitly; the pairwise generator must skip them.

### 4. Generate the pairwise matrix

For each tier separately:

1. List the factors + values.
2. Run a pairwise generator (PICT, allpairs, or by hand for small matrices).
3. Result: a table where each row is a test case, columns are factor values.
4. Verify every (factor-A value, factor-B value) pair appears in at least one row.

For ≤ 3 factors with ≤ 3 values each, by-hand works. Larger: use a tool.

### 5. Add mandatory non-pairwise cases

Pairwise covers combinatorial interactions but misses some categories. **Always append:**

- **Smoke / golden path** — the most common valid input, top of the list.
- **Boundary values per numeric/length factor** — min-1, min, max, max+1.
- **Known regression** — one deterministic case per previously fixed bug touching this code.
- **3-way interactions when known to matter** — explicit triples for things like (state × permission × flag).

These are *additions*, not replacements for the pairwise matrix.

### 6. Assign tier per case

Use this rubric:

| Case characteristic | Tier |
|---------------------|------|
| Pure logic, no I/O, runs in < 100ms | Unit |
| Crosses ≥ 2 modules / hits a real DB or queue | Integration |
| Requires human judgement (visual, ergonomic, "feels fast") | Manual |
| External third-party service behaviour | Manual (or integration if recorded/replay) |
| Observability / log shape verification | Manual unless a log-shape test exists |

If a case fits multiple tiers, put it in the **lowest-cost tier** that can prove the oracle.

### 7. Write the oracle

Every case ends with an explicit observable assertion. Banned: "works", "succeeds", "looks right".

Good oracles:
- Unit: return value equals X, function called with args Y, error of type T thrown.
- Integration: HTTP status N + body shape, DB row state S, message published on topic T.
- Manual: described user-visible state ("loading spinner disappears within 2s; success toast shown for ≥ 1s").

### 8. Emit the strategy document

Use the template below. Keep it dense — one screen per tier where possible.

## Output template

```markdown
# Test Strategy: <TODO-N or task name>

## SUT
<one sentence>

## Factors

| ID | Factor | Values | Notes |
|----|--------|--------|-------|
| F1 | input.token | valid / expired / malformed | — |
| F2 | session in redis | present / absent | — |
| F3 | concurrent refresh | single / 2-parallel | only matters with F1=valid |

## Constraints
- F3=2-parallel only with F1=valid (concurrency is meaningful only for valid input).
- F1=malformed implies short-circuit before F2 is read — collapse those rows.

## Unit cases (pairwise + mandatory)

| ID | F1 | F2 | F3 | Tier-specific | Oracle | Priority |
|----|----|----|----|---------------|--------|----------|
| U-SMOKE-1 | valid | present | single | — | returns `{access, refresh}`; old key deleted from mock redis | P0 |
| U-PAIR-1 | expired | present | single | — | returns 401; mock redis untouched | P0 |
| U-PAIR-2 | malformed | — | — | — | returns 400; never calls redis | P0 |
| U-BOUND-1 | valid (token len=max) | present | single | — | returns `{access, refresh}` | P1 |
| U-REGR-1 | valid | absent | single | regression for #1234 | returns 401 (not 500) | P0 |

**Command:** `go test ./pkg/auth/...`

## Integration cases

| ID | F1 | F2 | F3 | Oracle | Priority |
|----|----|----|----|--------|----------|
| I-SMOKE-1 | valid | present | single | 200 + new pair; row gone from real Redis | P0 |
| I-PAIR-1 | valid | present | 2-parallel | exactly one 200, exactly one 401; only one new row in Redis | P0 |
| I-PAIR-2 | expired | present | single | 401; Redis key untouched | P1 |

**Command:** `go test -tags=integration ./pkg/auth/...`

## Manual cases

| ID | Scenario | Steps | Expected | Priority |
|----|----------|-------|----------|----------|
| M-1 | Refresh in browser session | 1. log in; 2. wait until access expires; 3. trigger an API call | network shows 401 → /refresh → retried call returns 200; no visible glitch | P0 |
| M-2 | Log shape on rotation | tail server logs while triggering U-SMOKE-1 | one `auth.refresh.rotated` event with `{user_id, old_kid, new_kid}` | P1 |

## Traceability

| Requirement | Cases |
|-------------|-------|
| Expired token rejected | U-PAIR-1, I-PAIR-2 |
| Old refresh key invalidated on rotation | U-SMOKE-1, I-SMOKE-1, M-2 |
| Concurrent refresh is safe | I-PAIR-1 |
| Malformed input never touches Redis | U-PAIR-2 |
```

## Reducing matrix size

If the pairwise output exceeds the tier budget:

1. **Merge equivalence-class values** — collapse `null`, `""`, `undefined` into "missing".
2. **Drop the lowest-priority factor** — typically the one with smallest blast radius if wrong.
3. **Push a factor up one tier** — e.g., test concurrency only at integration, not at unit.
4. **Split the TODO** — if the matrix is still too big, the TODO is doing too much.

Never drop a value just to fit budget without justifying which interaction loss is acceptable. Record the trade-off in **Constraints**.

## Anti-patterns

- **One giant unit test with N assertions** — fails opaquely; one case per row.
- **Pairwise without smoke + boundary additions** — combinatorial coverage misses common failure modes.
- **Integration cases that duplicate unit cases** — pick the tier that already proves the oracle; don't double-test the same logic.
- **Manual cases that a test could check** — log assertions, status codes, DB rows belong in unit/integration.
- **Vague oracles** ("response is correct") — replace with literal shape/value/event name.
- **Skipping constraints** — the pairwise matrix will contain impossible rows and waste budget.

## Pre-save checklist

- [ ] SUT is one sentence
- [ ] Every factor has 2-4 values
- [ ] Impossible combinations listed in **Constraints**
- [ ] Pairwise property holds: every value-pair across factors appears in ≥ 1 row of the tier where it matters
- [ ] Smoke + boundary + regression cases appended on top of pairwise rows
- [ ] Each case is in the lowest-cost tier that can prove its oracle
- [ ] Every case has an observable oracle (no "works"/"succeeds")
- [ ] Tier budgets respected (unit ≤ 12, integration ≤ 6, manual ≤ 4 per TODO)
- [ ] Unit + integration cases have a runnable shell command
- [ ] Traceability table maps every requirement → ≥ 1 case
```

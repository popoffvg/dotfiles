# Write — enumerate the scenarios before the code exists

Produce two artifacts: a **`.md` test set** that a human reads top to bottom, and **Gherkin
feature files** that carry the body of every behavioural scenario.

The `.md` follows [`ref-readable-output.md`](ref-readable-output.md) — read that first, it is the
contract this subcommand fills. The worked example is
[`examples/ex-strategy-auth-refresh.md`](../examples/ex-strategy-auth-refresh.md).

## How the two artifacts divide

**The `.md` is the map, and every case appears on it.** The function block, the big cases, and
one line per variant — nothing is invisible to a reader of the `.md` alone.

**The `.feature` files hold the body of behavioural scenarios only.** A variant that crosses
components, runs a lifecycle, waits on async work, or exercises capacity gets its Given/When/Then
in a `.feature` file, tagged with the variant's own name. A unit variant has no body anywhere
else: its one line in the `.md` is the whole case.

So a behavioural case exists in two places on purpose — a pointer line in the map and a body in
the feature file — and the name is what joins them. What must never be duplicated is the body: a
scenario has exactly one Given/When/Then, in exactly one `.feature` file.

Layout:

```text
<area>-test-set.md          # the function, big cases, variants, coverage, open questions
features/<area>.feature     # Given/When/Then bodies, tagged with variant names
```

## Names join the two artifacts

The variant name from `ref-readable-output.md` section 4 is the joining key. It appears in the
`.md` line in bold and as the Gherkin tag on the scenario:

```gherkin
@running-cannot-return-to-pending
Scenario: A running job refuses a pending update
  Given a job in state "Running"
  When a "Pending" status update arrives
  Then the transition is rejected with "can't change status"
  And the job stays in state "Running"
```

What the tag must say is in `sub-bdd.md` § Naming Conventions.

## Model two kinds of state — internal and external

A test set that models only the application's own state is incomplete.

**Internal state** is the unit's own lifecycle, covered by the state model below.

**External state and limits** belong to every dependency the unit calls, and each has ceilings
and states that change behaviour: quotas, capacity and maximum allocatable, queue depth, rate
limits, connection and pool limits, disk space, availability (up, degraded, down), throttling and
backpressure. For each dependency ask what happens **at** the limit, **past** it, and when the
dependency is **gone**. These cases are mandatory whenever the unit talks to an external system.

Note which limits the unit **enforces** and which it **delegates** — then still test the
delegated limit's *behaviour* (a request stuck pending, a rejection mapped to a status) even
though the enforcement lives in another layer.

## State model — mandatory when a lifecycle exists

Read the enum or constant source; never infer the states.

**Enumerate every state in scratch** — literal, is-final, meaning, entry trigger. Include the
zero value or sentinel even when it looks unreachable, and treat a state the code silently
accepts as a risk worth a case.

**Build the transition matrix in scratch** — rows are the current state, columns the event or
target, each cell either ALLOW or REJECT with the exact reason. This matrix is a derivation tool
and does not ship. What ships are the big cases it produced.

**Ship the Mermaid `stateDiagram-v2`.** A diagram is read at a glance, so it belongs in the `.md`
where the matrix does not. Use `[*]` for the initial and final states, label every edge with its
trigger, and put rejected, guarded, and re-assert transitions in `note` blocks — Mermaid draws
allowed edges only, so a diagram without notes hides exactly the cells where state bugs live.

**Watch guard precedence.** When a global guard runs before the per-state logic, the rejection
*reason* differs by path. The oracle asserts the specific reason, never "an error".

**Map every matrix cell to a case before you drop the matrix.** The cells that are usually
uncovered: re-asserting the state a resource is already in, a transition to the sentinel value,
and the two reasons a guard can produce for what looks like one rejection.

Anti-pattern: "Creating can go to Pending, Running, Failed or Complete." That sentence hides the
rejected cells, the re-assert cells, and the per-path reasons.

## Mandatory coverage checklist

Every category reaches at least one case, or the `.md` says why it is not applicable:

- Happy paths — the variants, not one
- Input validation — empty, null, malformed, oversized
- Boundary values — min-1, min, max, max+1
- State conflicts — already exists, deleted, stale version
- Permission and auth — allowed, denied, expired
- External limits and state — at the limit, past it, quota exhausted, queue full, dependency
  down, degraded, or throttled
- Dependency failures — timeout, 5xx, unreachable
- Partial success
- Idempotency and duplicate requests
- Retry and backoff limits
- Regression for known bugs

## Preflight — put this in the `.md`

**Tooling preconditions** — the linters, config, assets, and credentials the run needs, so
verification does not fail on setup and get read as a defect.

**Read after change** — re-read a file before deriving the next case from it. A stale assumption
produces a run of near-identical fixes.

**Fallback path** — on a transient tool or permission failure, capture the diagnostic and stop.
No blind retries. Map each subsystem failure to a named assertion that says which subsystem and
which message.

## Write algorithm

1. Distill the system to a function — the signature block goes in first.
2. Extract the requirements in the user's own words; they become the **Coverage** rows.
3. List the external dependencies, and for each its limits and states.
4. Build the state model in scratch when a lifecycle exists — it surfaces transitions the
   requirement list misses.
5. Generate candidates: per requirement, per failure mode, per matrix cell, per external limit.
6. Run the coverage checklist and add what is missing.
7. Group the candidates into three to seven big cases named after behaviours.
8. Split the bodies: behavioural scenarios into `.feature`, unit variants stay as their `.md` line.
9. Fill **Coverage**, **Not covered**, and **Open questions**.

## Done criteria

- [ ] The `.md` passes the checklist in `ref-readable-output.md` section 7
- [ ] Every requirement reaches at least one case
- [ ] Every checklist category has a case or a written N/A reason
- [ ] Every external dependency has at-limit and unavailable behaviour covered, or an N/A reason
- [ ] Every state-matrix cell was classified ALLOW or REJECT and either mapped to a case or noted
      as a gap, before the matrix was dropped
- [ ] Every behavioural scenario has its body in exactly one `.feature` file, tagged with its name
- [ ] Every rejection path asserts the specific reason, not "an error"
- [ ] Open questions are listed, none hidden

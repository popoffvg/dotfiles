# Case design — the techniques that find cases

The black-box toolbox. Each technique derives cases from a specification without reading the
implementation, and each one produces a table.

**Every table on this page is scratch work.** You build it to find the cases; you do not save it.
What you save is the set of big cases the table produced, in the shape
[`ref-readable-output.md`](ref-readable-output.md) defines. A saved document that shows a
decision table or a transition matrix has shipped the tool instead of the result.

Two things survive from the derivation into the saved document, both in words: the **technique**
that produced each big case, and the combinations you pruned, under **Not covered**.

## Equivalence partitioning

Divide the input into classes where every value in a class should produce the same behaviour,
then test one representative of each.

1. Identify the input conditions.
2. Divide into valid and invalid partitions.
3. Pick one representative value per partition.
4. Write one case per partition.

Worked on age validation with a valid range of 18 to 65:

| Partition | Range | Representative | Expected |
|---|---|---|---|
| invalid, below | < 18 | 10 | reject |
| valid | 18-65 | 30 | accept |
| invalid, above | > 65 | 70 | reject |

That table yields three cases, and they belong to two behaviours, not three:
`an-age-inside-the-range-is-accepted` and, under a second big case,
`an-age-below-the-minimum-is-rejected` beside `an-age-above-the-maximum-is-rejected`.

With several inputs, combine the partitions systematically — valid × valid, valid × invalid,
invalid × valid, invalid × invalid — and check that the invalid × invalid case names **which**
input the error reports, because reporting only the first one is a common defect.

## Boundary value analysis

Defects cluster at the edges of a partition, so test at the edge and one step either side.

1. Take the boundaries from the equivalence partitions.
2. Test the minimum, one below it, one above it, and the same three at the maximum.
3. Add the special values: 0, empty, null, the maximum integer.

| Boundary | Value | Expected |
|---|---|---|
| below minimum | 17 | reject |
| at minimum | 18 | accept |
| above minimum | 19 | accept |
| normal | 40 | accept |
| below maximum | 64 | accept |
| at maximum | 65 | accept |
| above maximum | 66 | reject |

Seven rows, one behaviour. They collapse into a single big case —
`## The accepted range is closed at both ends` — whose variants name the edge each one probes.

## Decision table

Use it when several conditions combine into a business rule.

1. Identify the conditions (the inputs).
2. Identify the actions (the outputs).
3. Build the table of condition combinations.
4. Collapse rows where a condition does not change the action.

Worked on a discount, with the conditions *is a member*, *order over $100*, and *has a coupon*:

| Rule | Member | Over $100 | Coupon | Member % | Bulk % | Coupon % |
|---|---|---|---|---|---|---|
| 1 | Y | Y | Y | X | X | X |
| 2 | Y | Y | N | X | X | — |
| 3 | Y | N | Y | X | — | X |
| 4 | Y | N | N | X | — | — |
| 5 | N | Y | Y | — | X | X |
| 6 | N | Y | N | — | X | — |
| 7 | N | N | Y | — | — | X |
| 8 | N | N | N | — | — | — |

Eight rows are unreadable as a deliverable and obvious as a derivation. They ship as big cases
named after what the reader cares about: `## Discounts stack`, `## Each discount applies alone`,
`## An order that qualifies for nothing pays full price`.

## State transition

Use it for a system with distinct states and rules about moving between them.

1. Identify the states.
2. Identify the valid transitions.
3. Build the transition table.
4. Design a case per transition.
5. Add the invalid transitions.

| Current state | Event | Next state | Valid |
|---|---|---|---|
| Draft | submit | Pending | yes |
| Draft | approve | — | no |
| Pending | approve | Approved | yes |
| Pending | reject | Rejected | yes |
| Approved | ship | Shipped | yes |
| Shipped | deliver | Delivered | yes |
| Delivered | any | — | no |

**Always test the invalid transitions** — the terminal state that must refuse everything, the
out-of-order event, and the concurrent change. The valid path is the one the implementer already
walked.

The Mermaid diagram of this machine ships; this table does not. See `sub-write.md`.

## Pairwise

Most defects come from the interaction of two parameters, so covering every pair of values costs
far less than covering every combination and finds nearly as much.

Browser compatibility over browser (Chrome, Firefox, Safari, Edge), OS (Windows, macOS, Linux),
and version (latest, previous) is 24 full combinations and 8 to 12 pairwise cases.

Use PICT, allpairs, or an online generator. `sub-create.md` drives this technique for tiering.

## Error guessing

Experience says where the defects are. Sweep the categories:

| Category | Examples |
|---|---|
| null and empty | null input, empty string, empty collection |
| boundaries | off by one, overflow, underflow |
| format | invalid date, malformed email, wrong encoding |
| state | race conditions, stale data, concurrency |
| resources | memory exhausted, connection limit, timeout |
| security | SQL injection, XSS, path traversal |

Questions to run over every input: what if it is null, empty, full of special characters, or
longer than the maximum? What if two requests arrive at once? What if the external service
fails, or the database connection drops? What if the number is negative, or the list has
duplicates?

## State combination

For an operation that talks to an external component — a queue, Kubernetes, storage, a database
— the untested gap is not either state on its own. It is the **combination**: what the system
does when internal state X meets external state Y.

### When to apply

After equivalence, boundary, and pairwise design, run the three-question check. If any answer is
yes, continue.

1. Does the operation call an external component?
2. Does it branch on state, internal or external?
3. Is the mid-flight mutation catalog below still uncovered?

### Step 1 — discover the state candidates

**Internal state**: grep for the conditionals — `switch resource.State`, `if status ==`, proto
enum comparisons. Only the states that drive a branch matter.

**External state**: trace the external client calls in the operation — the Kubernetes client, the
queue publish and consume, the storage get and put. For each call site, list what state that
component can be in when the call happens.

**Retrospective**: review past bugs whose signature was "worked in isolation, failed after
sequence Y", and add their combinations.

### Step 2 — build the combination matrix, in scratch

```text
Operation: RunJob

Internal state    | External (K8s)      | Tested?
------------------|---------------------|--------
Pending           | No prior pod        | yes
Pending           | Stale pod exists    | no
Running           | Pod running         | yes
Running           | Pod evicted         | no
Cancelling        | Pod running         | no
Cancelling        | Pod already gone    | no
```

Untested cells are the candidates.

**Reducing it.** This is a two-factor product, so pairwise does not apply — all pairs of two
factors *is* the full product. The two reducers are:

- **Impossibility pruning** — drop what cannot physically occur. The grid above is already
  pruned: a 3 × 3 product has nine cells, and `Pending + Pod running` is missing because no pod
  exists before the job starts. State the pruning so a reviewer can challenge it, and carry it
  into **Not covered**.
- **Equivalence collapse** — merge the external states that drive the identical branch into one
  representative.

Pairwise returns as soon as a **third** factor appears — an operation variant, a caller
permission, a retry count.

### Step 3 — set up the external state

Use real components. Force the dependency into the target state through its own API before the
system under test runs: create, delete, or evict pods and jobs through the Kubernetes client;
pre-fill or drain the queue; seed or wipe the specific keys in storage.

### Step 4 — the mid-flight mutation catalog

Triage each case for reproducibility before writing it:

| Case | Reproducible? | Tier |
|---|---|---|
| Pod evicted while the job runs | yes — eviction API | integration |
| Node fails under a running pod | hard — single-node k3s | accept as risk |
| Job deleted externally during a watch | yes — concurrent delete client | integration |
| Queue message re-queued on visibility timeout | yes — fake clock advance | integration |
| Queue consumer crashes mid-message | yes — context cancel | integration |
| Concurrent operation modifies the same resource | yes — parallel goroutines | integration |
| Network partition to the external component | partial — fault injection wrapper | integration |
| Lease or lock expires while held | yes — fake clock advance | integration |
| Capacity exhausted while the operation waits | yes — reduce the quota mid-flight | integration |
| External component restarts mid-operation | hard — timing sensitive | e2e smoke |
| Resource deleted by a concurrent client | yes — two racing clients | integration |
| Config change applied during the operation | depends on hot reload | e2e smoke |

Reproducible becomes an integration case. Hard gets a cost judgement: invest when the impact is
high, otherwise accept the risk **and write it into Not covered**. A silently skipped case reads
as a covered one.

**Pick the injection mechanism by trigger type, and never by wall-clock sleep.** A call-boundary
event (eviction, external delete, partition) wants an interceptor around the external client that
fires on the Nth call or on a condition — deterministic, with no hook in production code; the
pattern is `util/minet/nettest/RoundTripper`. A time-based event (visibility timeout, lease
expiry) wants an injectable clock advanced by the test. Sleeping is flaky and is only the last
resort when no clock seam exists.

### Step 5 — assert with two oracles

**Read the state back.** After the operation, inspect everything it could have touched — the
resource status, the queue depth, the Kubernetes job — not only the return value.

**Assert the invariants.** Define the system-level statements that must hold whatever the state
combination, and check them after every sequence:

```text
A deleted resource never appears in a list response.
A failed job never leaves a running pod behind.
A cancelled operation releases every lease it took.
A re-queued message is processed exactly once.
```

Invariants survive code changes without per-test edits, and they catch the cross-cutting
violations no single operation's author thought to assert.

### Scope

Integration tests own the full combination matrix, with real components and controlled setup.
E2e smoke tests take the two or three highest-risk mid-flight cases — pod eviction, concurrent
deletion — where the fidelity gap is widest.

## Mutator and write-site coverage

For a field carrying an invariant that a guard reads elsewhere
(`if x.IsFinal() && !x.IsCIDRecovered() { panic }`, `assert balance >= 0`,
`require status in {...}`), the gap is rarely a *state*. It is the **one write site that
establishes the state dishonestly**. State-transition and state-combination design enumerate
states and treat every mutator as a leaf, so they miss the setter that lies.

### When to apply

After state design, when any of these hold:

1. A guard or assertion reads two or more fields of the same entity together — a consistency
   invariant, not a range check.
2. The invariant is enforced at the **call sites** rather than inside the setter. Research often
   names this "caller-enforced", and that phrase is the trigger.
3. An earlier fix touched *some* setters of the field and you cannot prove it touched all.

### Step 1 — enumerate every write site by searching, not by recalling

```text
guard reads:  IsFinal()  &&  !IsCIDRecovered()
              └─ writes: SetFinal / Reset            └─ writes: SetCanonicalID(_, isRecovered)

grep 'SetCanonicalID(' → every call site, including the flag it passes
```

List each site with the literal value it passes. A hardcoded literal sitting next to siblings
that thread a variable — `SetCanonicalID(id, false)` beside `SetCanonicalID(id, isRecovered)` —
is the prime suspect, because it is the site that cannot represent the honest state.

### Step 2 — one case per write site

Each case reaches one write site and asserts the invariant was established **honestly**. The
oracle is the guard itself: drive the field through the suspect setter, force the condition that
makes the guard fire, and assert it does not reject a state that is legitimately reachable.

### Step 3 — prune by reachability, never by assumption

Do not drop a write site because "that path cannot produce a conflicting value". That assumption
is what hid the bug. Prune only when the path is *physically* unreachable — dead code, excluded
at compile time — and write the reachability proof into **Not covered**.

## Choosing a technique

| Situation | Technique |
|---|---|
| Range validation | boundary values + equivalence partitioning |
| Complex business rule | decision table |
| State-dependent behaviour | state transition |
| Many parameters | pairwise |
| Error handling | error guessing |
| Critical calculation | all of them |
| Talks to an external component | state combination |
| Stateful operation with side effects | state combination |
| Consistency invariant read by a guard, enforced by callers, patched once already | mutator and write-site coverage |

## Where the output goes

Cases derived here feed `sub-create.md`, which tiers them, and `sub-write.md`, which writes the
document and the feature files. Both save the big cases and drop the tables.

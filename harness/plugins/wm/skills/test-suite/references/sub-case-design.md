# Case design — the techniques that find cases

The black-box toolbox. Each technique derives cases from a specification without reading the
implementation, and each one produces a table.

**In:** one operation, feature, or TODO outcome, named by the caller. **Out:** its set of big
cases, handed to `sub-create.md` for tiering and `sub-write.md` for the document. **Done when**
every row of § Choosing a technique that matches your subject has been run, and every case the run
produced is either in the set or written into **Not covered** with the reason. A technique skipped
silently reads as a technique that found nothing.

**Every table on this page is scratch work.** You build it to find the cases; you do not save it.
What you save is the set of big cases the table produced, in the shape
[`ref-readable-output.md`](ref-readable-output.md) defines. A saved document that shows a decision
table or a transition matrix has shipped the tool instead of the result. Two things survive the
derivation, both in words: the **technique** that produced each big case, and the combinations you
pruned, under **Not covered**.

The collapse is the work. Boundary analysis of a closed range 18–65 yields seven rows — below,
at, and above each edge, plus one normal value — and those seven rows are **one** behaviour:
`## The accepted range is closed at both ends`, whose variants name the edge each one probes.
Ship seven cases and the reader learns nothing the name did not already say.

## The four derivations

Each one is standard practice; what is not standard is what it collapses into.

| Technique | Derive | Collapses into |
|---|---|---|
| **Equivalence partitioning** | one representative per class of input that behaves alike | one big case per *behaviour*, not per partition — a valid class and its two invalid neighbours are two behaviours, not three |
| **Boundary values** | the edge and one step either side, plus 0, empty, null, and the maximum integer | one big case per closed range, variants named for the edge |
| **Decision table** | every combination of the conditions, then collapse rows where a condition does not change the action | big cases named after what the reader cares about — `## Discounts stack`, `## Each discount applies alone`, `## An order that qualifies for nothing pays full price` |
| **State transition** | one case per valid transition, **plus every invalid one** — the terminal state that must refuse everything, the out-of-order event, the concurrent change | one big case per rule about movement. The Mermaid diagram of the machine ships (`sub-write.md`); the transition table does not |

**With several inputs, combine the partitions systematically** — valid × valid, valid × invalid,
invalid × valid, invalid × invalid — and check that the invalid × invalid case names **which**
input the error reports. Reporting only the first one is a common defect.

**The valid path is the one the implementer already walked.** Every technique above earns its
keep on the branch nobody ran.

## Pairwise

Most defects come from the interaction of two parameters, so covering every pair of values costs
far less than covering every combination and finds nearly as much. Browser compatibility over
browser (Chrome, Firefox, Safari, Edge), OS (Windows, macOS, Linux), and version (latest,
previous) is 24 full combinations and 8 to 12 pairwise cases.

Use PICT, allpairs, or an online generator. `sub-create.md` drives this technique for tiering.

## Error guessing

Experience says where the defects are. Sweep the categories over every input:

| Category | Examples |
|---|---|
| null and empty | null input, empty string, empty collection |
| boundaries | off by one, overflow, underflow |
| format | invalid date, malformed email, wrong encoding |
| state | race conditions, stale data, concurrency |
| resources | memory exhausted, connection limit, timeout |
| security | SQL injection, XSS, path traversal |

Then the ones no per-input sweep reaches: two requests arriving at once, the external service
failing, the database connection dropping.

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

## Property-based

Every technique above picks the inputs and leaves you the assertion. This one inverts it — you
assert a rule over the whole input domain and a generator hunts the counterexample, which finds
the case no table would have produced. Round trip, oracle, idempotence, invariant, metamorphic.

Two rules decide whether it works. **Only assert a property the code already claims** — in a
spec, a type, a doc line, or how its callers use it — because a property you merely believe
produces a red test that is not a bug. And **put the constraint in the generator**, sized to the
domain the callers guarantee, sound before complete.

Full technique, catalog, generator rules, and the failure triage:
[`ref-property-based.md`](ref-property-based.md). Read it before writing the first generator.

**The collapse:** one property is one big case, named after the claim —
`## Any encoded record decodes back to itself`. The generator and the shrunk counterexample stay
in the test source.

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
| Serializer, codec, parser, or migration | property-based — round trip, does not crash |
| Refactor or rewrite with the old code still runnable | property-based — oracle |
| Normalizer, formatter, or a write that may be retried | property-based — idempotence |
| Right answer is expensive or impossible to compute | property-based — metamorphic |

## Where the output goes

Cases derived here feed `sub-create.md`, which tiers them, and `sub-write.md`, which writes the
document and the feature files. Both save the big cases and drop the tables.

---
name: quint-spec
description: >
  Quint specification language reference for writing formal specs in plans.
  Use when a TODO needs a behavioral specification: state transitions, invariants,
  concurrency constraints. Write Quint modules to describe WHAT the system must do,
  not HOW to implement it. Start from the smallest module, and state what each model
  covers, what it does not cover, and what the next step adds.
---

# quint-spec

Quint is a typed specification language for describing system behavior formally.
Use it in plan TODOs to specify state machines, invariants, and edge cases
that pseudocode cannot express precisely.

## When to use Quint in a plan

- State machines with transitions (auth flows, order lifecycles, connection states)
- Concurrent operations where ordering matters (token rotation, queue consumers)
- Invariants that must always hold (balance >= 0, no double-spend)
- Protocol logic (handshakes, retries, leader election)

**When NOT to use Quint:**
- Pure CRUD with no state constraints
- Config wiring, file moves, renames
- Simple input→output transformations (pseudocode is enough)

## Quint quick reference

### Types

```quint
// Basic types
bool, int, str

// Collections
Set[int], List[str], Map[str, int]

// Tuples and records
(int, str)
{ name: str, age: int }

// Sum types (tagged unions)
type Status = Pending | Active(int) | Failed(str)

// Type aliases
type UserId = int
type TokenStore = Map[str, { userId: UserId, expiresAt: int }]
```

### State and operators

```quint
module Example {
  // Constants — fixed for a given system instance
  const MAX_RETRIES: int
  const TIMEOUT: int

  // State variables — change over time
  var counter: int
  var status: Status

  // Pure functions — no state dependency
  pure def clamp(x: int, lo: int, hi: int): int =
    if (x < lo) lo else if (x > hi) hi else x

  // State-dependent values
  val isActive = status != Pending

  // Actions — state transitions (delayed assignment with ')
  action init = all {
    counter' = 0,
    status' = Pending,
  }

  action increment = all {
    counter < MAX_RETRIES,      // guard: action enabled only when true
    counter' = counter + 1,
    status' = status,           // unchanged
  }

  action reset = all {
    counter' = 0,
    status' = Pending,
  }

  // Non-deterministic choice; `quint run` uses `step` by default (`next` is a built-in name)
  action step = any {
    increment,
    reset,
  }
}
```

### Key patterns

#### Guards (preconditions)

```quint
action withdraw(amount: int): bool = all {
  amount > 0,                    // guard: positive amount
  balance >= amount,             // guard: sufficient funds
  balance' = balance - amount,
}
```

#### Non-deterministic choice (modeling external input)

```quint
action receiveRequest = {
  nondet userId = oneOf(Users)
  nondet amount = oneOf(1.to(MAX_AMOUNT))
  processRequest(userId, amount)
}
```

#### Invariants (must always hold)

```quint
// State invariant
val balanceNonNegative = balance >= 0

// Temporal: always true across all states
temporal safetyProperty = always(balanceNonNegative)
```

#### Runs (concrete test scenarios)

```quint
run happyPath =
  init
    .then(deposit(100))
    .then(withdraw(50))
    .expect(balance == 50)

run overdraftBlocked =
  init
    .then(deposit(10))
    .then(withdraw(20))
    .fail()  // withdraw should be disabled
```

#### Imports across files

A model starts as one file with its instance modules at the end, so most models need no import: `module asBuilt { import fsStore(treeGuard = true).* }`. The notes below apply only to a multi-file model.

```quint
import coll as C from "./coll"               // plain import: every plain import of coll shares its vars
import part(FLAG = FLAG) as P from "./part"  // instance: a copy of every var that part declares or imports
export part.*                                // makes the names of part visible to the importers of this module
```

- An instance copies variables. A module that is instanced with `const` values and imports a collection writes its own copy of that collection, and `quint run` fails with `QNT502: Variable v not set`. To split a model across files, give the split files no `const` and keep the switches in the state (`rules/quint.md`: Split the system module by process).
- An import is not passed on. A test that imports the entry module sees the names of the modules that the entry module imports only if the entry module has `export m.*`.
- Start a split model at `main.qnt`: the `const` declarations, `init`, and `step`, with the reading order in its first comment. The instance modules go in a separate entry file that imports `main(...)`.

### Collections cheat sheet

```quint
// Sets
Set(1, 2, 3)
S.contains(e)           // membership
S.union(T)              // S ∪ T
S.exists(x => P)        // ∃ x ∈ S: P
S.forall(x => P)        // ∀ x ∈ S: P
S.filter(x => P)        // { x ∈ S | P }
S.map(x => e)           // { e | x ∈ S }
S.fold(init, (acc, x) => e)
S.size()

// Maps
Map("a" -> 1, "b" -> 2)
m.get(key)              // lookup
m.keys()                // domain
m.set(key, val)         // update (returns new map)
m.put(key, val)         // add entry
S.mapBy(x => e)         // { x ↦ e | x ∈ S }

// Lists
[1, 2, 3]
l.head()                // first element
l.tail()                // all but first
l.append(e)             // add to end
l.length()
l.foldl(init, (acc, x) => e)
l[i]                    // 0-indexed access

// Records
{ name: "alice", age: 30 }
r.name                  // field access
r.with("name", "bob")   // update field
```

## Writing specs in plan TODOs

When writing a Quint spec inside a TODO, keep it focused:

0. **Name the one question** the model answers. A task with several questions gets several small models, one file each (`rules/quint.md`: Keep each model small).
1. **Design the smallest module** that can answer the question, then grow it one case at a time (see [Grow the model from the smallest module](#grow-the-model-from-the-smallest-module)).
2. **Define types** for the domain (records, sum types, aliases)
3. **Declare state** (var) and constants (const)
4. **Write actions** for each state transition the TODO implements
5. **Write invariants** the implementation must preserve
6. **Write 2–3 runs** as concrete test scenarios (happy path + edge cases)
7. **End with the coverage**: the `Covers`, `Not covered`, and `Next step` lists of the head comment.

The spec is a contract: the implementer must satisfy the invariants and
the runs must pass against the implementation logic.

## Grow the model from the smallest module

A big first model hides its gaps, and its rare races need a large sample budget. Start with the smallest module that can answer the question. Add one case per step, and run the model after each step.

1. **Write the smallest module.** Use the fewest actors the question needs, usually two. Use at most two `var`s, one action per actor, and one invariant. Make each action atomic. Leave out crashes, retries, clock skew, and a third actor.
2. **Make it fail once.** Turn off the fix that the question is about, and see the invariant fail. A model that cannot fail answers nothing (`rules/quint.md`: Check that the model can fail).
3. **Write the coverage in the head comment.** Every model MUST have the three lists below. Each `Not covered` item names the case and the risk to the answer.
4. **Grow by one case.** Take one `Not covered` item, add it to the model, and move it to `Covers`. Examples of one case: split a fused action into a check and a write, add a crash between two writes, add a second taker, add clock skew. Run every instance again after the step.
5. **Stop** when the result answers the question, or when every `Not covered` item is out of scope for the question. Say which of the two.

```quint
// Question: can a second taker write while the first holder still writes?
// Covers: one holder, one taker; a take and a release; a lease that expires.
// Not covered: a crash of the holder (a lost release can leave the lease taken); clock skew (a slow clock can extend a lease); a third taker (adds no new order of steps, out of scope).
// Next step: add clock skew between the holder and the taker.
```

Every hand-off of a model result MUST repeat `Not covered` and `Next step` from the head comment. The reader must know which cases the result does not prove, and what the next step can check.

## Model design rules

A model result MUST reach the reader as a reader chart, not as Quint: a Mermaid statechart in the reader's words, with each bug as a numbered path and replayed in the code. How: `references/reader-chart.md`.

`rules/quint.md` holds the model rules: the size budget and the split into small models, the collections and their relations as invariants, the comments of `step`, the sample budget, and the checks that a model can fail. The multi-file layout (one module per collection, entry points, the split by process) is there too, for a model that cannot be split.

## Write an action for one read

A reader checks an action guard by guard, so each guard gets its own line.

- Put each guard and each assignment of `all { … }` on its own line. Do not pack them on one line.
- Give each guard that is not a single call a `val` name that says the fact: `val hasNoHandle = w.token == 0`. The `all` then lists names, so it reads as a sentence.
- Name a next state that a branch uses: `val withHandle = { ...idle, token: v }`. Do not build a record inline in an `if` branch.
- Name the condition of an `if` chain: `val writeLands = casMatches(store, w.observed) and outcome != "notWritten"`. Then each branch tests one name.
- Move a predicate inside `forall` or `exists` to a `pure def` with a name: `WRITERS.forall(id => insideWriteTime(writers.get(id), now + 1))`.

```quint
// Bad: four facts on one line.
all { w.token == 0, w.observed == -1, isFree(store, localNow(w, now)), update(id, { ...w, observed: store.version }, store) }

// Good
val hasNoHandle = w.token == 0
val takeNotStarted = w.observed == -1
all {
  hasNoHandle,
  takeNotStarted,
  isFree(store, localNow(w, now)),
  update(id, { ...w, observed: store.version }, store),
}
```

## Simplify a model

Use this section for a model that is already too big. A smaller model reaches its rare races in fewer samples. Cut in this order, and write each cut in the `Abstractions` list of the head comment, with the reason it is safe for the question:

1. **Use the fewest actors the race needs.** A mutual-exclusion race needs one holder and one taker. A third writer only adds another taker and multiplies the state space.
2. **Reuse a counter as an identity.** A token that is new on each take can be the version the take wrote. Delete the separate token record and its counter.
3. **Encode "missing" as a value the guards already handle.** A missing lease object is version 0 with an expiry far in the past, so `isFree` covers it. Delete the `exists` flag and every branch on it.
4. **Delete an action that can only make the bad state less reachable.** Example: a release runs after the last write and only frees the lease sooner. Keep it if an invariant reads its effect.
5. **Delete the branches that a fused step makes dead.** When one action does a check and a write in one step, nothing can change between them. A branch for "the version moved between the check and the write" never fires. Delete it and the field it reads, and name the race the fusion hides in the head comment.
6. **Sample a bound at its extremes.** A timing rule that is linear in a clock offset fails first at the largest difference. Choose each offset from `Set(0, MAX_SKEW)`, not `0.to(MAX_SKEW)`. In the lease model, this changed the slow-write race from 1 of 2 runs to 3 of 3 runs at 100,000 samples.

After each cut, run every instance that expects a violation at least two times with the same budget. A single run does not prove a budget: the lease model's slow-write race showed in 1 of 2 runs at 100,000 samples and in 2 of 3 runs at 300,000. If a violation shows in some runs only, make the race easier to reach (step 6), not the budget larger.

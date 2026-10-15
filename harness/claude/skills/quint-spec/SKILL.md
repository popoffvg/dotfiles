---
name: quint-spec
description: >
  Quint specification language reference for writing formal specs in plans.
  Use when a TODO needs a behavioral specification: state transitions, invariants,
  concurrency constraints. Write Quint modules to describe WHAT the system must do,
  not HOW to implement it. Also use when any model (Quint, TLA+, Alloy) passes its
  checks and you must decide whether to trust it: abstraction fidelity, invariant
  coverage per state component, fix-off runs, blind review of a stripped copy.
  Also use when a model has several kinds of state and you must make it readable:
  one Quint module per collection named by the glossary, one State record and one
  commit action in the system module, and the relations between collections as invariants.
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

1. **Define types** for the domain (records, sum types, aliases)
2. **Declare state** (var) and constants (const)
3. **Write actions** for each state transition the TODO implements
4. **Write invariants** the implementation must preserve
5. **Write 2–3 runs** as concrete test scenarios (happy path + edge cases)

The spec is a contract: the implementer must satisfy the invariants and
the runs must pass against the implementation logic.

## Shape the state as named collections

Use this shape when the model has more than one kind of thing, for example resources, files, and snapshot records. Design the collections of the real system, not the rows. A collection is a set or a map that the system really keeps: a table in the DB, the files in a store, a queue in memory, the records in a bucket. Name each collection by the glossary term of the project. The links between collections become set relations, and each relation is one invariant.

A loose set such as `live` or `data` has no owner and no name a reader can look up. A missing collection is a missing concept. Example: "the workdirs that only an index task reads" became visible as `inputs(indexTasks) \ workdirs` only when `indexTasks` and `workdirs` were collections of their own.

### A. One module per collection

1. List the collections. For each one, write where it lives (DB, a store, memory, a bucket), its element type, and what a restore or a crash does to it. The place decides what a restore brings back, so it goes in the first line of the module.
2. Write one file per collection in `collections/`, named after the glossary term (see [Mark the entry points](#mark-the-entry-points)). The module owns one `var` with the same name, an `init`, a `write(v)` action, and the invariants that read only this collection:

   ```quint
   // Collection, in the work store: the files that exist. A restore does not bring it back.
   module workStore {
     import ids.* from "./ids"
     var workStore: Set[Res]
     action init = workStore' = Set()
     action write(v: Set[Res]): bool = workStore' = v
     // Local: only work-store ids.
     val onlyWork: bool = workStore.forall(r => isWork(r))
   }
   ```

3. Put the shared id types and the record types in modules with no `var` (`ids.qnt`, `snapshotRecord.qnt`), and import them with `.*`.
4. Use an enum only for a field that has exactly one value per element, for example the phase of a record. A fact that groups many elements is a collection, not an enum value.

Three Quint rules apply to this layout:

- Import each collection module qualified: `import workStore as WorkStore from "./collections/workStore"`. Every module has an `init` and a `write`, and a `.*` import makes them conflict.
- Give every `var` a unique name across all modules. A qualified import does not separate variables: two modules that each own `var files` fail with "Multiple updates of variable".
- Do not name an action, a parameter, or a `val` `put`, `next`, or `to`. They are built-in names.
- Put parentheses around a boolean expression on the right of `x' =`. Quint reads `x' = a or b` as `(x' = a) or b`: when `b` is true, the action runs with `x' = a`.

Done when every `var` lives in a collection module named after a glossary term, and the first line of each module says where the collection lives.

### B. The system module reads and writes every collection in one record

1. Declare a `State` record with one field per collection, and a `val now: State` that reads every collection var.
2. Write one `action commit(s: State)` that calls `write` on every collection. Every action is a guard on `now`, then `commit(<pure update of now>)`.
3. Write each update as a `pure def` on `State` (`gc(s)`, `writeFiles(s, rs)`). Tests read `now.<collection>`.

```quint
val now: State = { workStore: WorkStore::workStore, deletionQueue: DeletionQueue::deletionQueue, ... }
action commit(s: State): bool = all { WorkStore::write(s.workStore), DeletionQueue::write(s.deletionQueue), ... }
action executeDelete(r: Res): bool = all {
  now.deletionQueue.contains(r),
  not(deletionGuardrail),
  commit({ ...eraseFiles(now, Set(r)), deletionQueue: now.deletionQueue.exclude(Set(r)) }),
}
```

Done when no action assigns a `var` directly, and every action ends in `commit`.

### C. The relations between collections are the invariants

1. For each pair of collections that the system connects, write one relation: an inclusion, an empty intersection, or a key match. Name the invariant by the relation, and write the two collections in the comment above it:

   ```quint
   // DB → stores: every DB resource has its file, or waits for a rebuild.
   val dbResourcesHaveFiles: bool = dbResources(now).forall(r => hasFile(now, r) or now.rebuild.contains(r))
   // Deletion queue → DB and index tasks: nothing that the DB or an index task needs is queued for deletion.
   val deletionQueueNeedsNothing: bool =
     now.deletionQueue.forall(r => not(dbResources(now).contains(r)) and not(inputs(now.indexTasks).contains(r)))
   ```

2. Make a table in the test document: one row per relation, with the two collections and the meaning. Every collection appears in at least one row. A collection with no row is not checked.
3. Group `allInvariants` in two parts: inside one collection, and between collections.

Done when every collection is in at least one relation, and every relation is in `allInvariants`.

## Mark the entry points

Quint has no `main` file. A reader of a model folder cannot tell which file runs and which file is a library. Make the layout tell it:

1. Keep only the entry points and the system modules at the top of the model folder. An entry point is a file with instance modules that `quint run --main` or `quint test --main` takes.
2. Move every library module to a subfolder, for example `collections/`. A library module has no instance module: a collection, a shared type. Import it by the subfolder path, also from the test files.
3. Name the test model `README.md` in the model folder. Start it with an `## Entry points` table: the file, the `--main` modules, what each checks, and the expected result. Link each file.
4. Add `check.sh` next to it. It holds one row per run: the file, the module, the kind (`test` or `run`), and the expected result (`pass` or `violation`). A module with a fix turned off expects `violation`. The script runs each row, prints `ok` or `FAIL`, and exits non-zero on any `FAIL`. It takes the trace count as an argument.
5. Make `check.sh` typecheck every file before the first row. `quint run` exits non-zero on a parse error too, so a broken file passes a row that expects `violation`.
6. Put the command `./check.sh` in the "How it runs" part of the README.

Done when `ls` of the model folder shows only entry points, system modules, `README.md`, and `check.sh`, and `./check.sh` prints no `FAIL`.

## Check that the model can fail

A model checks only the states that its shape allows. An abstraction that makes a bad state impossible hides the gap from every invariant and every random run. A green `quint run` proves nothing until steps 1 to 5 pass. Step 6 tests the invariants themselves; run it when the model gates a design decision.

1. **Prove each safe abstraction from the source.** A safe abstraction is a guard, an atomic step, or a reference that protects state, and also each failure or interleaving the model leaves out. Cite the `file:line` that does it in the real system. If no line does it, change the model to the weaker behavior. If the source is not available, ask for it, and do not trust the model. Example: "an index task keeps its input workdir as a DB reference" had no source line, and the real system does not do it.
2. **Cover every state component with an invariant.** Make a table: each `var` and each record field against the invariants that can fail on it. A read that cannot fail is not coverage. Write a new invariant for each empty row. Example: every invariant read `db.live`, and none read `db.tasks`, so a lost task input was invisible.
3. **Exempt the states where the loss is by design.** Do this before step 4. Write the exemption as a guard in the invariant. Example: workdirs after their hold ends. An invariant without the exemption fails on correct behavior and hides the real failure.
4. **Turn each fix off, and see an invariant fail.** A fix is each mechanism that keeps a bad state away. Put each one behind a `const`, and run with the same trace budget once per fix turned off. If no invariant fails, write a `run` that tries to reach the bad state. If the `run` reaches it, the fix is redundant. If no action can reach it, the shape hides the gap: go back to step 1.
5. **Add a witness for each dangerous state.** Pass it to `quint run --witnesses`, which prints the share of traces that reach it. Example: "a ready dump holds a task in progress". At 0%, the runs never explored the case: raise `--max-steps` or fix the guard that blocks it.
6. **Test the invariants blind.** An invariant written after you know a gap tests the fix and does not find the gap. Copy the model, and remove one fix and its invariant. First confirm that the copy fails an invariant you wrote in step 2. Then give only the copy to a fresh agent, with the task "find a state the real system can reach that breaks safety". If the agent does not find the gap, your invariants are too weak: go back to step 2.


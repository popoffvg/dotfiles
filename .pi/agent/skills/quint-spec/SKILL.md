---
name: quint-spec
description: >
  Quint specification language reference for writing formal specs in plans.
  Use when a TODO needs a behavioral specification: state transitions, invariants,
  concurrency constraints. Write Quint modules to describe WHAT the system must do,
  not HOW to implement it.
---

# quint-spec

Quint is a typed specification language for describing system behavior formally.
Use it in plan TODOs to specify state machines, invariants, and edge cases
that pseudocode cannot express precisely.

Reference: https://quint-lang.org/docs/lang

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
  val isActive = status == Active

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

  // Non-deterministic choice
  action next = any {
    increment,
    reset,
    timeout,
  }
}
```

### Key patterns

#### Guards (preconditions)

```quint
action withdraw(amount: int) = all {
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
S.fold(init, (acc, x => e))
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
l.foldl(init, (acc, x => e))
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

## Autoresearch rules

**Eval checklist:**
1. Was Quint used only for stateful/concurrent TODOs (not for linear CRUD or wiring)?
2. Does each Quint module include at least one invariant and one run?
3. Are transitions modeled with explicit guards (not implicit assumptions)?
4. Does the spec define WHAT the system must do, not implementation HOW details?

**Test inputs:**
- "Specify token rotation with expiry guards and concurrent refresh"
- "Specify simple CRUD endpoint behavior" (should use pseudocode, not Quint)
- "Specify leader election protocol with split-brain prevention"

**Can change:** Quint examples, guard/invariant templates, selection criteria, run patterns
**Cannot change:** WHAT-not-HOW principle, formal spec focus, skip criteria for simple workflows
**Min sessions before eval:** 5
**Runs per experiment:** 3

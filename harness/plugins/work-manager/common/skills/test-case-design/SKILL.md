---
name: test-case-design
description: Apply systematic test case design techniques including equivalence partitioning, boundary value analysis, decision tables, state transition testing, and state combination analysis for systems with external dependencies.
allowed-tools: Read, Write, Glob, Grep, Task, WebSearch, WebFetch
---

# Test Case Design Techniques

## When to Use This Skill

Use this skill when:

- **Test Case Design tasks** - Working on applying systematic test case design techniques including equivalence partitioning, boundary value analysis, decision tables, state transition testing, and state combination analysis
- **Planning or design** - Need guidance on Test Case Design approaches
- **Best practices** - Want to follow established patterns and standards

## Overview

Systematic test case design techniques ensure thorough coverage while minimizing test case count. These black-box techniques derive test cases from specifications without knowledge of internal implementation.

## Equivalence Partitioning

Divide input data into equivalent classes where any value should produce the same behavior.

### Process

1. Identify input conditions
2. Divide into valid and invalid partitions
3. Select one representative value from each partition
4. Create test cases for each partition

### Example: Age Validation (18-65)

| Partition | Range | Representative | Expected |
|-----------|-------|----------------|----------|
| Invalid (below) | < 18 | 10 | Reject |
| Valid | 18-65 | 30 | Accept |
| Invalid (above) | > 65 | 70 | Reject |

**Test Cases**:

- TC1: age = 10 → Reject (invalid below)
- TC2: age = 30 → Accept (valid)
- TC3: age = 70 → Reject (invalid above)

### Multiple Input Partitions

Combine partitions systematically:

```text
Input A: {Valid, Invalid}
Input B: {Valid, Invalid}

Combinations:
1. A-Valid, B-Valid   → Expected: Success
2. A-Valid, B-Invalid → Expected: Error for B
3. A-Invalid, B-Valid → Expected: Error for A
4. A-Invalid, B-Invalid → Expected: Error for both
```

## Boundary Value Analysis

Test at and around partition boundaries where defects commonly occur.

### Process

1. Identify boundaries from equivalence partitions
2. Test at minimum, just below, just above, and maximum
3. Include special values (0, empty, null)

### Example: Age Validation (18-65)

| Boundary | Test Values | Expected |
|----------|-------------|----------|
| Below minimum | 17 | Reject |
| At minimum | 18 | Accept |
| Above minimum | 19 | Accept |
| Normal | 40 | Accept |
| Below maximum | 64 | Accept |
| At maximum | 65 | Accept |
| Above maximum | 66 | Reject |

**Extended Boundaries**:

- 0 (edge case)
- -1 (negative)
- MAX_INT (overflow)
- null (missing)

## Decision Table Testing

Test complex business rules with multiple conditions systematically.

### Process

1. Identify conditions (inputs)
2. Identify actions (outputs)
3. Create table with all condition combinations
4. Simplify using "don't care" conditions

### Example: Discount Calculation

**Conditions**:

- Is member? (Y/N)
- Order > $100? (Y/N)
- Has coupon? (Y/N)

| Rule | Member | Order>$100 | Coupon | Member% | Bulk% | Coupon% |
|------|--------|------------|--------|---------|-------|---------|
| R1 | Y | Y | Y | X | X | X |
| R2 | Y | Y | N | X | X | - |
| R3 | Y | N | Y | X | - | X |
| R4 | Y | N | N | X | - | - |
| R5 | N | Y | Y | - | X | X |
| R6 | N | Y | N | - | X | - |
| R7 | N | N | Y | - | - | X |
| R8 | N | N | N | - | - | - |

## State Transition Testing

Test systems with distinct states and transitions between them.

### Process

1. Identify states
2. Identify valid transitions
3. Create state transition table/diagram
4. Design tests for each transition
5. Include invalid transition tests

### State Transition Table

| Current State | Event | Next State | Valid |
|---------------|-------|------------|-------|
| Draft | submit | Pending | ✓ |
| Draft | approve | - | ✗ |
| Pending | approve | Approved | ✓ |
| Pending | reject | Rejected | ✓ |
| Approved | ship | Shipped | ✓ |
| Shipped | deliver | Delivered | ✓ |
| Delivered | * | - | ✗ |

**Always test invalid transitions** — terminal states, out-of-order events, concurrent state changes.

## Pairwise Testing

Efficiently test combinations when full combinatorial testing is impractical.

### Concept

Most defects are caused by interactions between 2 parameters. Testing all pairs covers most risks with fewer tests.

### Example: Browser Compatibility

**Parameters**:

- Browser: Chrome, Firefox, Safari, Edge
- OS: Windows, macOS, Linux
- Version: Latest, Previous

Full combinations: 4 × 3 × 2 = 24 tests
Pairwise coverage: 8-12 tests (covers all pairs)

Use tools like PICT, AllPairs, or online generators.

## Error Guessing

Experience-based technique to identify likely defect areas.

### Common Error Patterns

| Category | Examples |
|----------|----------|
| **Null/Empty** | null input, empty string, empty collection |
| **Boundaries** | off-by-one, overflow, underflow |
| **Format** | invalid date, malformed email, wrong encoding |
| **State** | race conditions, stale data, concurrency |
| **Resources** | memory exhaustion, connection limits, timeouts |
| **Security** | SQL injection, XSS, path traversal |

### Error Guessing Checklist

- [ ] What if input is null?
- [ ] What if input is empty?
- [ ] What if input contains special characters?
- [ ] What if input exceeds maximum length?
- [ ] What if concurrent requests occur?
- [ ] What if external service fails?
- [ ] What if database connection drops?
- [ ] What if input is negative?
- [ ] What if list has duplicates?

## State Combination Testing

For operations that interact with external components (queues, K8s, storage, databases), the untested gap is not individual states but their **combinations**: what the system does when internal state X meets external state Y.

### When to Apply

Trigger this technique after completing EP/BVA/pairwise design. Run the 3-question check:

1. Does this operation call an external component?
2. Does it branch on state (internal or external)?
3. Have I covered the mid-flight mutation catalog?

If any answer is yes, proceed with the steps below.

### Step 1 — Discover State Candidates

**Internal state**: grep for conditional usage — `switch resource.State`, `if status ==`, proto enum comparisons. Only states that affect branching matter.

**External state**: trace external client calls in the operation — k8s client, queue publish/consume, storage get/put. For each call site, enumerate what state that component can be in at call time.

**Retrospective**: review past bugs with the signature "worked in isolation, failed under sequence Y" — add their state combinations to the inventory.

### Step 2 — Build the Combination Matrix

For each operation, construct the matrix of internal × external state combinations and mark coverage:

```text
Operation: RunJob

Internal state    | External (K8s)      | Tested?
------------------|---------------------|--------
Pending           | No prior pod        | ✓
Pending           | Stale pod exists    | ✗
Running           | Pod running         | ✓
Running           | Pod evicted         | ✗
Cancelling        | Pod running         | ✗
Cancelling        | Pod already gone    | ✗
```

Untested cells are test candidates.

**Reducing the matrix.** This is a 2-factor product (internal × external), so pairwise does **not** apply — all-pairs of two factors *is* the full Cartesian product. The reducers for two factors are:

- **Impossibility pruning** — drop combinations that cannot physically occur. The matrix above is already pruned: a 3×3 product would have 9 cells, but `Pending + Pod running` is absent because no pod exists before the job starts. Make this pruning explicit so reviewers can challenge it.
- **Equivalence collapse** — merge external states that drive the identical code branch into one representative cell.

Pairwise re-enters only when a **third factor** appears (operation variant, caller permission, retry count) — then apply the Pairwise technique above to the three+ factors.

### Step 3 — Set Up External State (Static Combinations)

Use real components. Force the external component into the target state via its own API before the SUT runs:

- K8s: create/delete/evict pods and jobs via the k8s client before calling the controller
- Queue: pre-populate or drain the queue before the operation starts
- Storage: seed or wipe specific keys in RocksDB before the test

### Step 4 — Mid-Flight Mutation Catalog

For each case, triage reproducibility before writing the test:

| # | Case | Reproducible? | Tier |
|---|------|---------------|------|
| 1 | Pod evicted while job runs | Yes — eviction API | integration |
| 2 | Node failure under running pod | Hard — single-node k3s | accept-as-risk |
| 3 | Job deleted externally during watch | Yes — concurrent delete client | integration |
| 4 | Queue message re-queued (visibility timeout) | Yes — fake clock advance | integration |
| 5 | Queue consumer crashes mid-message | Yes — context cancel | integration |
| 6 | Concurrent operation modifies same resource | Yes — parallel goroutines | integration |
| 7 | Network partition to external component | Partial — fault injection wrapper | integration |
| 8 | Lease/lock expires while held | Yes — fake clock advance | integration |
| 9 | Capacity exhausted while operation waits | Yes — reduce quota mid-flight | integration |
| 10 | External component restarts mid-operation | Hard — timing sensitive | e2e smoke |
| 11 | Resource deleted by concurrent client | Yes — two racing clients | integration |
| 12 | Config change applied during operation | Depends on hot-reload support | e2e smoke |

**Triage rules:**
- `reproducible` → write as integration test
- `hard` → evaluate cost; if high-impact, invest; otherwise accept-as-risk with a comment
- `accept-as-risk` → document explicitly; do not silently skip

**Injection mechanism** — pick by trigger type, never wall-clock sleep:

- **Call-boundary events** (eviction, external delete, partition): wrap the external client with an interceptor that triggers the change on the Nth call or after a condition. Deterministic, no production hooks. Pattern: `util/minet/nettest/RoundTripper`.
- **Time-based events** (visibility timeout, lease/lock expiry): advance a fake/injectable clock — do not `sleep`. Wall-clock sleep is flaky and is only a last-resort fallback when no clock seam exists.

### Step 5 — Assert with Two Oracles

**State inspection**: after the operation completes, read back all affected state — resource status, queue depth, K8s job state — not just the return value.

**Invariant assertions**: define system-level invariants that must hold regardless of state combination and assert them after every sequence:

```text
Examples:
- A deleted resource must never appear in a list response
- A failed job must never leave a running pod behind
- A cancelled operation must release all acquired leases
- A re-queued message must be processed exactly once
```

Invariants survive code changes without needing per-test updates. They catch cross-cutting violations that no single operation's author thought to assert.

### Scope

- **Integration tests**: own the full combination matrix — real components, controlled setup
- **E2e smoke tests**: cover the 2-3 highest-risk mid-flight cases (pod eviction, concurrent deletion) where fidelity gaps are most likely

## Technique Selection Guide

| Scenario | Recommended Technique |
|----------|-----------------------|
| Range validation | Boundary Value + Equivalence |
| Complex business rules | Decision Table |
| State-dependent behavior | State Transition |
| Multi-parameter input | Pairwise |
| Error handling | Error Guessing |
| Critical calculations | All techniques combined |
| External component interaction | State Combination Testing |
| Stateful operations with side effects | State Combination Testing |

## Integration Points

**Inputs from**:

- Requirements → Test conditions
- `test-set-create` skill → Coverage targets

**Outputs to**:

- `test-set-write` skill → Scenario coverage
- `test-bdd` skill → BDD scenario shaping

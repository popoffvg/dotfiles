---
name: test-bdd
description: Guide for designing integration and e2e tests using BDD (Behavior-Driven Development) methodology with Cucumber-style Given/When/Then scenarios. Use when writing or reviewing tests for any service, API, or component. Language-agnostic — covers scenario structure, step notation, assertion principles, async patterns, and common anti-patterns.
---

# BDD Test Design

## Cucumber Notation

Every test scenario is expressed in **Given / When / Then** steps:

| Keyword | Purpose |
|---------|---------|
| `Given` | Precondition — system state before the action |
| `When`  | Action or event that triggers the behavior |
| `Then`  | Expected observable outcome |
| `And`   | Continuation of the previous step type |
| `But`   | Negative continuation (e.g. "But it should NOT appear in the list") |

---

## Scenario Structure

Each test starts with a plain-English scenario block, then each step appears as a labeled section in the implementation:

```
Scenario: User deletes a resource

  Given a resource exists
  When the user deletes it
  Then the resource no longer exists
  And no error is returned
```

Implementation mirrors the scenario exactly:

```
// Given a resource exists
id = createResource(name)

// When the user deletes it
err = client.delete(id)

// Then the resource no longer exists
exists = client.exists(id)
assert exists == false, "resource was deleted — why does it still exist?"

// And no error is returned
assert err == nil
```

---

## Multi-step Scenarios

Break complex flows into numbered sub-steps when a single Given/When/Then isn't enough:

```
Scenario: Concurrent updates converge

  Given two clients connected to the same resource
  When both clients update the same field simultaneously
  Then one update succeeds
  And the other receives a conflict error
  And the final state reflects exactly one of the two updates
```

Use numbered labels in code when there are multiple actions or checks within one keyword:

```
// When both clients update simultaneously
//  1. Client A writes value "foo"
//  2. Client B writes value "bar"
```

---

## Assertions

**Always attach a message explaining the business invariant** — not a restatement of the check:

```
# Bad
assert exists == false, "exists is false"

# Good
assert exists == false, "resource was just deleted — it must not be retrievable anymore"
```

Assert at the right granularity:
- One `Then` per observable outcome
- Don't bundle unrelated checks into a single assertion
- Prefer specific matchers: `equal`, `contains`, `has_length` over generic `is_true`

---

## Test Isolation

Each scenario must be fully independent:

- **Create fresh data** per scenario — never share state between tests
- **Use random identifiers** — never hardcode names like `"test-user"` (causes coupling)
- **Clean up after yourself** — delete everything created, even on failure
- **No order dependency** — any scenario must pass when run alone

```
# Bad — hardcoded name, shared state
Given the user "admin" exists

# Good — isolated, random
Given a user exists with a unique generated name
```

---

## Async Behavior

Never assert on eventual state immediately after triggering an action.

```
# Bad
When the job is submitted
Then the result is available   ← races if result isn't instant

# Good
When the job is submitted
And the system processes it
Then the result is available
```

In implementation: **subscribe/listen before triggering**, then wait for the event:

```
# 1. Set up the listener FIRST (avoid the race)
listener = subscribe(resource, event: "ready")

# 2. Trigger
submit(job)

# 3. Wait with a hard timeout — never sleep
result = listener.wait(timeout: 5s)
assert result != nil, "job did not complete within 5s"
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Feature | Noun phrase describing capability | `Resource Lifecycle`, `User Authentication` |
| Scenario | Present-tense statement of behavior | `User deletes a resource`, `Expired token is rejected` |
| Step | Starts with Given/When/Then + active verb | `Given the service is running`, `When a request is sent` |

---

## Scenario Design Checklist

For each new test scenario:

1. **One behavior per scenario** — if you need "and also", consider splitting.
2. **Scenario title is the spec** — it should read as documentation.
3. **Given sets up state, not the system** — infrastructure setup belongs in test setup, not `Given`.
4. **Then checks outcomes, not implementation** — test observable behavior, not internal calls.
5. **Cover the unhappy path** — add a sibling scenario for the failure case.

---

## Anti-patterns

| Don't | Do instead |
|-------|-----------|
| `sleep(500ms)` to wait for async | Subscribe to event or poll with timeout |
| Hardcoded identifiers like `"test-item"` | Generate unique random names per scenario |
| Assertions without messages | Always explain the invariant |
| Missing cleanup | Teardown every created resource, even on failure |
| One giant scenario covering many behaviors | One scenario per behavior |
| Testing implementation details | Test observable outcomes only |
| Sharing state between scenarios | Each scenario sets up its own preconditions |

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

## Output format

Always produce a `.feature` file — never embed Gherkin inside a Markdown document.

Place the file in `<notes-dir>/features/<feature-name>.feature`. If the notes dir has no
`features/` subdirectory, create it.

---

## Ops / manual scenarios

The "business language, not technical terms" rule applies to **user-facing app tests**.
For **operator runbooks** — backend startups, CLI flag changes, infra config — the
operator's business language IS the shell command. In these scenarios:

- Embed the literal CLI invocation in a `"""sh` docstring on the `When` step.
- `Then` steps stay declarative (what the operator observes), not imperative.
- Use `Background` for shared setup (build step, credential fetch, seed data creation).

```gherkin
When the backend starts without the library flag
  """sh
  ./platforma \
    --main-root ~/data \
    --master-secret-file ~/secret.txt
  """
Then the library is absent from the library list
```

For multi-line shell commands in docstrings, always annotate with `"""sh` (not bare `"""`).
This signals intent and enables syntax highlighting in editors that support it.

### Pinning concrete values

An ops scenario is only as trustworthy as the values it embeds. When you pin a flag, id,
endpoint, dataset, or secret:

- **Verify every external identifier against its authoritative source — never guess from a
  label.** A preset id, CLI flag, or resource name must be confirmed (fetch the tool's docs,
  read the flag definition, grep the source). "Takara Bio v2" is a label; `takara-human-rna-tcr-umi-smarter-v2`
  is the id. Pin the exact string and cite where it was verified.
- **Pin infra coordinates from the live deploy config, not a sibling runbook.** Namespace,
  bucket, endpoint, secret name — read the actual `values-*.yaml` / manifest, which may have
  drifted from a doc that copied it. (A doc said `-n platforma`; the deploy was `-n platforma-e2e`.)
- **Cross-check pinned data against the tool that consumes it.** A dataset and a preset/tool
  must share format and chemistry. A 10x single-cell dataset under a bulk-TCR preset fails for
  the *wrong* reason and muddies the signal. When two pinned values contradict, stop, flag it,
  ask which is authoritative, then align the other to it.
- **Never inline a live secret.** Embed a fetch recipe in `Background` (e.g.
  `kubectl get secret … -o jsonpath=… | base64 -d` into a shell var) and reference the secret by
  name. The `.feature` file is committed; the credential must not be.

### Link each step to its coverage

A manual/e2e step should name the automated test that covers it, or mark the gap explicitly. A
step with neither reads as "covered" when it isn't:

```gherkin
And importing into a frozen library returns a frozen error
  # e2e: …/import_frozen_library_test.go:36 TestImportGate_FrozenLibrary_RejectsImport
And the existing blob is still downloadable
  # e2e: no automated counterpart yet — gap. Manual only.
```

---

## Hardest happy path

For every feature, identify the **hardest happy path**: the single scenario that chains
the most behaviors, crosses the most system boundaries, and uses real infrastructure values.
This becomes the mandatory pre-merge manual test.

Criteria for "hardest":
- Requires multiple sequential restarts or state transitions.
- Uses real credentials / endpoints, not mocks.
- Exercises the main failure-recovery path (e.g. freeze → re-activate, rotation → re-open).
- Every intermediate state is independently observable (can be checked before the next step).

**Prove an invariant by exercising a real downstream consumer, not by asserting it directly.**
To show "downloads survive a freeze", run a real block (e.g. MiXCR) that pulls the blobs — its
success *is* the proof, and it gives a stronger, less manual signal than a bare "re-download
succeeds" check. Pick a consumer whose data path crosses the boundary under test.

Put it first in the `.feature` file and mark it in the strategy doc.

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
| Gherkin in a Markdown file | Write a `.feature` file in `<notes-dir>/features/` |
| Bare `"""` for shell docstrings | Annotate with `"""sh` |
| Guessing an external id from a label | Verify the exact id against docs/source, pin it, cite where |
| Inlining a live credential in the feature | Embed a fetch recipe; reference the secret by name |
| Pinned data that mismatches the consuming tool | Cross-check format/chemistry; flag contradictions, align to the authoritative side |
| Infra coordinates copied from a sibling doc | Read the live deploy config (`values-*.yaml`/manifest) |
| Manual step with no test link and no gap marker | Link the e2e test, or mark "gap — manual only" |

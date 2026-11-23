# TODO-1 — tests

**Design:** [TODO-1.md](TODO-1.md) — Outcome, Components, Flow changes, Increments and their commits.

> A filled `<notes-dir>/todos/TODO-N.test.md` — **the test file of the row**. It holds one section, `## Autotest`, and nothing else. Copy the shape and delete the `>` lines, except the `> **Check:**` line under each level, which the copy keeps (the **Rules every section shares** note in `examples/todo.md`).
>
> **No budget.** No line count applies here: one case per promise the Outcome makes, however many that is. A case left out to keep the file short is a promise nobody tests. `budget-check.py` checks this file only for a section that belongs in another file of the row.
>
> **No frontmatter.** `status` has one home, the human half.
>
> **Read by the human at the gate, beside `TODO-N.md`.** What the change proves is a design question, so the prose follows the `i-have-adhd` rules, the same as the human half.
>
> `**Design:**` is the first line: it is the one link back to the human half.

## Autotest

### Unit

> **Check:** each case keeps one promise of the Outcome. Find the promise with no case, and the new check in `## Flow changes` with no error case.

- **Under test:** `pkg/auth.Handler.Refresh` — one refresh swaps a live token for a new pair and kills the token it replaces.
- **Target files:** `pkg/auth/handler_test.go` (create)

**Factors**

| Factor | Values | Why these values |
|---|---|---|
| `token` | live, expired, reused | the three branches of `Refresh` on the token state: rotate, 401, 409 |
| distance to expiry | far, one second | the expiry check is where an off-by-one sits: one second before expiry for a live token, one second after for an expired one |
| store write | ok, fails | the only write of the call: a failure must not leave half a rotation |

**Pairwise cases**

| Case | `token` | distance to expiry | store write | Expected |
|---|---|---|---|---|
| live-token-rotates-to-a-new-pair | live | far | ok | new pair P; P.Refresh differs from the token; the store holds P.Refresh and not the token |
| failed-write-keeps-the-old-token | live | one second | fails | the refresh fails with the store error; the store still holds the token |
| expired-token-is-refused | expired | far | fails | 401; no write is attempted |
| token-one-second-past-expiry-is-refused | expired | one second | ok | 401; the store is unchanged |
| reused-token-is-refused | reused | far | ok | 409; the store holds the pair of the first refresh only |
| reused-token-attempts-no-write | reused | one second | fails | 409; no write is attempted |

Every pair of values appears in at least one row. Excluded pairs: none.

**Added cases**

| Case | Input | Why added | Expected |
|---|---|---|---|
| unknown-token-is-refused | a token the store never held | a fourth token state; it never reaches the write, so one row is enough | 401; the store is unchanged |
| rotation-keeps-the-user | any live token (property; pinned: a token one second before expiry) | the Outcome promises the same user for every live token | P.Access names the user the token named |

- **Command:** `go test ./pkg/auth/...`

### E2E

> **Check:** each case starts where a real user or caller starts, and checks only what that user can see.

- **Under test:** `POST /auth/refresh` on the running server — a client keeps a working session across a refresh, and a retired token buys nothing.
- **Target files:** `test/e2e/auth_refresh_test.go` (create)
- **Entry point:** `POST /auth/refresh` on the running server, same as a real SDK client

**refreshed-session-keeps-working**

```text
Scenario:
  1. Log in as "u1": the server returns pair P0.
  2. Refresh with P0.Refresh: the server returns pair P1.
  3. Call GET /me with P1.Access: the call answers 200.
```

**replayed-token-fails-and-live-pair-works**

```text
Scenario:
  1. Log in as "u1": the server returns pair P0.
  2. Refresh with P0.Refresh: the server returns pair P1.
  3. Refresh with P0.Refresh again: the refresh answers 409.
  4. Call GET /me with P1.Access: the call still answers 200.
```

**expiry-ends-access-on-both-tokens**

```text
Scenario:
  1. Log in as "u1": the server returns pair P0.
  2. Wait past the 15-minute TTL.
  3. Refresh with P0.Refresh: the refresh answers 401.
  4. Call GET /me with P0.Access: the call answers 401.
```

- **Command:** `go test -tags e2e ./test/e2e/ -run TestAuthRefresh`

> **Two levels, both required.** One TODO ships the behavior *and* the proof at both scales.
>
> | Level | Proves | Scope |
> |-------|--------|-------|
> | `Unit` | the changed unit behaves, in isolation | the new/edited function, type, or component; no network, no DB, no process boundary |
> | `E2E` | the **Outcome** holds through the real entry point | the request/command enters where a user or caller enters it and the observable result is asserted |
>
> Each level carries, in this order:
>
> - **Under test** — opens the level, above **Target files**: the symbol or symbols the level exercises, then one clause naming the behaviour the whole block proves.
> - **Target files** — the test file path, `create` if new.
> - **Entry point** — `E2E` only: where the request or command enters, named as a caller enters it (`POST /auth/refresh` on the running server), so each case asserts the Outcome as an observer sees it rather than as the implementation sees it.
> - **Cases** — `Unit`: the **Factors**, **Pairwise cases**, and **Added cases** tables. `E2E`: one bold case name per case, each followed by its fenced `Scenario:` block.
> - **Command** — one runnable shell command, closing the level. Never "run the relevant tests".
>
> **Unit cases are the rows of a readable pairwise table.** The factor is an input of the symbol under test; the values are words; every row sets every factor; the line under the table states the pairwise property and the excluded pairs. **Added cases** holds what pairwise cannot find: boundary values outside the factor values, the shape of a fixed bug, a property. A property row names its domain in `Input`: `any <domain> (property; pinned: <known edges>)`. The table rules are `test-suite:ref-readable-output.md` § The unit tier ships its pairwise table.
>
> **E2E cases are numbered scenarios.** One step is one action of one actor, in run order. A checked step ends with a colon and the observable result; a setup step has no colon; the last step checks the outcome the case exists for. Three to seven steps. The test function copies the block verbatim as its doc comment. The scenario rules are `test-suite:ref-readable-output.md` § Integration and E2E cases are numbered scenarios.
>
> Every case traces to the Outcome or to a generated rule this TODO can violate, both directions — an Outcome promise with no case is a coverage gap, a case the Outcome never made is scope creep.
>
> **Cases, never the test.** This is the only place a test appears in the pair, and it appears as words: no assertion source, no fixture, no code literal, no shell. A test that *cannot* be written from the case means the case is too vague, and the fix is a sharper sentence, not a paste. When the test file itself is the deliverable, it is an increment with a contract block and **Surprises** in `TODO-N.md` § Increments.
>
> A level that genuinely cannot exist is written `none — <one-line concrete reason>`, and the reason names what makes it impossible. Auto-reject: "covered by the unit test", "trivial", "no e2e harness" (name the missing harness and add a TODO for it instead). A pure refactor may set `E2E: none — no observable behavior changes; unit suite pins the reshaped API`, but only when the Outcome itself claims no new capability.
>
> A TODO whose Outcome is not observable end-to-end alone defers: `none — observable only via TODO-3; its E2E case asserts this path`. Three rules bind that deferral:
>
> - **The named TODO must exist in the ledger**, and its `## Autotest` `E2E` must carry a case that asserts this path. A deferral to a TODO whose E2E never mentions it is an untested path with a citation.
> - **Deferring to a Manual test does not count.** `Manual test` catches what no suite can see; it is not the automated cover this level claims.
> - **The shape is rare.** An enabler with one consumer is increment 1 of that consumer, so it has no `E2E` of its own to defer. What is left is the genuinely separate row: another repo, or an interface with two or more consumers.

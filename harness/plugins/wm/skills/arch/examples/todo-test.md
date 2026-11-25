# TODO-1 — tests

**Design:** [TODO-1.md](TODO-1.md) — Outcome, Components, Flow changes, Increments and their commits.

> A filled `<notes-dir>/todos/TODO-N.test.md` — **the test file of the row**. It holds one section, `## Autotest`, and nothing else. Copy the shape and delete the `>` lines, except the `> **Check:**` line under each level, which the copy keeps (the **Rules every section shares** note in `examples/todo.md`).
>
> **No budget.** No line count applies here: one case per promise the Outcome makes, however many that is. A case left out to keep the file short is a promise nobody tests. `budget-check.py` checks this file only for a section that belongs in another file of the row.
>
> **No frontmatter.** `status` has one home, the human half.
>
> **Read by the human at the gate, beside `TODO-N.md`.** What the change proves is a design question, so the prose follows the ASD-STE100 rules, the same as the human half.
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
| `distance` | far, one second | the expiry check is where an off-by-one sits: one second before expiry for a live token, one second after for an expired one |
| `write` | succeeds, fails | the only write of the call: a failure must not leave half a rotation |

**Pairwise cases**

```gherkin
@unit
Scenario Outline: refresh-by-token-state
  Given a <token> refresh token <distance> from its expiry
  And the store write <write>
  When the handler refreshes with the token
  Then <expected>

  Examples:
    | case                                    | token   | distance   | write    | expected                                                                     |
    | live-token-rotates-to-a-new-pair        | live    | far        | succeeds | it returns a new pair "P", and the store holds the refresh token of "P" only |
    | failed-write-keeps-the-old-token        | live    | one second | fails    | the refresh fails with the store error, and the store still holds the token  |
    | expired-token-is-refused                | expired | far        | fails    | the refresh answers 401, and no write is attempted                           |
    | token-one-second-past-expiry-is-refused | expired | one second | succeeds | the refresh answers 401, and the store is unchanged                          |
    | reused-token-is-refused                 | reused  | far        | succeeds | the refresh answers 409, and the store holds the pair of the first refresh   |
    | reused-token-attempts-no-write          | reused  | one second | fails    | the refresh answers 409, and no write is attempted                           |
```

Every pair of values appears in at least one row. Excluded pairs: none.

**Added cases**

```gherkin
@unit
Scenario: unknown-token-is-refused
  Given a refresh token that the store never held
  When the handler refreshes with the token
  Then the refresh answers 401
  And the store is unchanged

@unit
Scenario: rotation-keeps-the-user
  Given any live refresh token of the user "u1", pinned at one second before its expiry
  When the handler refreshes with the token
  Then the access token of the new pair names the user "u1"
```

- **Command:** `go test ./pkg/auth/...`

### E2E

> **Check:** each case starts where a real user or caller starts, and checks only what that user can see.

- **Under test:** `POST /auth/refresh` on the running server — a client keeps a working session across a refresh, and a retired token buys nothing.
- **Target files:** `test/e2e/auth_refresh_test.go` (create)
- **Entry point:** `POST /auth/refresh` on the running server, same as a real SDK client

```gherkin
@e2e
Scenario: refreshed-session-keeps-working
  Given "u1" logged in and the server returned the pair "P0"
  When the client refreshes with the refresh token of "P0"
  Then the server returns the pair "P1"
  And GET /me with the access token of "P1" answers 200

@e2e
Scenario: replayed-token-fails-and-live-pair-works
  Given "u1" refreshed the pair "P0" and the server returned the pair "P1"
  When the client refreshes with the refresh token of "P0" again
  Then the refresh answers 409
  And GET /me with the access token of "P1" still answers 200

@e2e
Scenario: expiry-ends-access-on-both-tokens
  Given "u1" logged in and the server returned the pair "P0"
  And the 15-minute TTL has passed
  When the client refreshes with the refresh token of "P0"
  Then the refresh answers 401
  And GET /me with the access token of "P0" answers 401
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
> - **Cases** — `Unit`: the **Factors** table, the **Pairwise cases** `Scenario Outline`, and the **Added cases** scenarios. `E2E`: one `gherkin` block of scenarios, one per case.
> - **Command** — one runnable shell command, closing the level. Never "run the relevant tests".
>
> **Every case is a Gherkin scenario in the form of `show-me` (`references/show-cases.md`)**: a slug name, the tier tag, `Given` / `When` / `Then` in business words, five steps or fewer, and a `Then` that a test can check. The test function copies the scenario verbatim as its doc comment.
>
> **Unit cases are the rows of a pairwise `Scenario Outline`.** The **Factors** table comes first: a factor is an input of the symbol under test, and its values are words. The outline has one `Examples` row per case, a `case` column with the slug, one column per factor, and an `expected` column. Every row sets every factor; the line under the block states the pairwise property and the excluded pairs. **Added cases** holds what pairwise cannot find: boundary values outside the factor values, the shape of a fixed bug, a property. A property scenario names its domain in its `Given`: `any <domain>, pinned at <known edges>`. The rules are `test-suite:ref-readable-output.md` § The unit tier ships its pairwise outline.
>
> **E2E cases start where a real caller starts.** The `Given` is the state a user or a client builds through the entry point, the `When` is one call of the entry point, and the `Then` is what that caller sees. The rules are `test-suite:ref-readable-output.md` § Integration and E2E cases are scenarios.
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

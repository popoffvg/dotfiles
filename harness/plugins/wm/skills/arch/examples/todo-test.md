# TODO-1 — tests

**Design:** [TODO-1.md](TODO-1.md) — Outcome, Components, Surface, Flow changes, Commit.

> A filled `<notes-dir>/todos/TODO-N.test.md` — **the test file of the row**. It holds one section,
> `## Autotest`, and nothing else. Copy the shape and delete the `>` lines.
>
> **No budget.** No line count applies here: one case per promise the Outcome makes, however many
> that is. A case left out to keep the file short is a promise nobody tests. `budget-check.py`
> checks this file only for a section that belongs in another file of the row.
>
> **No frontmatter.** `status` has one home, the human half.
>
> **Read by the human at the gate, beside `TODO-N.md`.** What the change proves is a design question,
> so the prose follows the `i-have-adhd` rules, the same as the human half.
>
> `**Design:**` is the first line: it is the one link back to the human half.

## Autotest

### Unit

- **Under test:** `pkg/auth.Handler.Refresh`, `pkg/auth.TokenMinter.mintTokens` — one refresh swaps a live token for a new pair and kills the token it replaces.
- **Target files:** `pkg/auth/handler_test.go` (create), `pkg/auth/token_test.go` (modify)

**Happy path**

```
The handler rotates a live token

  H is a handler over an empty in-memory store. T is a live refresh token H has stored.

  Case a rotation mints one new pair (T is any unexpired token; pinned: a token at its TTL boundary):
    refresh with T, which gives pair P
    Then P.Refresh differs from T
    And the store holds P.Refresh and no longer holds T

  Case the pair carries the same user:
    refresh with T, which gives pair P
    Then P.Access names the user T named

The minter

  Case a mint signs both tokens:
    mint for user "u1", which gives pair P
    Then P.Access and P.Refresh each verify against the signing key
    And P.Refresh expires 15 minutes after the mint
```

**Error cases**

```
Every refused refresh leaves the store as it was.

  Case an expired token:
    T is past its 15-minute TTL
    refresh with T
    Then the refresh fails with 401
    And the store is unchanged

  Case a reused token:
    refresh with T, which gives pair P
    refresh with T again
    Then the second refresh fails with 409
    And the store holds P.Refresh only

  Case an unknown token:
    refresh with a token the store never held
    Then the refresh fails with 401
```

- **Command:** `go test ./pkg/auth/...`

### E2E

- **Under test:** `POST /auth/refresh` on the running server — a client keeps a working session across a refresh, and a retired token buys nothing.
- **Target files:** `test/e2e/auth_refresh_test.go` (create)
- **Entry point:** `POST /auth/refresh` on the running server, same as a real SDK client

**Happy path**

```
A refreshed session keeps working.

  C is a client logged in as "u1", which gives pair P0.

  Case the returned pair authorizes the next call:
    POST /auth/refresh with P0.Refresh, which gives pair P1
    GET /me with P1.Access
    Then the call answers 200
```

**Error cases**

```
Reuse and expiry end the stale pair, never the live session.

  Case a replayed token fails and the live pair still works:
    POST /auth/refresh with P0.Refresh, which gives pair P1
    POST /auth/refresh with P0.Refresh again
    Then the second refresh answers 409
    And GET /me with P1.Access answers 200

  Case expiry ends access on both tokens:
    wait past the 15-minute TTL
    POST /auth/refresh with P0.Refresh
    Then the refresh answers 401
    And GET /me with P0.Access answers 401
```

- **Command:** `go test -tags e2e ./test/e2e/ -run TestAuthRefresh`

> **Two levels, both required.** One TODO ships the behavior *and* the proof at both scales — that is
> what makes it self-contained. Neither level is optional by default. What the change *proves* is a
> design question the reviewer answers at the gate: a capability nobody can assert is a capability
> nobody agreed to.
>
> | Level | Proves | Scope |
> |-------|--------|-------|
> | `Unit` | the changed unit behaves, in isolation | the new/edited function, type, or component; no network, no DB, no process boundary |
> | `E2E` | the **Outcome** holds through the real entry point | the request/command enters where a user or caller enters it and the observable result is asserted |
>
> Each level carries, in this order:
>
> - **Under test** — opens the level, above **Target files**: the symbol or symbols the level
>   exercises, then one clause naming the behaviour the whole block proves. A reader knows what is
>   verified before reading a single case.
> - **Target files** — the test file path, `create` if new.
> - **Entry point** — `E2E` only: where the request or command enters, named as a caller enters it
>   (`POST /auth/refresh` on the running server), so each case asserts the Outcome as an observer sees
>   it rather than as the implementation sees it.
> - **Cases** — **two groups, always**: a bold `**Happy path**` paragraph and a bold `**Error cases**`
>   paragraph, each followed by one fenced block. Happy path holds the successes, including a success
>   that must stay unchanged; error cases hold the refusals and the error codes. Omit a group that
>   would be empty.
> - **Command** — one runnable shell command, closing the level. Never "run the relevant tests".
>
> **The fenced block reads top-down as scenarios.** Each scenario is one unindented line naming what
> it proves, then an optional two-space setup line that binds the names the cases use (`H is a
> handler over an empty in-memory store`), then its cases. Cases of one scenario share its setup.
> A second scenario starts a new unindented line in the same block.
>
> **Each case is `Case <what it proves>:` followed by its steps, four spaces in.** A step line is a
> plain sentence in run order; a step that produces a value binds it with `, which gives <name>`.
> The outcome lines open with `Then`, and every further outcome with `And`. One step, one line —
> never a chain joined by `;` or `→`. A case over several inputs writes `for each <value> in …:` and
> indents the steps under it two more spaces.
>
> **A property is a case whose label carries its domain.** When the case has algebraic shape (round
> trip, inverse, idempotence, invariant — catalog in `test-suite:ref-property-based.md`), the label
> ends with `(<name> is any <domain>; pinned: <known edges>)` and the steps state the law once. The
> pinned edges are that case's examples; no separate case repeats them.
>
> Every case traces to the Outcome or to a generated rule this TODO can violate, both directions —
> an Outcome promise with no case is a coverage gap, a case the Outcome never made is scope creep.
>
> **Cases, never the test.** This is the only place a test appears in the pair, and it appears as
> sentences: no assertion source, no fixture, no table of literal expected values, no shell. A test
> that *cannot* be written from the case means the case is too vague, and the fix is a sharper
> sentence, not a paste. When the test file itself is the deliverable, it is an increment with a
> **Behavior** sketch in the agent half.
>
> A level that genuinely cannot exist is written `none — <one-line concrete reason>`, and the reason
> names what makes it impossible. Auto-reject: "covered by the unit test", "trivial", "no e2e harness"
> (name the missing harness and add a TODO for it instead). A pure refactor may set `E2E: none — no
> observable behavior changes; unit suite pins the reshaped API`, but only when the Outcome itself
> claims no new capability.
>
> A TODO whose Outcome is not observable end-to-end alone defers: `none — observable only via TODO-3;
> its E2E case asserts this path`. Three rules bind that deferral:
>
> - **The named TODO must exist in the ledger**, and its `## Autotest` `E2E` must carry a case that
>   asserts this path. A deferral to a TODO whose E2E never mentions it is an untested path with a
>   citation.
> - **Deferring to a Manual test does not count.** `Manual test` catches what no suite can see; it is
>   not the automated cover this level claims.
> - **The shape is rare.** An enabler with one consumer is increment 1 of that consumer, so it has no
>   `E2E` of its own to defer. What is left is the genuinely separate row: another repo, or an
>   interface with two or more consumers.

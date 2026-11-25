# `POST /auth/refresh` — test set

> A filled test set. Replace its content, then remove its `>` lines. See [`ref-readable-output.md`](../references/ref-readable-output.md).

## The function

```text
refresh(request) -> tokens | rejection

  in      token       the refresh token the client sends
          session     the stored session that token points at
  reads   redis       the session store, keyed by token id
  returns tokens      a fresh access + refresh pair
          rejection   an HTTP status and a reason, no body
  writes  redis       deletes the key of the old token, stores the new one
```

Source: `pkg/auth/handler.go`, `RefreshHandler.ServeHTTP`.

> See [Distill the system to a function](../references/ref-readable-output.md#distill-the-system-to-a-function).

## Unit cases

Technique: pairwise over `token` × `length` × `session`, plus boundary values on `length`.

### Factors

| Factor | Values | Why these values |
|---|---|---|
| `token` | live, expired, malformed | each value takes one branch of the handler: rotate, reject at the expiry check, reject at the parse |
| `length` | normal, at max length | the length check is where an off-by-one sits |
| `session` | present, absent | an absent session answered 500 before the fix for #1234 |

> **One row per input that varies.** The factor is an input name from the function block, and it is also the outline column and the `<placeholder>`. Two to four values, each a word a reader understands without the code. `Why these values` names the branch or limit each value reaches.

### Pairwise cases

```gherkin
@unit
Scenario Outline: refresh-by-token-state
  Given a <token> refresh token of <length> length
  And the session of the token is <session>
  When the handler refreshes with the token
  Then <expected>

  Examples:
    | case                                        | token     | length        | session | expected                                                                       |
    | rotation-issues-a-new-pair                  | live      | normal        | present | the answer is 200 with a new pair, and the old key is gone from the mock store |
    | missing-session-is-401-not-500              | live      | at max length | absent  | the answer is 401, and the handler does not panic                              |
    | expired-token-is-rejected-before-the-lookup | expired   | normal        | absent  | the answer is 401 "token expired", and the mock store records no call          |
    | expired-token-leaves-the-session-alone      | expired   | at max length | present | the answer is 401 "token expired", and the mock store records no call          |
    | malformed-token-never-reaches-redis         | malformed | normal        | present | the answer is 400, and the mock store records no call                          |
    | malformed-long-token-never-reaches-redis    | malformed | at max length | absent  | the answer is 400, and the mock store records no call                          |
```

Every pair of values appears in at least one row. Excluded pairs: none.

> **One row per unit test.** The `case` cell is the slug; the other headers are the factor names, and the cells are the words of the Factors table. Every row sets every factor: a malformed token still sets `session`, and `expected` shows that the store is never read. The line under the block states the pairwise property and every excluded pair with its reason.

### Added cases

```gherkin
@unit
Scenario: token-one-byte-over-max-is-400
  Given a live refresh token one byte longer than the max length
  When the handler refreshes with the token
  Then the answer is 400 "token too long"
  And the mock store records no call

@unit
Scenario: replayed-token-is-401
  Given the token of rotation-issues-a-new-pair was refreshed once
  When the handler refreshes with the same token again
  Then the answer is 401
  And the mock store holds only the new key
```

> **The cases pairwise cannot find**: boundary values outside the factor values, the shape of a fixed bug, a suspected three-way interaction, a property. The `Given` names only what differs from the smoke row.

## Rotation replaces the pair and forgets the old token

A valid token with a live session is the only input that writes. The handler returns a fresh pair and deletes the key the old token pointed at. Under parallel calls only one caller may win, and a signed-in user must not notice the rotation.

```gherkin
@manual
Scenario: rotation-is-invisible-to-a-signed-in-user
  Given the access token of signed-in Alice has expired
  When Alice opens her account page
  Then she sees her account page without a sign-in prompt
  And the network panel shows one refresh between the rejected call and its retry

@integration
Scenario: rotation-elects-one-winner-under-parallel-calls
  Given Alice is signed in
  When two refreshes with the refresh token of Alice arrive at once
  Then exactly one refresh is answered 200
  And the other refresh is answered 401
  And the session store holds exactly one new refresh key
```

> **A big case is one behaviour**: a present-tense heading that names the observable result, and one paragraph. The scenarios of that behaviour follow in one `gherkin` block, each with its tier tag. See [Integration and E2E cases are scenarios](../references/ref-readable-output.md#integration-and-e2e-cases-are-scenarios).

## An expired token does not disturb a live session

The unit outline proves the rejection. This case proves it against real Redis: an expired token must not delete or change a key that is still valid on another device.

```gherkin
@integration
Scenario: expired-token-leaves-the-real-key-alone
  Given the refresh token of signed-in Alice has expired
  And her session is still live on another device
  When Alice refreshes
  Then the refresh is answered 401 with reason "token expired"
  And her session keeps its original refresh key
```

> **The `Given` is the state a caller builds, the `When` is one call, and the `Then` is what the caller sees.** A second action is a second scenario.

## The rotation is legible in the logs

An operator who traces a session must join the old key to the new one. One event per rotation carries both. A rotation that emits nothing looks the same as a rotation that never happened.

```gherkin
@manual
Scenario: rotation-emits-one-join-event
  Given the operator tails the server log
  When the operator replays the rotation call of signed-in Alice
    """sh
    curl -sS -X POST https://localhost:8443/auth/refresh \
      -H "Authorization: Bearer $REFRESH_TOKEN"
    """
  Then exactly one "auth.refresh.rotated" event is logged
  And that event carries the user id, the old key id, and the new key id
```

> **A manual case uses the same form.** The actor is the reviewer; the `Then` is what the reviewer sees.

## How it runs

- unit — `go test ./pkg/auth/...`
- integration — `go test -tags=integration ./pkg/auth/...`
- manual — a reviewer follows the two manual scenarios above before merge

> **One line per tier the document used, and the unit and integration lines are runnable commands** — the literal command, not "run the test suite". The manual line names who does what and where the steps live. A tier no case uses is left out.

## Coverage

| Requirement | Cases |
|---|---|
| A valid refresh returns a new pair | rotation-issues-a-new-pair, rotation-is-invisible-to-a-signed-in-user |
| The old refresh key is invalidated | replayed-token-is-401, rotation-emits-one-join-event |
| An expired token is rejected | expired-token-is-rejected-before-the-lookup, expired-token-leaves-the-session-alone, expired-token-leaves-the-real-key-alone |
| Malformed input never touches Redis | malformed-token-never-reaches-redis, malformed-long-token-never-reaches-redis, token-one-byte-over-max-is-400 |
| Concurrent refresh is safe | rotation-elects-one-winner-under-parallel-calls |
| A lost session is a client error | missing-session-is-401-not-500 |

> **Every requirement reaches at least one case, and every case reaches a requirement.** A case with no row is scope creep; a row with no case is a gap.

## Not covered

- Concurrency with an expired or malformed token — parallelism changes the outcome only on the path that writes, so both collapse into the single-request rejection rows.
- Redis unreachable — accepted risk here; the session-store test set owns the store outage path.

> See [Name the technique and the prunes](../references/ref-readable-output.md#name-the-technique-and-the-prunes).

## Open questions

- Does the 401 for a missing session need to differ from the 401 for an expired token? The two rows assert the same status today and would both pass a wrong implementation that swapped the branches.

> **Anything the cases could not settle**, each with the risk it leaves open. A question the author already answered belongs in the case it produced, not here.

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

Technique: pairwise over `token` × `token length` × `session`, plus boundary values on `token length`.

### Factors

| Factor | Values | Why these values |
|---|---|---|
| `token` | live, expired, malformed | each value takes one branch of the handler: rotate, reject at the expiry check, reject at the parse |
| `token length` | normal, at max length | the length check is where an off-by-one sits |
| `session` | present, absent | an absent session answered 500 before the fix for #1234 |

> **One row per input that varies.** The factor is an input name from the function block. Two to four values, each a word a reader understands without the code. `Why these values` names the branch or limit each value reaches.

### Pairwise cases

| Case | `token` | `token length` | `session` | Expected |
|---|---|---|---|---|
| rotation-issues-a-new-pair | live | normal | present | 200 with a new pair; the old key is gone from the mock store |
| missing-session-is-401-not-500 | live | at max length | absent | 401; no panic in the recovered handler |
| expired-token-is-rejected-before-the-lookup | expired | normal | absent | 401 "token expired"; the mock store records no call |
| expired-token-leaves-the-session-alone | expired | at max length | present | 401 "token expired"; the mock store records no call |
| malformed-token-never-reaches-redis | malformed | normal | present | 400; the mock store records no call |
| malformed-long-token-never-reaches-redis | malformed | at max length | absent | 400; the mock store records no call |

Every pair of values appears in at least one row. Excluded pairs: none.

> **One row per unit test.** The headers are the factor names; the cells are the words of the Factors table. Every row sets every factor: a malformed token still sets `session`, and `Expected` shows that the store is never read. The line under the table states the pairwise property and every excluded pair with its reason.

### Added cases

| Case | Input | Why added | Expected |
|---|---|---|---|
| token-one-byte-over-max-is-400 | live token one byte longer than the max | boundary max+1: the factor holds only valid lengths | 400 "token too long"; the mock store records no call |
| replayed-token-is-401 | the token of `rotation-issues-a-new-pair`, sent a second time | the delete half of rotation: one call cannot show it | 401; the mock store holds only the new key |

> **The cases pairwise cannot find**: boundary values outside the factor values, the shape of a fixed bug, a suspected three-way interaction, a property. `Input` names only what differs from the smoke row.

## Rotation replaces the pair and forgets the old token

A valid token with a live session is the only input that writes. The handler returns a fresh pair and deletes the key the old token pointed at. Under parallel calls only one caller may win, and a signed-in user must not notice the rotation.

**rotation-elects-one-winner-under-parallel-calls** *(integration)*

```text
Scenario:
  1. Sign in as Alice: the server returns refresh token R.
  2. Send two refreshes with R at the same time.
  3. Wait for both answers: one refresh answers 200, the other answers 401.
  4. Read the session store: it holds exactly one new refresh key.
```

**rotation-is-invisible-to-a-signed-in-user** *(manual)*

```text
Scenario:
  1. Sign in as Alice in the browser.
  2. Wait until the access token expires.
  3. Open the account page: the network panel shows 401, then /auth/refresh, then the retried call with 200.
  4. Watch the page: it does not flicker and does not ask for the password.
```

> **A big case is one behaviour**: a present-tense heading that names the observable result, and one paragraph. Each scenario follows as its name in bold, its tier in italics, and a numbered `Scenario:` block. See [Integration and E2E cases are numbered scenarios](../references/ref-readable-output.md#integration-and-e2e-cases-are-numbered-scenarios).

## An expired token does not disturb a live session

The unit table proves the rejection. This case proves it against real Redis: an expired token must not delete or change a key that is still valid on another device.

**expired-token-leaves-the-real-key-alone** *(integration)*

```text
Scenario:
  1. Sign in as Alice: the server returns refresh token R, and Redis holds its key K.
  2. Wait until R expires.
  3. Refresh with R: the refresh answers 401 with reason "token expired".
  4. Read K from Redis: it holds its original value.
```

> **A checked step ends with a colon and the observable result.** A setup step has no colon. The last step checks the outcome the case exists for.

## The rotation is legible in the logs

An operator who traces a session must join the old key to the new one. One event per rotation carries both. A rotation that emits nothing looks the same as a rotation that never happened.

**rotation-emits-one-join-event** *(manual)*

```text
Scenario:
  1. Tail the server log.
  2. Sign in as Alice and refresh once.
  3. Read the log: it holds exactly one "auth.refresh.rotated" event with user_id, old_kid, and new_kid.
```

> **A manual case uses the same numbered form.** The actor is the reviewer; the result after the colon is what the reviewer sees.

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

# `POST /auth/refresh` — test set

Worked example — the output shape every `/test-suite` subcommand produces. The contract is
[`references/ref-readable-output.md`](../references/ref-readable-output.md); this file shows it
applied to one handler. Copy the section order, the heading style, and the variant line format.

Note what is *absent*: there is no factor table, no pairwise matrix, and no `U-PAIR-1`. The
pairwise run over token × session × concurrency happened in scratch and produced these cases;
what it pruned is recorded in **Not covered**, in words.

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

## Rotation replaces the pair and forgets the old token

A valid token with a live session is the only input that writes. The handler returns a fresh
access + refresh pair and deletes the key the old token pointed at, so the same token replayed a
second later finds nothing. This is the behaviour the whole endpoint exists for, and the delete
is the half that a partial implementation forgets.

**rotation-issues-a-new-pair** *(unit)* — normal token, live session → the response body carries
both tokens and the old key is gone from the mock store.

**rotation-survives-a-max-length-token** *(unit)* — token at the longest accepted length → the
same pair and the same delete. Boundary value: the length check is where an off-by-one sits.

**rotation-elects-one-winner-under-parallel-calls** *(integration)* — two requests carrying the
same token at once → exactly one 200 and one 401, and real Redis holds exactly one new key.

**rotation-is-invisible-to-a-signed-in-user** *(manual)* — sign in, wait for the access token to
expire, then trigger any API call → the network panel shows 401 → `/refresh` → the retried call
returns 200, and the page never flickers or asks for the password.

## An expired token is rejected and the store is left alone

Expiry is checked against the token's own claim before the session is looked up. The caller gets
401, and no key is written or deleted — an expired token must not be able to disturb a session
that is still valid on another device.

**expired-token-is-rejected** *(unit)* — token past its expiry, session present → 401 and the
mock store records no call.

**expired-token-leaves-the-real-key-alone** *(integration)* — same input against real Redis →
401 and the key still holds its original value.

## A malformed token is rejected before the store is read

A token that does not parse short-circuits with 400. The store is never reached, so a flood of
garbage tokens cannot become load on Redis.

**malformed-token-never-reaches-redis** *(unit)* — token that fails to parse → 400, and the
store mock asserts zero calls.

## A missing session is a rejection, not a crash

A token that parses and has not expired can still point at a session that is gone — revoked,
evicted, or lost to a flush. The handler answers 401. It answered 500 before the fix for #1234,
which turned an ordinary sign-out into a paging alert.

**missing-session-is-401-not-500** *(unit)* — valid token, session absent → 401, and no panic in
the recovered handler.

## The rotation is legible in the logs

An operator tracing a session needs to join the old key to the new one. One event per rotation
carries both, and a rotation that emits nothing is indistinguishable from a rotation that never
happened.

**rotation-emits-one-join-event** *(manual)* — tail the server log while running
`rotation-issues-a-new-pair` → exactly one `auth.refresh.rotated` event carrying
`{user_id, old_kid, new_kid}`.

## How it runs

- unit — `go test ./pkg/auth/...`
- integration — `go test -tags=integration ./pkg/auth/...`
- manual — a reviewer follows the two manual variants above before merge

## Coverage

| Requirement | Cases |
|---|---|
| A valid refresh returns a new pair | rotation-issues-a-new-pair, rotation-is-invisible-to-a-signed-in-user |
| The old refresh key is invalidated | rotation-issues-a-new-pair, rotation-emits-one-join-event |
| An expired token is rejected | expired-token-is-rejected, expired-token-leaves-the-real-key-alone |
| Malformed input never touches Redis | malformed-token-never-reaches-redis |
| Concurrent refresh is safe | rotation-elects-one-winner-under-parallel-calls |
| A lost session is a client error | missing-session-is-401-not-500 |

## Not covered

- Concurrency with an expired or malformed token — parallelism only changes the outcome on the
  path that writes, so both collapse into the single-request rejection cases.
- Session state under a malformed token — the parse failure short-circuits first, so the session
  value cannot reach a branch.
- Redis unreachable — accepted risk here; the store outage path is owned by the session-store
  test set, not by this handler.

## Open questions

- Does the 401 for a missing session need to differ from the 401 for an expired token? The two
  cases assert the same status today and would both pass a wrong implementation that swapped
  the branches.

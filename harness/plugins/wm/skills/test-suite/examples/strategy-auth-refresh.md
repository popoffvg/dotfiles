# `POST /auth/refresh` — test set

> A filled test set — the output shape every `/test-suite` subcommand produces. Copy the file,
> replace the content, delete the `>` lines — each one states the rules for the piece above it.
> The five rules that cut across every piece, and the checklist to run before saving, are
> [`references/ref-readable-output.md`](../references/ref-readable-output.md).
> Sections a document does not need are dropped, not left empty. **Not covered** and
> **Open questions** are dropped only when they are truly empty, never to save space.
> Note what is *absent*: no factor table, no pairwise matrix, no `U-PAIR-1`. The pairwise run
> over token × session × concurrency happened in scratch and produced these cases; what it
> pruned is recorded in **Not covered**, in words.
> The prose follows `harness-dev:text-style`.

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

> **First section, always.** The system under test written as one function, so the reader learns
> the inputs, the state, and the results once and no case re-explains them.
> The signature, then one line per part under the four labels `in`, `reads`, `returns`, `writes`.
> The names here are the vocabulary of the whole document — every case below says `token` and
> `session` because this block does.
> Close with the `path:symbol` the function stands for, so a reader can open the real code.
> Two functions needed to describe the system → two test sets, or a TODO that does too much.

## Rotation replaces the pair and forgets the old token

A valid token with a live session is the only input that writes. The handler returns a fresh
access + refresh pair and deletes the key the old token pointed at, so the same token replayed a
second later finds nothing. This is the behaviour the whole endpoint exists for, and the delete
is the half that a partial implementation forgets.

> **One big case = one behaviour of the function**, three to seven per document. The heading is
> a full present-tense sentence naming the observable result — never `Unit cases`, `Negative`,
> or `F1 = malformed`, which name the tool instead of the behaviour.
> The paragraph under it says what happens, which inputs drive it, and why the behaviour
> matters. A reviewer who reads only the headings stops here, at the case that surprises them,
> so the paragraph has to stand alone.

**rotation-issues-a-new-pair** *(unit)* — normal token, live session → the response body carries
both tokens and the old key is gone from the mock store.

**rotation-survives-a-max-length-token** *(unit)* — token at the longest accepted length → the
same pair and the same delete. Boundary value: the length check is where an off-by-one sits.

**rotation-elects-one-winner-under-parallel-calls** *(integration)* — two requests carrying the
same token at once → exactly one 200 and one 401, and real Redis holds exactly one new key.

**rotation-is-invisible-to-a-signed-in-user** *(manual)* — sign in, wait for the access token to
expire, then trigger any API call → the network panel shows 401 → `/refresh` → the retried call
returns 200, and the page never flickers or asks for the password.

> **A variant is one runnable check, and it sits under the case it proves** — never in a
> document-wide table. One line carrying four things and nothing else: the **name** in bold, the
> **tier** in italics, the **input that differs** from its siblings, and the **oracle** after
> the arrow.
> The oracle is a value, a state, or an event a reader can observe — never "works", "succeeds",
> or "is correct". A variant whose reason is not obvious adds it in one trailing sentence, as
> the boundary-value line does.
> The name says what the case asserts, in kebab-case, and it is the identifier everywhere else:
> the **Coverage** rows, the Gherkin `@tag` (`auth-refresh.feature.md`), the test function name,
> and a review comment.
> One variant in a big case is fine. More than about six is two behaviours wearing one heading.

## An expired token is rejected and the store is left alone

Expiry is checked against the token's own claim before the session is looked up. The caller gets
401, and no key is written or deleted — an expired token must not be able to disturb a session
that is still valid on another device.

**expired-token-is-rejected** *(unit)* — token past its expiry, session present → 401 and the
mock store records no call.

**expired-token-leaves-the-real-key-alone** *(integration)* — same input against real Redis →
401 and the key still holds its original value.

> **A rejection case asserts the specific reason and the untouched state**, not "an error". The
> pair above splits the same behaviour across two tiers on purpose: the unit variant proves the
> handler makes no call, the integration variant proves the real key survives.

## A malformed token is rejected before the store is read

A token that does not parse short-circuits with 400. The store is never reached, so a flood of
garbage tokens cannot become load on Redis.

**malformed-token-never-reaches-redis** *(unit)* — token that fails to parse → 400, and the
store mock asserts zero calls.

> **A big case whose behaviour is one branch carries one variant.** Padding it with siblings
> that vary an input the branch never reaches adds rows and proves nothing.

## A missing session is a rejection, not a crash

A token that parses and has not expired can still point at a session that is gone — revoked,
evicted, or lost to a flush. The handler answers 401. It answered 500 before the fix for #1234,
which turned an ordinary sign-out into a paging alert.

**missing-session-is-401-not-500** *(unit)* — valid token, session absent → 401, and no panic in
the recovered handler.

> **A case that exists because of a real bug names the bug**, so a later reader cannot delete it
> as redundant. The regression shape of a fixed bug always earns a big case of its own.

## The rotation is legible in the logs

An operator tracing a session needs to join the old key to the new one. One event per rotation
carries both, and a rotation that emits nothing is indistinguishable from a rotation that never
happened.

**rotation-emits-one-join-event** *(manual)* — tail the server log while running
`rotation-issues-a-new-pair` → exactly one `auth.refresh.rotated` event carrying
`{user_id, old_kid, new_kid}`.

> **An event or a log line the operator depends on is a behaviour**, so it gets its own big case
> rather than a clause inside another one. Its oracle names the event and the fields it must
> carry.

## How it runs

- unit — `go test ./pkg/auth/...`
- integration — `go test -tags=integration ./pkg/auth/...`
- manual — a reviewer follows the two manual variants above before merge

> **One line per tier the document used, and the unit and integration lines are runnable
> commands** — the literal command, not "run the test suite". The manual line names who does
> what and where the steps live.
> A tier no variant uses is left out.

## Coverage

| Requirement | Cases |
|---|---|
| A valid refresh returns a new pair | rotation-issues-a-new-pair, rotation-is-invisible-to-a-signed-in-user |
| The old refresh key is invalidated | rotation-issues-a-new-pair, rotation-emits-one-join-event |
| An expired token is rejected | expired-token-is-rejected, expired-token-leaves-the-real-key-alone |
| Malformed input never touches Redis | malformed-token-never-reaches-redis |
| Concurrent refresh is safe | rotation-elects-one-winner-under-parallel-calls |
| A lost session is a client error | missing-session-is-401-not-500 |

> **The requirement column is the user's own words**, not a restatement of the case. The cases
> column names variants, so a reader checks a requirement is covered without opening the code.
> Every requirement reaches at least one case. A requirement with no case is a gap, and it
> belongs in **Not covered** with its reason instead of an empty cell.
> This is the one table the document keeps — it maps requirements to cases and derives nothing.

## Not covered

- Concurrency with an expired or malformed token — parallelism only changes the outcome on the
  path that writes, so both collapse into the single-request rejection cases.
- Session state under a malformed token — the parse failure short-circuits first, so the session
  value cannot reach a branch.
- Redis unreachable — accepted risk here; the store outage path is owned by the session-store
  test set, not by this handler.

> **Every combination the derivation pruned, with the reason: impossible, equivalent to a case
> already listed, or an accepted risk.** A silent prune reads as full coverage, so a gap listed
> here reads as intentional where a missing line reads as an oversight.
> Say what the prune loses, not that a matrix was reduced.

## Open questions

- Does the 401 for a missing session need to differ from the 401 for an expired token? The two
  cases assert the same status today and would both pass a wrong implementation that swapped
  the branches.

> **Anything the cases could not settle**, each with the risk it leaves open. A question the
> author already answered belongs in the case it produced, not here.

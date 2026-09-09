# `auth-refresh.feature` — the Gherkin bodies

> A filled `.feature` file, one piece per fenced block. Copy the fenced blocks into
> `<notes-dir>/features/<name>.feature`, replace the content, and leave the `>` lines behind —
> each one states the rules for the block above it. The procedure that produces the file is
> [`references/sub-bdd.md`](../references/sub-bdd.md); the keyword syntax is
> [`references/ref-gherkin-guide.md`](../references/ref-gherkin-guide.md).
> This file is the body half of one test set. Its map half is
> [`strategy-auth-refresh.md`](strategy-auth-refresh.md) — the same `POST /auth/refresh` handler,
> and every tag below is a variant name from it.

```gherkin
Feature: Refresh token rotation
  As a signed-in client
  I want a refresh to hand back a new pair
  So that a stolen refresh token stops working the moment I refresh
```

> **The Feature line is a noun phrase naming the capability**, then the three-line role / want /
> so-that block saying whose problem the feature solves. One `Feature` per file, and the file
> covers one system under test — the same one the map half distilled to a function.

```gherkin
Background:
  Given the auth service is running with the "auth.v2" flag on
  And a signed-in client with a unique generated account name
```

> **`Background` holds the setup every scenario in the file shares**, so no `Given` repeats it.
> Keep it to the context a reader still needs to understand the scenarios — setup hidden here
> that changes an outcome makes each scenario unreadable on its own.
> The account name is generated per scenario, never a literal `"test-user"`: a hardcoded name
> collides the moment two scenarios run at once.

```gherkin
Rule: Rotation replaces the pair and forgets the old token

  @rotation-is-invisible-to-a-signed-in-user
  Scenario: A signed-in user keeps working across an access-token expiry
    Given the client holds a valid access + refresh pair
    And the access token has expired
    When the client calls any authenticated endpoint
    Then the first call is answered 401
    And the client exchanges its refresh token for a new pair
    And the retried call is answered 200
    And the client is never sent to the login screen

  @rotation-issues-a-new-pair
  Scenario: A valid refresh returns a new pair and drops the old key
    Given the client holds a valid refresh token for a live session
    When the client refreshes
    Then the response carries a new access token and a new refresh token
    And the old refresh key is absent from the session store

  @rotation-elects-one-winner-under-parallel-calls
  Scenario: Two refreshes with the same token elect one winner
    Given the client holds a valid refresh token for a live session
    When two refreshes carrying that token arrive at once
    Then exactly one is answered 200
    And the other is answered 401
    And the session store holds exactly one new refresh key
```

> **One `Rule` per big case of the map half, and one `Scenario` per variant**, tagged with that
> variant's name. The `Rule` line repeats the big case's heading, so the two files read as one
> document and a reviewer can join them by eye.
> **The hardest happy path goes first** — the scenario that chains the most behaviours, crosses
> the most boundaries, and uses real values rather than mocks. It is the mandatory pre-merge
> manual test, and a reader who stops after one scenario should read that one.
> The tag is the joining key, so it matches the variant name character for character. A failing
> CI run prints the tag and nothing else: `@rotation-issues-a-new-pair` reports the broken
> behaviour where `@TS-STATE-013` reports a lookup task.
> One `When` per scenario names the trigger. Each `Then` asserts one observable a caller can
> see — a status, a stored value, a screen — never an internal call or a private field.

```gherkin
Rule: An expired token is rejected and the store is left alone

  @expired-token-leaves-the-real-key-alone
  Scenario: An expired refresh token disturbs nothing
    Given the client holds a refresh token past its expiry
    And the session it points at is still live
    When the client refreshes
    Then the response is 401 with reason "token expired"
    And the refresh key still holds its original value

Rule: A malformed token is rejected before the store is read

  @malformed-token-never-reaches-redis
  Scenario: A token that does not parse is refused without a store read
    Given a refresh token that fails to parse
    When the client refreshes
    Then the response is 400 with reason "malformed token"
    And the session store received no call

Rule: A missing session is a rejection, not a crash

  @missing-session-is-401-not-500
  Scenario: A token pointing at a revoked session is a client error
    Given the client holds a valid refresh token
    And its session has been revoked
    When the client refreshes
    Then the response is 401 with reason "no session"
    And the service stays up
```

> **Every rejection scenario asserts the specific reason**, not "an error" — two rejections that
> both assert only the status would pass an implementation that swapped their branches.
> A `Rule` with a single variant carries a single scenario. Adding a sibling that varies an
> input the branch never reaches adds a scenario and proves nothing.
> Each scenario sets up its own preconditions on top of `Background`, so any one of them passes
> when it runs alone, and it tears down what it created even after it failed.

```gherkin
Rule: The rotation is legible in the logs

  @rotation-emits-one-join-event
  Scenario: An operator can join the old key to the new one
    Given the server log is being tailed
    When the operator replays the rotation call
      """sh
      curl -sS -X POST https://localhost:8443/auth/refresh \
        -H "Authorization: Bearer $REFRESH_TOKEN"
      """
    Then exactly one "auth.refresh.rotated" event is logged
    And that event carries the user id, the old key id, and the new key id
```

> **An operator scenario embeds the literal command in a `"""sh` docstring on the `When` step.**
> The business language of an operator is the shell command, so the exception to
> declarative-only steps lives here — and the annotation is `"""sh`, never a bare `"""`.
> The `Then` steps stay declarative: what the operator observes, not what they type next.
> Wait on the event or poll with a timeout. A `sleep(500ms)` passes on a fast machine and flakes
> on a loaded one.

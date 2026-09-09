# `auth-refresh.feature` — the Gherkin bodies

> A filled `.feature` file. Copy its fenced blocks into `<notes-dir>/features/<name>.feature`,
> replace the content, and remove its `>` lines. See
> [`sub-bdd.md`](../references/sub-bdd.md) and
> [`ref-gherkin-guide.md`](../references/ref-gherkin-guide.md). Its map half is
> [`strategy-auth-refresh.md`](strategy-auth-refresh.md).

```gherkin
Feature: Refresh token rotation
  As a signed-in client
  I want a refresh to hand back a new pair
  So that a stolen refresh token stops working the moment I refresh
```

> See [Cucumber Notation](../references/sub-bdd.md#cucumber-notation).

```gherkin
Background:
  Given the auth service is running with the "auth.v2" flag on
  And a signed-in client with a unique generated account name
```

> See [Test Isolation](../references/sub-bdd.md#test-isolation).

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

> See [BDD Test Design](../references/sub-bdd.md#bdd-test-design),
> [Naming Conventions](../references/sub-bdd.md#naming-conventions), and
> [Hardest happy path](../references/sub-bdd.md#hardest-happy-path).

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

> See [Scenario Design Checklist](../references/sub-bdd.md#scenario-design-checklist) and
> [Test Isolation](../references/sub-bdd.md#test-isolation).

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

> See [Ops / manual scenarios](../references/sub-bdd.md#ops--manual-scenarios) and
> [Async Behavior](../references/sub-bdd.md#async-behavior).

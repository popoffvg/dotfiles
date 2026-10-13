# A filled feature file: the Gherkin body of examples/strategy-auth-refresh.md.
# Copy it to <notes-dir>/features/<area>.feature, replace the content, delete every "#" line.
# Each "#" block states the rules of the piece under it. A comment MUST start its own line.
#
# The file holds only the variants that cross a component or need a person: the integration and
# manual variants of the test set. A unit variant keeps its one line in the .md and has no body.

# Feature: one capability, named as a noun phrase. One Feature per file.
# The description says who gains what. A reader who stops after it MUST know why the file exists.
# Tags on the Feature line apply to every Example under it.
@auth-refresh
Feature: Refresh token rotation
  A signed-in client trades its refresh token for a new pair.
  A stolen refresh token stops working the moment the owner refreshes.

  # Background: the context every Example needs and a reader must see to follow it.
  # At most three Given steps. Infrastructure (a running service, a feature flag, a seeded
  # database) is test setup in the step definitions, never a Given.
  # A persona name is real data: the step definition maps "Alice" to a unique generated account,
  # so Examples running at once never share one.
  Background:
    Given Alice is signed in

  # Rule: one per big case of the .md, with the same sentence as its heading.
  # The Rule with the hardest happy path comes first: the Example that chains the most states,
  # crosses the most boundaries, and runs against real infrastructure. It is the pre-merge manual test.
  Rule: Rotation replaces the pair and forgets the old token

    # Tags: the variant name from the .md, kebab-case, and the tier, so a runner selects
    # by tier and a red CI line names the behaviour that broke.
    # Example title: the behaviour as a present-tense sentence. It reads as the spec on its own.
    # Steps: Given is a state, When is the one action, Then is what the actor can observe.
    # A Then never performs an action. One physical line per step. No apostrophe in a step.
    @rotation-is-invisible-to-a-signed-in-user @manual
    Example: An expired access token does not interrupt a signed-in user
      Given the access token of Alice has expired
      When Alice opens her account page
      Then she sees her account page without a sign-in prompt
      And the network panel shows one refresh between the rejected call and its retry

    # Five steps or fewer. When an Example needs more, it holds two behaviours: split it.
    # Use the same step text for the same state in every Example, so one step definition serves all.
    @rotation-elects-one-winner-under-parallel-calls @integration
    Example: Two refreshes with the same token elect one winner
      When two refreshes with the refresh token of Alice arrive at once
      Then exactly one refresh is answered 200
      And the other refresh is answered 401
      And the session store holds exactly one new refresh key

  # A Rule that illustrates a rejection names what stays unchanged, not only the status.
  # An HTTP status is business language here: the caller of an API reads it.
  Rule: An expired token is rejected and the store is left alone

    @expired-token-leaves-the-real-key-alone @integration
    Example: An expired refresh token leaves the live session unchanged
      Given the refresh token of Alice has expired
      And her session is still live on another device
      When Alice refreshes
      Then the refresh is answered 401 with reason "token expired"
      And her session keeps its original refresh key

  # Operator Example: for a runbook, the shell command is the business language of the operator.
  # Put it in a doc string on the When step and give the content type: """sh, never a bare """.
  # Then stays declarative: what the operator observes.
  # An asynchronous outcome needs a step that waits for it; a Then right after the action races.
  Rule: The rotation is legible in the logs

    @rotation-emits-one-join-event @manual
    Example: An operator can join the old key to the new one
      Given the operator tails the server log
      When the operator replays the rotation call of Alice
        """sh
        curl -sS -X POST https://localhost:8443/auth/refresh \
          -H "Authorization: Bearer $REFRESH_TOKEN"
        """
      Then exactly one "auth.refresh.rotated" event is logged
      And that event carries the user id, the old key id, and the new key id

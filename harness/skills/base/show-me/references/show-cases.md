# show-cases — Gherkin scenarios

Loaded by the `show-me` router for "show the test cases", "list the cases", and "describe the failure", and by every document that holds test cases: a test set, a TODO test file, a review finding.

**Every test case and every failure is a Gherkin scenario**, fenced as ` ```gherkin `, in chat and in md files. Prose such as "it breaks when the cache is stale" is not a test case and not a failure description. Write each scenario to the BRIEF checks in [`wm:test-suite` bdd](../../../../plugins/wm/skills/test-suite/references/sub-bdd.md#brief--the-six-checks-for-one-scenario). A runnable `.feature` file is that skill's job; it copies the scenarios of the md file verbatim.

## Test cases

- **Name each scenario with a slug that says the behavior**: `Scenario: save-invalidates-changed-content`. Never a serial id such as `U-PAIR-1` or `F1`. The slug is also the test function name and the tag a runner selects by.
- **Put the tier on the line above** as a tag: `@unit`, `@integration`, `@e2e`, or `@manual`.
- **`Given` is the state, `When` is one action, `Then` is what a caller can see.** Add `And` lines under any of them. One `When` per scenario: a second action is a second scenario.
- **Name a value the first time a step makes it**, in quotes, and use that name in later steps: `Then the server returns the pair "P1"`.
- **Business words only.** A status code, an event name, a command, or a reason string is allowed. A variable, a helper name, or an assertion call is not.
- **Five steps or fewer.** A scenario that needs more holds two behaviors: split it.
- **Every `Then` is an oracle**: a value, a state, or an event. Never "works" or "ok".
- **A manual case uses the same form.** The actor is the reviewer, and the `Then` is what the reviewer sees.
- **The test function copies the scenario verbatim as its doc comment**, so the document and the test read the same steps.

```gherkin
@e2e
Scenario: replayed-token-fails-and-live-pair-works
  Given Alice refreshed the pair "P0" and the server returned the pair "P1"
  When Alice refreshes with the refresh token of "P0" again
  Then the refresh answers 409
  And GET /me with the access token of "P1" still answers 200
```

## Pairwise cases

Use a `Scenario Outline` for a set of unit cases that vary the same inputs, for example the rows of a pairwise table. One `Examples` row is one test.

- The first column is `case`, and its cell is the slug of that test.
- One column per input, in the order of the inputs. The header is the input name; the cell is a value in words, never a code literal.
- The last column is `expected`, an oracle in words. `Then <expected>` reads it.
- Every row sets every input. A value that cannot reach the code is still set, and `expected` says why it does not matter ("the store is not read").
- Every column MUST be read by a `<placeholder>` in a step.

```gherkin
@unit
Scenario Outline: refresh-by-token-state
  Given a <token> refresh token of <length> length
  And the session of the token is <session>
  When the handler refreshes with the token
  Then <expected>

  Examples:
    | case                           | token     | length        | session | expected                                    |
    | rotation-issues-a-new-pair     | live      | normal        | present | the answer is 200 with a new pair           |
    | missing-session-is-401-not-500 | live      | at max length | absent  | the answer is 401 and the handler recovers  |
    | malformed-token-skips-store    | malformed | normal        | present | the answer is 400 and the store is not read |
```

## Failures

For a failure — a bug, a failing test, a review finding — `Then` says what must happen. A `# actual:` comment under it says what happened, with the `path:line` or the test that shows it.

```gherkin
@unit
Scenario: save-invalidates-changed-content
  Given the cache holds "v1" for "notes.md"
  When save writes "v2" to "notes.md"
  Then the next read of "notes.md" returns "v2"
  # actual: returns "v1" — the entry is never invalidated, src/session/cache.ts:31
```

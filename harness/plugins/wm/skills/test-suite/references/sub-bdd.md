# BDD — write the behavioural cases as Gherkin

Every case of the `.md` test set is a Gherkin scenario in the form of `show-me`
(`references/show-cases.md`). The feature file is the **runnable copy** of its integration and
manual scenarios. Read [`ref-readable-output.md`](ref-readable-output.md) first and keep the two
in step: one `Rule` per big case, and each scenario copied verbatim from the `.md`.

**The filled file is [`examples/auth-refresh.feature`](../examples/auth-refresh.feature)** — the
runnable copy of [`examples/strategy-auth-refresh.md`](../examples/strategy-auth-refresh.md). A `#` block
above each piece states the rules of that piece, and no other file repeats them. This file is the
procedure that produces it and the rules that span every piece.

## Steps

1. **Discover the examples.** Talk the feature through with whoever owns the requirement, builds
   it, and tests it, until it is stated as examples, not adjectives. Use Example Mapping: one
   card per rule, one card per example under it, one card per question nobody can answer. Done
   when every rule has at least one example and every question is in the `.md` **Open
   questions**. A feature that gives no question was not examined.
2. **Map the cards to the `.md`.** A rule card is a big case with its sentence. An example card
   is a `Scenario:` in that big case. Done when every rule card has its big case.
3. **Formulate each scenario against BRIEF** (table below), in the `.md`. Done when every scenario
   passes all six.
4. **Order the file.** The Rule that holds the hardest happy path comes first: the scenario that
   chains the most states, crosses the most boundaries, and runs against real infrastructure.
   Mark it in the `.md` as the pre-merge manual test.
5. **Write the file** to `<notes-dir>/features/<area>.feature`; create `features/` when it is
   missing. Copy each integration and manual scenario verbatim from the `.md`, under the `Rule` of
   its big case. A runner executes only this file, not the `.md`.
6. **Lint it.** Run `npx --yes gherkin-lint` in the directory that holds the file. It needs a
   `.gherkin-lintrc` there: copy one from another `.feature` directory of the repo, or write one
   that turns on `keywords-in-logical-order`, `no-unused-variables`, `no-trailing-spaces`,
   `new-line-at-eof`, and `one-space-between-tags`. Done when it reports nothing. Fix each finding
   yourself; a finding is never the result.

## BRIEF — the six checks for one scenario

| Check | The scenario passes when |
|---|---|
| **Business language** | Every word is one the requirement owner uses. No class, table, selector, or JSON field. For an operator runbook the shell command is the business language. |
| **Real data** | Values are concrete: a persona name (`Alice`), a real status, a real reason string. Never `valid input` or `X`. |
| **Intention revealing** | The title states the behaviour, and each step states intent, not mechanics: `When Alice signs in`, not three steps of typing and clicking. |
| **Essential** | Removing any step would change what the scenario proves. Setup a reader does not need lives in the step definitions. |
| **Focused** | It illustrates exactly one rule. A second `When`, or a title that needs "and", is two scenarios. |
| **Brief** | Five steps or fewer. |

The wording test: will this step change when the implementation changes and the behaviour does
not? If yes, rewrite it as the behaviour.

## Scenario Outline

The unit pairwise outline of the `.md` is the one exception to the rules below: its rules are
`ref-readable-output.md` § The unit tier ships its pairwise outline, and it is never copied here.

Use one only when every row is the same sentence with one value changed and the row reads on its
own. Split into separate scenarios when the rows differ in their `Then`, need different setup, or
carry more than three columns: at that point the table is the derivation matrix the test set
keeps out of sight. Every column MUST be read by a `<placeholder>`.

## Step definitions — the code under the steps

**Mirror the steps as labelled sections**, so a reader matches code to scenario line by line:

```
// Given Alice is signed in
alice = signIn(uniqueAccount("alice"))

// When Alice refreshes
resp = client.refresh(alice.refreshToken)

// Then the refresh is answered 401 with reason "token expired"
assert resp.status == 401, "an expired token must never yield a new pair"
```

When one step covers several actions, number them in the label (`//  1. Client A writes "foo"`).

**Each assertion message states the business invariant**, not the check: `"a deleted resource
must not be retrievable"`, never `"exists is false"`. One `Then` per observable outcome; assert
what a caller can see, never an internal call or a private field; prefer `equal`, `contains`,
`has_length` over a bare `is_true`.

**Each scenario is independent.** It creates its own data under a unique generated identifier,
sets up its own preconditions so it passes when run alone, and tears down what it created even
when it failed. A persona name in the step maps to a fresh account in the definition.

**Wait on an event, never on a clock.** Subscribe before you trigger, then wait with a hard
timeout. A `sleep` passes on a fast machine and fails on a loaded one.

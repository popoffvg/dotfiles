# Readable output — the shape every test document takes

Every artifact this skill writes obeys the contract below: `create`, `write`, `case-design`, `bdd`, `tdd`, and the audit `verify` runs against it. A document that breaks the contract is not ready, whatever its coverage.

**The document itself is [`examples/strategy-auth-refresh.md`](../examples/strategy-auth-refresh.md)** — a filled `POST /auth/refresh` test set whose every piece carries its own rules underneath as a `>` block. Copy that file and replace its content. The sections here are the rules that cut across all of it, plus the checklist to run before saving.

**Every case is a Gherkin scenario** in the form of `show-me` (`references/show-cases.md`): a slug name, the tier tag, `Given` / `When` / `Then` in business words, and a `Then` that a test can check. The form has two shapes, one per kind of test:

- **Unit cases are the rows of a pairwise `Scenario Outline`.** A unit test varies inputs, so an `Examples` table with one column per input shows what each test varies.
- **Integration, E2E, and manual cases are scenarios under big cases.** These tests run a sequence, so `Given` / `When` / `Then` shows the state, the one action, and the result.

## Distill the system to a function

**Open every document with the system under test written as one function.** The reader must learn the inputs, the state, and the results once, before any case. Everything after that refers back to this block, so no case has to re-explain what the system is.

Write the signature, then name each part in one line of plain language, under the four labels `in`, `reads`, `returns`, and `writes`. The filled block is § The function of the example.

The function is the vocabulary of the whole document. Name the inputs here and use those exact names as the factor names, the outline columns, and in every scenario step. If the system under test needs two functions to describe, it is two test sets — or the task is too big and belongs in two TODOs.

## The unit tier ships its pairwise outline

**The unit section is the Factors table, the Pairwise cases outline, and the Added cases scenarios.** A reader sees what varies, which combinations run, and which cases came from outside the matrix. The filled blocks are § Unit cases of the example.

**Factors** — one row per input that varies. Columns: `Factor | Values | Why these values`.

- The factor is an input name from the function block, or a plain noun phrase for a condition (`length`). It is also the outline column and the `<placeholder>`, so keep it to one or two words.
- Two to four values per factor, each a short word or phrase (`live`, `expired`, `at max length`). Never a code literal, never a value id.
- `Why these values` names the branch, limit, or rule that each value reaches.

**Pairwise cases** — one `Scenario Outline` with one `Examples` row per unit test that the pairwise generator produced. The rules of the outline are `show-me` (`references/show-cases.md`) § Pairwise cases. On top of them:

- The columns are `case`, then one column per factor in the order of the Factors table, then `expected`. The cell is one value from the Factors row, in the same words.
- Under the block, one line states the property and the exclusions: `Every pair of values appears in at least one row. Excluded pairs: <pair> — <reason>.` Write `Excluded pairs: none.` when none.

**Added cases** — one `@unit` scenario per case that pairwise cannot find: boundary values, the shape of a fixed bug, a suspected three-way interaction, a property. The `Given` names only what differs from the smoke row. A property scenario names its domain in its `Given`: `any <domain>, pinned at <known edges>`.

Every other matrix stays in scratch: the decision table, the state-transition matrix, and the internal × external grid. The document carries the cases they produced. The one diagram that ships is a Mermaid `stateDiagram-v2` when the system has a lifecycle.

## Integration and E2E cases are scenarios

**A scenario is the `show-me` (`references/show-cases.md`) § Test cases form**, tagged `@integration`, `@e2e`, or `@manual`. The test function copies it verbatim as its doc comment, so the document and the test read the same steps:

```gherkin
@integration
Scenario: retired-value-refuses-a-late-reader
  Given a committed value "V" that a root field points to
  And a reader transaction that read "V"
  And the root field was reset and synced, so the retire step retired "V"
  When the reader sets a second root field to "V"
  Then its commit conflicts, and on retry the read of "V" is refused
```

- **The `Given` is the state a caller builds** through the entry point, the `When` is one call of the entry point, and the `Then` is what that caller sees.
- **A manual case uses the same form.** The actor is the reviewer, and the `Then` is what the reviewer sees.

## Group the scenarios into big cases

**A big case is one behaviour of the function, and it gets a heading and a paragraph.** Aim for three to seven per document. Fewer than three means the behaviours are not separated; more than seven means the function branches too much to test as one unit, so split the TODO. Unit cases do not sit under big cases; they sit in the unit outline and the Added cases.

The heading is a full sentence in the present tense, and it names the observable result:

- Good — `## Rotation replaces the pair and forgets the old token`
- Bad — `## Integration cases`, `## Negative`, `## F1 = malformed` — these name the tool, not the behaviour

Under the heading, one paragraph says what happens, which inputs drive it, and why the behaviour matters. Then the scenarios of that behaviour follow in one `gherkin` block. A big case with more than about four scenarios is two behaviours under one heading.

## Names, never slugs

**Every case name says what the case asserts, in kebab-case.** `expired-token-is-rejected`, not `U-PAIR-1`, `TS-STATE-013`, `F1`, or `M-2`. The name is the identifier everywhere it is needed: in the scenario name or the `case` cell, in the coverage list, in the test function name, and in a review comment.

A serial id forces the reader to look the case up before they can think about it. A name carries its own description, so a coverage list or a failure report reads on its own. The same rule applies to factors: a column header is `token`, never `F1`.

## Name the technique and the prunes

- **Technique** — one line for the document, or one line per big case, naming what derived the cases (`pairwise over token × token length × session`, `boundary values on token length`). The reviewer needs to know the method to challenge it.
- **Not covered** — every combination you pruned, and why: impossible, equal to a case already listed, or an accepted risk. A silent prune reads as full coverage.

## Checklist before saving

- [ ] The function block is first, and every factor and scenario uses its input names
- [ ] Every case is a `gherkin` scenario with a slug name and a tier tag
- [ ] The unit section has the Factors table, the Pairwise cases outline, and the Added cases scenarios, in this order
- [ ] Every outline column header and every cell uses the words of the Factors table — no `F1`, no code literal
- [ ] Every outline row sets every factor, and the line under the outline states the excluded pairs
- [ ] Every scenario has one `When`, five steps or fewer, and a `Then` that a test can check
- [ ] Three to seven big cases, each a present-tense sentence with a paragraph
- [ ] Every name says what it asserts; no `U-PAIR-1`, no `TS-*`, no `M-2`
- [ ] Every oracle is a value, a state, or an event
- [ ] No decision table or transition matrix in the saved document
- [ ] Prunes are listed in **Not covered** with a reason each

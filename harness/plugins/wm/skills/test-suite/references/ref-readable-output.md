# Readable output — the shape every test document takes

Every artifact this skill writes obeys the contract below: `create`, `write`, `case-design`, `bdd`, `tdd`, and the audit `verify` runs against it. A document that breaks the contract is not ready, whatever its coverage.

**The document itself is [`examples/strategy-auth-refresh.md`](../examples/strategy-auth-refresh.md)** — a filled `POST /auth/refresh` test set whose every piece carries its own rules underneath as a `>` block. Copy that file and replace its content. The sections here are the rules that cut across all of it, plus the checklist to run before saving.

The document has two shapes of case, one per kind of test:

- **Unit cases are rows of a pairwise table.** A unit test varies inputs, so a table with one column per input shows what each test varies.
- **Integration, E2E, and manual cases are numbered scenarios.** These tests run a sequence, so a numbered list of steps shows the order and the result of each step.

## Distill the system to a function

**Open every document with the system under test written as one function.** The reader must learn the inputs, the state, and the results once, before any case. Everything after that refers back to this block, so no case has to re-explain what the system is.

Write the signature, then name each part in one line of plain language, under the four labels `in`, `reads`, `returns`, and `writes`. The filled block is § The function of the example.

The function is the vocabulary of the whole document. Name the inputs here and use those exact names as the factor names of the unit table and in every scenario step. If the system under test needs two functions to describe, it is two test sets — or the task is too big and belongs in two TODOs.

## The unit tier ships its pairwise table

**The unit section is three tables: Factors, Pairwise cases, and Added cases.** A reader sees what varies, which combinations run, and which cases came from outside the matrix. The filled tables are § Unit cases of the example.

**Factors** — one row per input that varies. Columns: `Factor | Values | Why these values`.

- The factor is an input name from the function block, or a plain noun phrase for a condition (`token length`).
- Two to four values per factor, each a short word or phrase (`live`, `expired`, `at max length`). Never a code literal, never a value id.
- `Why these values` names the branch, limit, or rule that each value reaches.

**Pairwise cases** — one row per unit test that the pairwise generator produced. Columns: `Case`, then one column per factor in the order of the Factors table, then `Expected`.

- The column header is the factor name. The cell is one value from the Factors row, in the same words.
- Every row sets every factor. A value that cannot reach the code is still set, and `Expected` says why it does not matter ("store not read").
- `Expected` is the oracle in words: a value, a state, or an event. Never "works" or "ok".
- Under the table, one line states the property and the exclusions: `Every pair of values appears in at least one row. Excluded pairs: <pair> — <reason>.` Write `Excluded pairs: none.` when none.

**Added cases** — the rows that pairwise cannot find: boundary values, the shape of a fixed bug, a suspected three-way interaction, a property. Columns: `Case | Input | Why added | Expected`. The `Input` cell names only what differs from the smoke row.

Every other matrix stays in scratch: the decision table, the state-transition matrix, and the internal × external grid. The document carries the cases they produced. The one diagram that ships is a Mermaid `stateDiagram-v2` when the system has a lifecycle.

## Integration and E2E cases are numbered scenarios

**A scenario is a numbered list of steps, in run order, under the line `Scenario:`.** The test function copies the block verbatim as its doc comment, so the document and the test read the same steps:

```text
Scenario:
  1. Commit a value that a root field points to.
  2. Open a reader transaction that reads the value.
  3. Reset the root field and sync: the retire step retires the value.
  4. The reader sets a second root field to the value: its commit conflicts.
  5. On retry the read is refused: the value no longer exists.
```

- **One step is one action of one actor.** Write it in the imperative ("Commit a value"), or name the actor in the simple present ("The reader sets …").
- **A step that the test checks ends with a colon and the observable result.** `Reset the root field and sync: the retire step retires the value.` A setup step has no colon.
- **The last step checks the outcome the case exists for.**
- **Name a value the first time a step makes it**, and use that name in later steps: `Sign in as Alice: the server returns refresh token R.`
- **Three to seven steps.** A scenario that needs more holds two behaviours: split it.
- **Business words only.** A status code, an event name, a command, or a reason string is allowed. A variable, a helper name, or an assertion call is not.

A manual case uses the same form. The actor is the reviewer, and the result after the colon is what the reviewer sees.

## Group the scenarios into big cases

**A big case is one behaviour of the function, and it gets a heading and a paragraph.** Aim for three to seven per document. Fewer than three means the behaviours are not separated; more than seven means the function branches too much to test as one unit, so split the TODO. Unit cases do not sit under big cases; they sit in the unit tables.

The heading is a full sentence in the present tense, and it names the observable result:

- Good — `## Rotation replaces the pair and forgets the old token`
- Bad — `## Integration cases`, `## Negative`, `## F1 = malformed` — these name the tool, not the behaviour

Under the heading, one paragraph says what happens, which inputs drive it, and why the behaviour matters. Then each scenario of that behaviour follows as its name in bold, its tier in italics, and its fenced `Scenario:` block. A big case with more than about four scenarios is two behaviours under one heading.

## Names, never slugs

**Every case name says what the case asserts, in kebab-case.** `expired-token-is-rejected`, not `U-PAIR-1`, `TS-STATE-013`, `F1`, or `M-2`. The name is the identifier everywhere it is needed: in the `Case` column, in the coverage list, in a Gherkin `@tag`, in the test function name, and in a review comment.

A serial id forces the reader to look the case up before they can think about it. A name carries its own description, so a coverage list or a failure report reads on its own. The same rule applies to factors: a column header is `token`, never `F1`.

## Name the technique and the prunes

- **Technique** — one line for the document, or one line per big case, naming what derived the cases (`pairwise over token × token length × session`, `boundary values on token length`). The reviewer needs to know the method to challenge it.
- **Not covered** — every combination you pruned, and why: impossible, equal to a case already listed, or an accepted risk. A silent prune reads as full coverage.

## Checklist before saving

- [ ] The function block is first, and every factor and scenario uses its input names
- [ ] The unit section has the Factors, Pairwise cases, and Added cases tables, in this order
- [ ] Every factor column header and every cell uses the words of the Factors table — no `F1`, no code literal
- [ ] Every pairwise row sets every factor, and the line under the table states the excluded pairs
- [ ] Every integration, E2E, and manual case is a numbered `Scenario:` block of three to seven steps
- [ ] Every checked step ends with a colon and an observable result, and the last step checks the outcome
- [ ] Three to seven big cases, each a present-tense sentence with a paragraph
- [ ] Every name says what it asserts; no `U-PAIR-1`, no `TS-*`, no `M-2`
- [ ] Every oracle is a value, a state, or an event
- [ ] No decision table or transition matrix in the saved document
- [ ] Prunes are listed in **Not covered** with a reason each

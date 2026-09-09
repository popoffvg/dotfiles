# Readable output — the shape every test document takes

Every artifact this skill writes obeys the contract below: `create`, `write`, `case-design`,
`bdd`, `tdd`, and the audit `verify` runs against it. A document that breaks the contract is
not ready, whatever its coverage.

The contract exists because of one failure. A test set written as a wide factor matrix with
thirty short rows is unreadable. The reader cannot tell which rows matter, cannot hold the
column meanings in their head, and cannot see the behaviour the rows are supposed to describe.
Coverage is proven and understanding is lost.

**The document itself is [`examples/strategy-auth-refresh.md`](../examples/strategy-auth-refresh.md)** —
a filled `POST /auth/refresh` test set whose every piece carries its own rules underneath as a
`>` block: the section order, what each section must contain, and when it is wrong. Copy that
file and replace its content. The sections here are the five rules that cut across all of it,
plus the checklist to run before saving.

## Distill the system to a function

**Open every document with the system under test written as one function.** The reader must
learn the inputs, the state, and the results once, before any case. Everything after that
refers back to this block, so no case has to re-explain what the system is.

Write the signature, then name each part in one line of plain language, under the four labels
`in`, `reads`, `returns`, and `writes`. The filled block is § The function of the example.

The function is the vocabulary of the whole document. Name the inputs here and use those exact
names in every case. If the system under test needs two functions to describe, it is two test
sets — or the task is too big and belongs in two TODOs.

## Split the function into big cases

**A big case is one behaviour of that function, and it gets a heading and a paragraph.** Aim
for three to seven per document. Fewer than three means the cases are not separated; more than
seven means the function branches too much to test as one unit, so split the TODO.

The heading is a full sentence in the present tense, and it names the observable result:

- Good — `## Rotation replaces the pair and forgets the old token`
- Good — `## A malformed token is rejected before the store is read`
- Bad — `## Unit cases`, `## Negative`, `## F1 = malformed` — these name the tool, not the behaviour

Under the heading, one paragraph says what happens, which inputs drive it, and why the behaviour
matters. This paragraph is what a reviewer reads when they only read the headings and stop at
the case that surprises them.

## Variants sit inside their big case

**A variant is one runnable check of the behaviour its case describes.** It never lives in a
document-wide table; it lives under the case it proves, as a single line.

The line carries four things and nothing else: the name, the tier, the input that differs from
its siblings, and the oracle. The oracle is an observable value, state, or event — never
"works", "succeeds", or "is correct". The line format is the variant lines of the example.

A big case with one variant is fine. A big case with more than about six variants is two
behaviours wearing one heading.

## Names, never slugs

**Every case name says what the case asserts, in kebab-case.** `expired-token-is-rejected`, not
`U-PAIR-1`, `TS-STATE-013`, or `M-2`. The name is the identifier everywhere it is needed: in the
coverage list, in a Gherkin `@tag`, in the test function name, and in a review comment.

A slug forces the reader to look the case up before they can think about it. A name carries its
own description, so a coverage list or a failure report reads on its own.

## Matrices are your derivation tool — they never ship

**Build the pairwise matrix, the decision table, the state-transition matrix, and the
internal × external grid in your own scratch work, and keep them there.** They are how you find
cases. They are not how a human reads them. The document carries the big cases the matrix
produced, not the matrix.

Two things do survive from the derivation, both in prose:

- **Technique** — one line per big case, or one line for the document, naming what derived the
  cases (`boundary values on token length`, `pairwise over token × session × concurrency`).
  The reviewer needs to know the method to challenge it.
- **Not covered** — every combination you pruned, and why. Impossible, equivalent to a case
  already listed, or accepted as a risk. A silent prune reads as full coverage.

The one diagram that ships is a Mermaid `stateDiagram-v2` when the system has a lifecycle. A
diagram is read at a glance; its transition matrix is not.

## Checklist before saving

- [ ] The function block is first, and every case uses its input names
- [ ] Three to seven big cases, each a present-tense sentence naming an observable
- [ ] Every big case has a paragraph, not just a list
- [ ] Every variant sits under the case it proves — no document-wide case table
- [ ] Every name says what it asserts; no `U-PAIR-1`, no `TS-*`, no `M-2`
- [ ] Every oracle is a value, a state, or an event
- [ ] No pairwise, decision, or transition matrix in the saved document
- [ ] Prunes are listed in **Not covered** with a reason each

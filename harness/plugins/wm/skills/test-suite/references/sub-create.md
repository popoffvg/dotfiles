# Create — size the test set with pairwise, ship every case as a Gherkin scenario

Produce one artifact: a **test set** for a TODO or a task, with every case placed in the cheapest tier that can prove it.

**Open [`examples/strategy-auth-refresh.md`](../examples/strategy-auth-refresh.md) first** — it is the artifact this subcommand produces. The unit tier ships as its Factors table and pairwise `Scenario Outline`. The integration and manual tiers ship as Gherkin scenarios under big cases, in the form of `show-me` (`references/show-cases.md`). The document you save follows [`ref-readable-output.md`](ref-readable-output.md) — the contract this subcommand fills.

## The three tiers

- **unit** — fast, in-process, external dependencies mocked. Branch logic and pure functions.
- **integration** — real wired components (DB, queue, in-process API). Contracts between modules.
- **manual** — a human reviewer. What tests cannot see: how it feels, how fast it looks, what the logs say, how the real third party behaves.

Each tier gets its own derivation sized to its cost. Never reuse one matrix across tiers — a unit matrix pushed into integration produces cases that pay setup cost to prove logic that a mock already proved.

Unit cases live in the unit outline and the Added cases. Integration and manual cases live as scenarios under the big case whose behaviour they prove.

## Where the output lives

- **Per-TODO scope** — into `## Autotest` (unit + integration) in `<notes-dir>/todos/TODO-N.test.md` and `## Manual test` in `<notes-dir>/todos/TODO-N.agent.md`. Follow the `arch` skill's `todo` subcommand for the format (`arch:examples/todo-test.md` § Autotest).
- **Task-wide scope** — `<notes-dir>/test-strategy.md`, referenced from `<notes-dir>/spec.md` Implementation Guidelines.

`<notes-dir>` is the wm notes directory for the active task (commonly `.notes/`); resolve it from phase context.

## Tier budgets

Soft upper bounds on **variants**, counted across the whole document. Cross one and either split the TODO or push cases up a tier.

| Tier | Variants per TODO | Variants per task | Cost driver |
|------|-------------------|-------------------|-------------|
| unit | ≤ 12 | ≤ 50 | runtime budget (1-2s total) |
| integration | ≤ 6 | ≤ 20 | env setup + flakiness risk |
| manual | ≤ 4 | ≤ 10 | human attention budget |

The big-case budget is separate and tighter: three to seven per document, whatever the tiers add up to.

## Workflow

### 1. Distill the system to a function

Write the signature block described in `ref-readable-output.md` § Distill the system to a function — inputs, state read, results, state written. Do this before enumerating anything. Every case uses the input names you choose here.

### 2. Enumerate factors — in scratch

List every independent input or condition that can vary, and the values worth testing for each. Keep values to two to four per factor; that is the range where pairwise pays.

Factor categories that recur:

- **input shape** — valid, malformed, missing fields, oversized
- **state** — entity present, absent, soft-deleted, stale
- **identity** — anonymous, user, admin, expired session
- **external dependency** — available, slow, 5xx, partial
- **concurrency** — single, concurrent, retry
- **configuration** — flag on, off, partial rollout
- **environment** — linux/macos, container/native, fresh/migrated DB

### 3. Mark constraints — in scratch

Some combinations cannot occur or cannot be reached. Write each one down with the reason; the generator must skip them and the reasons become the **Not covered** section of the saved document.

### 4. Generate the matrix — per tier

The unit matrix ships as the Factors table and the Pairwise cases outline of the document. The integration matrix stays in scratch; its rows become scenarios in step 8.

1. List that tier's factors and values. Name each factor after an input of the function block, and each value in words.
2. Run a pairwise generator (PICT, allpairs, or by hand under three factors of three values).
3. Check the property: every pair of values across two factors appears in at least one row.

Skip pairwise when only one or two factors matter (enumerate all combinations), when the interaction you are chasing is specifically three-way (pairwise cannot see it — add the triples explicitly), or when the cases are independent per input field (enumerate per field).

### 5. Add the cases pairwise cannot find

Append these to the matrix output, always:

- **Smoke** — the most common valid input.
- **Boundaries** — for every numeric or length factor: min-1, min, max, max+1.
- **Regression shape sweep** — not one case per past bug. Read the fix commit for the *shape* it removed ("hardcoded X as false", "field lied about its own state", "forgot to check Y before Z"), grep that shape across the codebase, and add a case for **every sibling site, starting with the ones the fix did not touch**. Fixes are routinely incomplete along their own pattern, and the untouched sibling is the highest-yield case in the set. Confirm with `git show --stat <sha>`: every grep hit the commit missed is a candidate defect, not a covered one.
- **Three-way interactions you already suspect** — explicit triples for combinations like state × permission × flag.

### 6. Assign a tier to each case

| Case characteristic | Tier |
|---|---|
| Pure logic, no I/O, under 100ms | unit |
| Crosses two or more modules, or hits a real DB or queue | integration |
| Needs human judgement — visual, ergonomic, "feels fast" | manual |
| Real third-party behaviour | manual, or integration when recorded and replayed |
| Log or observability shape | manual, unless a log-shape test exists |

A case that fits several tiers goes in the **cheapest** one that can still prove its oracle.

### 7. Write the oracle

Every case ends in an observable assertion — the literal shape, value, or event:

- unit — the return value equals X, the collaborator was called with Y, an error of type T was raised.
- integration — HTTP status N with body shape B, DB row in state S, message published on topic T.
- manual — the user-visible state, with its timing: "the spinner disappears within 2s and the success toast stays up for at least 1s".

### 8. Shape each tier

**Unit** — write the Factors table, then one `Examples` row of the Pairwise cases outline per matrix row, then the step 5 cases as Added cases scenarios. Give each row a slug in its `case` cell that says what it asserts. One row is one test, so a failure names the case that broke.

**Integration and manual** — write each case as a `Scenario:` with its tier tag: the state in `Given`, one action in `When`, and the observable result in `Then`. Then read the scenarios and find the **behaviours** they cluster around — not the factors they vary. Each cluster becomes one big case with a sentence heading and a paragraph.

A scenario that belongs to no behaviour usually means the spec never named that behaviour. Name it and check that it is intended.

### 9. Emit the document

Follow the worked example you opened at the start — its section order, and the rules its `>` blocks state for each section.

## Reducing the derivation

When a tier's rows exceed its budget:

1. **Merge equivalence-class values** — collapse `null`, `""`, and `undefined` into "missing".
2. **Drop the lowest-priority factor** — the one with the smallest blast radius if it is wrong.
3. **Push a factor up a tier** — test concurrency at integration only, not at unit.
4. **Split the TODO** — a matrix still too big after the first three means the TODO does too much.

Never drop a value silently. Every drop lands in **Not covered** with the interaction you chose to lose and why that loss is acceptable.

## Pre-save checklist

Run the checklist in `ref-readable-output.md` § Checklist before saving first, then:

- [ ] The pairwise property holds for every tier that used it, and the line under the unit outline states it
- [ ] Smoke, boundary, and regression-shape cases appended on top of the matrix rows
- [ ] For a fixed-bug shape: grepped for siblings, one case per untouched site
- [ ] Every case sits in the cheapest tier that proves its oracle, and each tier is inside its budget
- [ ] Unit and integration tiers each have a runnable command under **How it runs**
- [ ] Every requirement reaches at least one case in **Coverage**

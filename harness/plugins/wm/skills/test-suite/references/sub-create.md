# Create — size the test set with pairwise, ship it as big cases

Produce one artifact: a **test set** for a TODO or a task, with every case placed in the cheapest
tier that can prove it.

Pairwise is how you *derive* the set. It is not how you *present* it. The matrix stays in your
scratch work; the document you save follows
[`ref-readable-output.md`](ref-readable-output.md) — read that first, it is the contract this
subcommand fills.

## The three tiers

- **unit** — fast, in-process, external dependencies mocked. Branch logic and pure functions.
- **integration** — real wired components (DB, queue, in-process API). Contracts between modules.
- **manual** — a human reviewer. What tests cannot see: how it feels, how fast it looks, what the
  logs say, how the real third party behaves.

Each tier gets its own derivation sized to its cost. Never reuse one matrix across tiers — a
unit matrix pushed into integration produces cases that pay setup cost to prove logic that a
mock already proved.

Tier is a property of a **variant**, not a section of the document. Variants of all three tiers
live together under the big case whose behaviour they prove.

## Where the output lives

- **Per-TODO scope** — into the `## Autotest` (unit + integration) and `## Manual test` sections
  of `<notes-dir>/todos/TODO-N.md`. Follow the `arch` skill's `todo` subcommand for the format.
- **Task-wide scope** — `<notes-dir>/test-strategy.md`, referenced from `<notes-dir>/spec.md`
  Implementation Guidelines.

`<notes-dir>` is the wm notes directory for the active task (commonly `.notes/`); resolve it from
phase context.

## Tier budgets

Soft upper bounds on **variants**, counted across the whole document. Cross one and either split
the TODO or push cases up a tier.

| Tier | Variants per TODO | Variants per task | Cost driver |
|------|-------------------|-------------------|-------------|
| unit | ≤ 12 | ≤ 50 | runtime budget (1-2s total) |
| integration | ≤ 6 | ≤ 20 | env setup + flakiness risk |
| manual | ≤ 4 | ≤ 10 | human attention budget |

The big-case budget is separate and tighter: three to seven per document, whatever the tiers add
up to.

## Workflow

### 1. Distill the system to a function

Write the signature block described in `ref-readable-output.md` section 1 — inputs, state read,
results, state written. Do this before enumerating anything. The input names you choose here are
the words every case will use, so a sloppy signature costs you twice.

### 2. Enumerate factors — in scratch

List every independent input or condition that can vary, and the values worth testing for each.
Keep values to two to four per factor; that is the range where pairwise pays.

Factor categories that recur:

- **input shape** — valid, malformed, missing fields, oversized
- **state** — entity present, absent, soft-deleted, stale
- **identity** — anonymous, user, admin, expired session
- **external dependency** — available, slow, 5xx, partial
- **concurrency** — single, concurrent, retry
- **configuration** — flag on, off, partial rollout
- **environment** — linux/macos, container/native, fresh/migrated DB

### 3. Mark constraints — in scratch

Some combinations cannot occur or cannot be reached. Write each one down with the reason; the
generator must skip them and the reasons become the **Not covered** section of the saved
document.

### 4. Generate the matrix — in scratch, per tier

1. List that tier's factors and values.
2. Run a pairwise generator (PICT, allpairs, or by hand under three factors of three values).
3. Check the property: every pair of values across two factors appears in at least one row.

Exhaustive coverage of N factors with k values each is k^N cases and explodes fast. Pairwise
guarantees every value pair appears together at least once, and catches most combinatorial
defects at O(k²).

Skip pairwise when only one or two factors matter (enumerate all combinations), when the
interaction you are chasing is specifically three-way (pairwise cannot see it — add the triples
explicitly), or when the cases are independent per input field (enumerate per field).

### 5. Add the cases pairwise cannot find

Append these to the matrix output, always:

- **Smoke** — the most common valid input.
- **Boundaries** — for every numeric or length factor: min-1, min, max, max+1.
- **Regression shape sweep** — not one case per past bug. Read the fix commit for the *shape* it
  removed ("hardcoded X as false", "field lied about its own state", "forgot to check Y before
  Z"), grep that shape across the codebase, and add a case for **every sibling site, starting
  with the ones the fix did not touch**. Fixes are routinely incomplete along their own pattern,
  and the untouched sibling is the highest-yield case in the set. Confirm with
  `git show --stat <sha>`: every grep hit the commit missed is a candidate defect, not a covered
  one.
- **Three-way interactions you already suspect** — explicit triples for combinations like
  state × permission × flag.

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

Every case ends in an observable assertion. Banned: "works", "succeeds", "looks right".

- unit — the return value equals X, the collaborator was called with Y, an error of type T was raised.
- integration — HTTP status N with body shape B, DB row in state S, message published on topic T.
- manual — the user-visible state, with its timing: "the spinner disappears within 2s and the
  success toast stays up for at least 1s".

### 8. Group the rows into big cases

This is the step that turns the matrix into a document. Read the rows and find the **behaviours**
they cluster around — not the factors they vary. Each cluster becomes one big case with a
sentence heading and a paragraph; each row becomes one named variant under it.

Rows that resist grouping are the interesting ones. A row that belongs to no behaviour usually
means the behaviour was never named in the spec, so name it and check it is intended.

### 9. Emit the document

Follow the skeleton in `ref-readable-output.md` section 6. The worked example is
[`examples/ex-strategy-auth-refresh.md`](../examples/ex-strategy-auth-refresh.md). The matrix
does not appear in it, and must not appear in yours.

## Reducing the derivation

When a tier's rows exceed its budget:

1. **Merge equivalence-class values** — collapse `null`, `""`, and `undefined` into "missing".
2. **Drop the lowest-priority factor** — the one with the smallest blast radius if it is wrong.
3. **Push a factor up a tier** — test concurrency at integration only, not at unit.
4. **Split the TODO** — a matrix still too big after the first three means the TODO does too much.

Never drop a value silently. Every drop lands in **Not covered** with the interaction you chose
to lose and why that loss is acceptable.

## Anti-patterns

- **Sections named after tiers** — `## Unit cases` splits one behaviour across three tables. Name
  the sections after behaviours and tag each variant with its tier.
- **One giant unit test with N assertions** — it fails opaquely; one variant, one case.
- **Pairwise without the smoke and boundary additions** — combinatorial coverage misses the
  common failure modes.
- **Integration cases that repeat unit cases** — pick the tier that already proves the oracle.
- **Manual cases a test could check** — status codes, DB rows, and log assertions are automatable.
- **Vague oracles** — replace "the response is correct" with the literal shape, value, or event.
- **Skipping constraints** — the matrix fills with impossible rows and spends the budget on them.

## Pre-save checklist

Run the checklist in `ref-readable-output.md` section 7 first, then:

- [ ] The pairwise property held in scratch for every tier that used it
- [ ] Smoke, boundary, and regression-shape cases appended on top of the matrix rows
- [ ] For a fixed-bug shape: grepped for siblings, one case per untouched site
- [ ] Every case sits in the cheapest tier that proves its oracle
- [ ] Tier budgets respected — unit ≤ 12, integration ≤ 6, manual ≤ 4 per TODO
- [ ] Unit and integration tiers each have a runnable command under **How it runs**
- [ ] Every requirement reaches at least one case in **Coverage**

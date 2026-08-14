---
name: test-suite
description: >
  One entry point for all testing work. Use when the user wants to design a test strategy
  (pairwise tiering across unit/integration/manual), enumerate scenarios before implementation,
  audit/score an existing test set for missed cases and readability, apply black-box
  techniques (equivalence partitioning, boundary values, decision tables, state transition,
  state-combination), write BDD Given/When/Then scenarios, drive a feature/bug-fix spec-before-code
  (TDD), test a harness plugin in isolation, or run the verify phase where the user reviews an
  implementation. Invoke as `/test-suite <subcommand>`.
argument-hint: [create, write, verify — full list /test-suite-help]
---

# Test Suite — subcommand router

`/test-suite <subcommand>`. Pick the operation, read its reference, follow it. Default subcommand is
[`create`](references/sub-create.md). Most real tasks chain two or three.

## The output contract — read it first

[`references/ref-readable-output.md`](references/ref-readable-output.md) defines the shape every
document this skill writes must take, and every subcommand below fills it. Load it before
`create`, `write`, `case-design`, `bdd`, `tdd`, or `verify`.

Three rules carry it. **Distill the system under test to a function** — inputs, state, results —
at the top of the document, once. **Split that function into three to seven big cases**, each a
sentence naming a behaviour, each with a paragraph, each holding its own variants. **Name every
case after what it asserts** — `expired-token-is-rejected`, never `U-PAIR-1`.

The matrices are yours, not the reader's. A pairwise grid, a decision table, and a transition
matrix are how you find cases; they never appear in the saved document. What survives the
derivation is the big cases it produced, the technique that produced them, and a **Not covered**
list saying in words what you pruned and why.

## Subcommands

| `/test-suite …` | You need to… | Reference |
|---|---|---|
| [`create`](references/sub-create.md) *(default)* | Size a test set for a TODO/task with pairwise across unit / integration / manual tiers, and ship it as big cases. | [`references/sub-create.md`](references/sub-create.md) |
| [`write`](references/sub-write.md) | Enumerate the scenarios before implementation — a readable `.md` test set plus Gherkin feature files. | [`references/sub-write.md`](references/sub-write.md) |
| [`verify`](references/sub-verify.md) | Audit an existing test set for missed cases and readability — Ready / Not Ready verdict. | [`references/sub-verify.md`](references/sub-verify.md) |
| [`case-design`](references/sub-case-design.md) | Derive cases systematically — equivalence partitioning, boundary values, decision tables, state transition, state-combination. | [`references/sub-case-design.md`](references/sub-case-design.md) |
| [`bdd`](references/sub-bdd.md) | Shape integration/e2e cases as Cucumber Given/When/Then. | [`references/sub-bdd.md`](references/sub-bdd.md) (+ [`references/ref-gherkin-guide.md`](references/ref-gherkin-guide.md)) |
| [`tdd`](references/sub-tdd.md) | Drive a feature or bug-fix spec-before-code with Red-Green-Refactor. | [`references/sub-tdd.md`](references/sub-tdd.md) (+ [`references/ref-bdd-best-practices.md`](references/ref-bdd-best-practices.md)) |
| [`harness`](references/sub-harness.md) | Test a harness plugin in isolation — MCP server, unit tests, typecheck, Claude plugin loading (tmux panes). | [`references/sub-harness.md`](references/sub-harness.md) |
| [`review`](references/sub-review.md) | Run the verify phase — present results, let the user review an implementation against acceptance criteria. | [`references/sub-review.md`](references/sub-review.md) |

Supporting references (not direct subcommands): [`references/ref-readable-output.md`](references/ref-readable-output.md) — the output
contract for every subcommand; [`references/ref-gherkin-guide.md`](references/ref-gherkin-guide.md) and
[`references/ref-bdd-best-practices.md`](references/ref-bdd-best-practices.md) — backing docs for [`bdd`](references/sub-bdd.md) and [`tdd`](references/sub-tdd.md).

## How they combine

- **[case-design](references/sub-case-design.md)** is the technique toolbox — it fills the scratch matrices that feed **[create](references/sub-create.md)** and **[write](references/sub-write.md)**.
- **[create](references/sub-create.md)** sizes the set across cost tiers with pairwise, then groups the rows into big cases; **[write](references/sub-write.md)** turns them into the `.md` map and the Gherkin bodies.
- **[bdd](references/sub-bdd.md)** / **[tdd](references/sub-tdd.md)** govern *how* behavioural cases read and how implementation is driven from them.
- **[verify](references/sub-verify.md)** audits the finished set on both axes — coverage and readability — and returns Ready / Not Ready.
- **[harness](references/sub-harness.md)** and **[review](references/sub-review.md)** are standalone — execution (plugin smoke tests) and review (user sign-off), not case design.

Typical chain for a TODO: [`case-design`](references/sub-case-design.md) (derive) → [`create`](references/sub-create.md) (tier + pairwise) → [`write`](references/sub-write.md) (write artifacts) → [`verify`](references/sub-verify.md) (audit).

## Output shape

The canonical document is [`examples/ex-strategy-auth-refresh.md`](examples/ex-strategy-auth-refresh.md) — a `POST /auth/refresh` test set
written to the contract, with the function block, five big cases, coverage, and the prunes. Copy its section order.

Per-TODO output goes into the `## Autotest` and `## Manual test` sections of `<notes-dir>/todos/TODO-N.md` (follow the `arch` skill's
`todo` subcommand); task-wide output goes to `<notes-dir>/test-strategy.md`.

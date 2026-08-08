---
name: test-suite
description: >
  One entry point for all testing work. Use when the user wants to design a test strategy
  (pairwise tiering across unit/integration/manual), enumerate scenarios + a coverage matrix
  before implementation, audit/score an existing test set for missed cases, apply black-box
  techniques (equivalence partitioning, boundary values, decision tables, state transition,
  state-combination), write BDD Given/When/Then scenarios, drive a feature/bug-fix spec-before-code
  (TDD), test a harness plugin in isolation, or run the verify phase where the user reviews an
  implementation. Invoke as `/test-suite <subcommand>`.
argument-hint: [create, write, verify — full list /test-suite-help]
---

# Test Suite — subcommand router

`/test-suite <subcommand>`. Pick the operation, read its reference, follow it. Default subcommand is
[`create`](references/sub-create.md). Most real tasks chain two or three.

## Subcommands

| `/test-suite …` | You need to… | Reference |
|---|---|---|
| [`create`](references/sub-create.md) *(default)* | Design a minimal-but-covering strategy for a TODO/task, split into unit / integration / manual tiers via pairwise. | [`references/sub-create.md`](references/sub-create.md) |
| [`write`](references/sub-write.md) | Enumerate scenarios + a coverage matrix before implementation (`.md` index + Gherkin features). | [`references/sub-write.md`](references/sub-write.md) |
| [`verify`](references/sub-verify.md) | Audit, score, or validate an existing test set for missed cases before merge — Ready / Not Ready verdict. | [`references/sub-verify.md`](references/sub-verify.md) |
| [`case-design`](references/sub-case-design.md) | Derive cases systematically — equivalence partitioning, boundary values, decision tables, state transition, state-combination. | [`references/sub-case-design.md`](references/sub-case-design.md) |
| [`bdd`](references/sub-bdd.md) | Shape integration/e2e cases as Cucumber Given/When/Then. | [`references/sub-bdd.md`](references/sub-bdd.md) (+ [`references/ref-gherkin-guide.md`](references/ref-gherkin-guide.md)) |
| [`tdd`](references/sub-tdd.md) | Drive a feature or bug-fix spec-before-code with Red-Green-Refactor. | [`references/sub-tdd.md`](references/sub-tdd.md) (+ [`references/ref-bdd-best-practices.md`](references/ref-bdd-best-practices.md)) |
| [`harness`](references/sub-harness.md) | Test a harness plugin in isolation — MCP server, unit tests, typecheck, Claude plugin loading (tmux panes). | [`references/sub-harness.md`](references/sub-harness.md) |
| [`review`](references/sub-review.md) | Run the verify phase — present results, let the user review an implementation against acceptance criteria. | [`references/sub-review.md`](references/sub-review.md) |

Supporting references (not direct subcommands): [`references/ref-gherkin-guide.md`](references/ref-gherkin-guide.md) and
[`references/ref-bdd-best-practices.md`](references/ref-bdd-best-practices.md) — backing docs for [`bdd`](references/sub-bdd.md) and [`tdd`](references/sub-tdd.md).

## How they combine

- **[case-design](references/sub-case-design.md)** is the technique toolbox — feeds the case lists of **[create](references/sub-create.md)** and **[write](references/sub-write.md)**.
- **[create](references/sub-create.md)** sizes the strategy across cost tiers (unit/integration/manual) with pairwise; **[write](references/sub-write.md)** turns it into concrete artifacts (behavioral → Gherkin, unit → table — never both).
- **[bdd](references/sub-bdd.md)** / **[tdd](references/sub-tdd.md)** govern *how* behavioral cases read and how implementation is driven.
- **[verify](references/sub-verify.md)** audits the finished set and returns a Ready / Not Ready verdict.
- **[harness](references/sub-harness.md)** and **[review](references/sub-review.md)** are standalone — execution (plugin smoke tests) and review (user sign-off), not case design.

Typical chain for a TODO: [`case-design`](references/sub-case-design.md) (derive) → [`create`](references/sub-create.md) (tier + pairwise) → [`write`](references/sub-write.md) (write artifacts) → [`verify`](references/sub-verify.md) (audit).

## Output shape

The canonical strategy document is in [`examples/ex-strategy-auth-refresh.md`](examples/ex-strategy-auth-refresh.md). Per-TODO output goes into the `## Autotest` and `## Manual test` sections of `<notes-dir>/todos/TODO-N.md` (follow the `code` skill's `todo` subcommand); task-wide output goes to `<notes-dir>/test-strategy.md`.

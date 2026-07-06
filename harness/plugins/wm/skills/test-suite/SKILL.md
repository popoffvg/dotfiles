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
`create`. Most real tasks chain two or three.

## Subcommands

| `/test-suite …` | You need to… | Reference |
|---|---|---|
| `create` *(default)* | Design a minimal-but-covering strategy for a TODO/task, split into unit / integration / manual tiers via pairwise. | `references/sub-create.md` |
| `write` | Enumerate scenarios + a coverage matrix before implementation (`.md` index + Gherkin features). | `references/sub-write.md` |
| `verify` | Audit, score, or validate an existing test set for missed cases before merge — Ready / Not Ready verdict. | `references/sub-verify.md` |
| `case-design` | Derive cases systematically — equivalence partitioning, boundary values, decision tables, state transition, state-combination. | `references/sub-case-design.md` |
| `bdd` | Shape integration/e2e cases as Cucumber Given/When/Then. | `references/sub-bdd.md` (+ `references/ref-gherkin-guide.md`) |
| `tdd` | Drive a feature or bug-fix spec-before-code with Red-Green-Refactor. | `references/sub-tdd.md` (+ `references/ref-bdd-best-practices.md`) |
| `harness` | Test a harness plugin in isolation — MCP server, unit tests, typecheck, Claude plugin loading (tmux panes). | `references/sub-harness.md` |
| `review` | Run the verify phase — present results, let the user review an implementation against acceptance criteria. | `references/sub-review.md` |

Supporting references (not direct subcommands): `references/ref-gherkin-guide.md` and
`references/ref-bdd-best-practices.md` — backing docs for `bdd` and `tdd`.

## How they combine

- **case-design** is the technique toolbox — feeds the case lists of **create** and **write**.
- **create** sizes the strategy across cost tiers (unit/integration/manual) with pairwise; **write** turns it into concrete artifacts (behavioral → Gherkin, unit → table — never both).
- **bdd** / **tdd** govern *how* behavioral cases read and how implementation is driven.
- **verify** audits the finished set and returns a Ready / Not Ready verdict.
- **harness** and **review** are standalone — execution (plugin smoke tests) and review (user sign-off), not case design.

Typical chain for a TODO: `case-design` (derive) → `create` (tier + pairwise) → `write` (write artifacts) → `verify` (audit).

## Output shape

The canonical strategy document is in [`examples/ex-strategy-auth-refresh.md`](examples/ex-strategy-auth-refresh.md). Per-TODO output goes into the `## Autotest` and `## Manual test` sections of `<notes-dir>/todos/TODO-N.md` (follow the `code` skill's `todo` subcommand); task-wide output goes to `<notes-dir>/test-strategy.md`.

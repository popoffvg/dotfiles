---
name: test-suite:help
description: Show all /test-suite subcommands with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/test-suite <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `create` *(default)* | Size a test set for a TODO/task with pairwise across unit / integration / manual tiers, and ship it as big cases. |
| `write` | Enumerate the scenarios before implementation — a readable `.md` test set plus Gherkin feature files. |
| `verify` | Audit an existing test set for missed cases and readability — Ready / Not Ready verdict. |
| `case-design` | Derive cases systematically — equivalence partitioning, boundary values, decision tables, state transition, state-combination, property-based. |
| `bdd` | Shape integration/e2e cases as Cucumber Given/When/Then. |
| `tdd` | Drive a feature or bug-fix spec-before-code with Red-Green-Refactor. |
| `harness` | Test a harness plugin in isolation — MCP server, unit tests, typecheck, Claude plugin loading. |
| `review` | Run the verify phase — present results, let the user review an implementation against acceptance criteria. |

Typical chain for a TODO: `case-design` (derive) → `create` (tier + pairwise) → `write` (write artifacts) → `verify` (audit).

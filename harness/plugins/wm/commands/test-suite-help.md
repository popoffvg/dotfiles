---
name: test-suite-help
description: Show all /test-suite subcommands with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/test-suite <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `create` *(default)* | Size a test set for a TODO/task with pairwise across unit / integration / manual tiers, and ship it as big cases. |
| `write` | Enumerate the scenarios before implementation — a readable `.md` test set plus Gherkin feature files. |
| `verify` | Audit an existing test set for missed cases and readability — Ready / Not Ready verdict. |
| `case-design` | Derive cases — equivalence partitioning, boundary values, decision tables, state transition. |
| `bdd` | Shape integration/e2e cases as Cucumber Given/When/Then. |
| `tdd` | Drive a feature/bug-fix spec-before-code with Red-Green-Refactor. |
| `harness` | Test a harness plugin in isolation — MCP server, unit tests, typecheck, plugin loading. |
| `review` | Verify phase — present results, user reviews implementation against acceptance criteria. |

Typical chain: `case-design → create → write → verify`.

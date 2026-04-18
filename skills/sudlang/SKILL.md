---
name: sudlang
description: Use when creating or refining implementation plans. Apply SudoLang-style constraints, requirements, and criteria-to-task traceability.
---

# sudlang

Use SudoLang principles in plans.

Reference: https://github.com/paralleldrive/sudolang/blob/main/sudolang.sudo.md

## Rules

- Define constraints before step-by-step instructions.
- Keep plan language declarative, concise, and verifiable.
- Use requirements for hard checks and warnings for soft checks.
- Every TODO must map to at least one acceptance criterion.
- Keep TODOs atomic (one TODO = one commit).

## Plan contract snippet

```sudo
PlanContract {
  Constraints {
    Every TODO maps to >=1 AcceptanceCriterion.
    Every TODO references concrete file paths when code changes are needed.
    Every TODO declares its C4 level (L1-L4).
    Design decisions at level N fixed before TODOs at level N+1.
    L4 TODOs include a SudoLang algorithm block.
    Open decisions are listed explicitly.
    Every domain noun in Criteria/TODOs appears in Glossary.
    No contradictions between decisions at different levels.
  }

  Requirements {
    require plan includes: Description, Glossary, Acceptance Criteria, TODOs.
    require acceptance criteria are checkbox items.
    require TODOs are checkbox items.
    require Glossary uses domain language, not implementation jargon.
  }

  /lint-plan - report missing mappings, vague TODOs, missing glossary entries, contradictions
  /trace [todoId] - show criteria, decisions, C4 level, and files
}
```

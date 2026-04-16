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
- Keep TODOs atomic (one TODO ≈ one commit).

## Plan contract snippet

```sudo
PlanContract {
  Constraints {
    Every TODO maps to >=1 AcceptanceCriterion.
    Every TODO references concrete file paths when code changes are needed.
    Open decisions are listed explicitly.
  }

  Requirements {
    require plan includes: Description, Acceptance Criteria, TODOs.
    require acceptance criteria are checkbox items.
    require TODOs are checkbox items.
  }

  /lint-plan - report missing mappings and vague TODOs
  /trace [todoId] - show criteria, decisions, and files
}
```

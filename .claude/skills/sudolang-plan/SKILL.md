---
name: sudolang-plan
description: Use when creating or refining any implementation plan, roadmap, or task breakdown. Express plan logic in concise SudoLang-style constraints, interfaces, commands, and invariants.
---

# sudolang-plan

Apply SudoLang principles to planning so plans are declarative, constraint-first, and easy for LLM execution.

Reference: https://github.com/paralleldrive/sudolang/blob/main/sudolang.sudo.md

## Core rules

- Prefer **constraints** (what must stay true) over step-heavy procedural text.
- Use **interface-oriented structure** for plan entities (`Task`, `AcceptanceCriteria`, `Decision`, `Risk`).
- Keep syntax concise and natural language first.
- Use **requirements** for hard-fail conditions and **warnings** for soft guidance.
- Define reusable **commands** for recurring planning actions.
- Capture invariants explicitly and keep them visible near TODOs.

## Plan output pattern

When writing `_notes/plan.md`, include this SudoLang block near the top (after Description):

```sudo
PlanContract {
  Interfaces {
    Task { id; title; files; dependsOn?; done = false }
    AcceptanceCriterion { id; statement; verifiable = true }
    Decision { id; status: "fixed"|"open"; rationale }
  }

  Constraints {
    Every TODO maps to >=1 AcceptanceCriterion.
    Every TODO references concrete file paths when code changes are required.
    Open decisions must not be hidden inside implementation TODOs.
    Tasks remain atomic: one TODO ≈ one commit.
    Prefer declarative language over imperative micro-steps.
  }

  Requirements {
    require plan includes sections: Description, Acceptance Criteria, TODOs.
    require every Acceptance Criteria item is a checkbox.
    require every TODO item is a checkbox.
  }

  /lint-plan - report missing mappings, vague TODOs, unresolved dependencies
  /trace [todoId] - list related criteria, decisions, and referenced files
}
```

## SudoLang style constraints for plans

```sudo
Lint {
  style constraints {
    * readable, concise, clear, declarative
    * favor natural language unless structured syntax is clearer
    * each TODO uses concrete nouns (files, functions, modules)
    * prohibit vague TODOs like "improve", "handle edge cases", "refactor stuff"
  }
}
```

## Mapping rules

- For each TODO, add:
  - `criteria:` AC IDs satisfied by the TODO
  - `decisions:` fixed Decision IDs used
  - `depends on:` open question IDs if blocked
- For each acceptance criterion, ensure at least one TODO references it.

## Minimal template snippet

```text
## SudoLang Plan Contract
[PlanContract block in ```sudo fence]

## Acceptance Criteria
- [ ] AC1: ...

## TODOs
- [ ] T1: ...
  - files: `path/to/file`
  - criteria: AC1
  - decisions: D1
```

## Autoresearch rules

**Eval checklist:**
1. Are constraints explicit and testable?
2. Does every TODO map to acceptance criteria?
3. Are hard requirements separated from soft guidance?
4. Is plan language concise and declarative (not procedural bloat)?

**Can change:** templates, command names, constraint wording, mapping format
**Cannot change:** checkbox contract, criteria↔TODO traceability, declarative-first planning
**Min sessions before eval:** 5
**Runs per experiment:** 3

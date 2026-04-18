---
name: plan-router
description: Use when creating or refining any implementation plan, roadmap, or task breakdown. Routes to the appropriate C4 phase skill based on current plan state.
---

# plan-router — Plan Router

Routes planning work to the correct C4 phase skill. Apply SudoLang principles throughout: declarative, constraint-first, easy for LLM execution.

Reference: https://github.com/paralleldrive/sudolang/blob/main/sudolang.sudo.md

## Routing logic

1. Read `_notes/plan.md` (or note its absence).
2. Determine the current phase by checking which C4 levels have fixed decisions:

| Condition | Route to |
|---|---|
| No plan or no Description | **plan-context** (L1) |
| L1 decisions fixed, L2 missing/open | **plan-container** (L2) |
| L1+L2 fixed, L3 missing/open | **plan-component** (L3) |
| L1+L2+L3 fixed, L4 missing/open | **plan-code** (L4) |
| All levels fixed | **plan-verify** |

3. **Skip levels** when scope is contained within a single level (e.g., a bugfix may start directly at L4). State the skip explicitly: `Skipping L1–L3: scope is a single-function change.`

## Phase skills

- **plan-context** — L1: system boundaries, actors, scope decisions, seed glossary
- **plan-container** — L2: services, databases, protocols, technology choices
- **plan-component** — L3: modules, interfaces, dependency directions
- **plan-code** — L4: algorithms as SudoLang pseudocode, data structures, patterns

## Plan contract (applies to all phases)

```sudo
PlanContract {
  Interfaces {
    Task { id; title; files; level: "L1"|"L2"|"L3"|"L4"; dependsOn?; done = false }
    AcceptanceCriterion { id; statement; verifiable = true }
    Decision { id; level: "L1"|"L2"|"L3"|"L4"; status: "fixed"|"open"; rationale }
    GlossaryEntry { term; definition; context; aliases? }
  }

  Constraints {
    Every TODO maps to >=1 AcceptanceCriterion.
    Every TODO references concrete file paths when code changes are required.
    Every TODO declares its C4 level.
    Open decisions must not be hidden inside implementation TODOs.
    Tasks remain atomic: one TODO = one commit.
    Design decisions at level N must be fixed before creating TODOs at level N+1.
    L4 TODOs include a SudoLang algorithm block.
    Every domain noun in Criteria/TODOs appears in Glossary.
    No contradictions between decisions at different levels.
  }

  Requirements {
    require plan includes sections: Description, Glossary, Acceptance Criteria, TODOs.
    require every Acceptance Criteria item is a checkbox.
    require every TODO item is a checkbox.
    require Glossary entries use domain language, not implementation jargon.
  }

  /lint-plan - report missing mappings, vague TODOs, missing glossary entries
  /trace [todoId] - list related criteria, decisions, C4 level, and files
}
```

## Style constraints

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

## Autoresearch rules

**Can change:** templates, command names, constraint wording, mapping format
**Cannot change:** checkbox contract, criteria<>TODO traceability, declarative-first planning, phase routing order
**Min sessions before eval:** 5
**Runs per experiment:** 3

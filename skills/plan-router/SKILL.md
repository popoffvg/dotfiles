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
4. If routing confidence is low (missing plan context, conflicting decisions, unclear scope), do **not** guess. Ask up to 3 targeted clarification questions, then route.

## Quick go-ahead handling (reduce friction)

If you already proposed a routing decision or next planning action and the user replies with a short confirmation (for example: "let's do", "do it", "go ahead", "ok"), treat that as approval to execute the last concrete proposal immediately.

- Do not ask the user to restate which option unless there are multiple unresolved options.
- Do not repeat the routing explanation unless the user asks for rationale again.
- If multiple options remain, ask exactly one disambiguation question.

## Output contract (router response)

Always return a compact routing decision in this shape:

```md
Routing Decision
- selected phase skill: <plan-context|plan-container|plan-component|plan-code|plan-verify>
- why: <1-2 concrete reasons tied to plan state>
- evidence: <file/section names used>
- skipped levels: <none|L1-L2... + explicit reason>
- next action: <run selected phase skill>
```

If `_notes/plan.md` is absent, return `plan-context` and explicitly say "starting from L1 because plan file is missing".

## Phase skills

- **plan-context** — L1: system boundaries, actors, scope decisions, seed glossary
- **plan-container** — L2: services, databases, protocols, technology choices
- **plan-component** — L3: modules, interfaces, dependency directions
- **plan-code** — L4: algorithms as SudoLang pseudocode, data structures, patterns

## Plan contract

Load `sudolang-plan` skill for PlanContract, style constraints, and traceability rules.

## Autoresearch rules

**Can change:** templates, command names, constraint wording, mapping format
**Cannot change:** checkbox contract, criteria<>TODO traceability, declarative-first planning, phase routing order
**Min sessions before eval:** 5
**Runs per experiment:** 3

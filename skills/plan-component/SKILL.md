---
name: plan-component
description: "C4 Level 3 (Component) planning phase: define internal modules, responsibilities, interfaces, and dependency decisions."
---

# plan-component — C4 Level 3 (Component)

Design the internal structure of each container — modules, packages, interfaces.

## Prerequisites

All L1 and L2 decisions must be fixed.

## Deliverables

Update `_notes/plan.md` with:

### Component Decisions

| Question | Decision |
|---|---|
| What packages/modules exist in each container? | ... |
| What are their responsibilities? | ... |
| What interfaces do they expose? | ... |
| What are the dependency directions? | ... |
| What patterns apply? (repository, service, handler) | ... |

Format:
```text
- D20 [L3, fixed]: <decision statement>
  rationale: <why>
```

### Glossary (extend)

Add domain terms for internal concepts (aggregates, value objects, services). Every domain noun used in TODOs must have an entry.

### TODOs (L3)

Create TODOs for component-level work (module creation, interface definition, wiring):
```text
- [ ] T20: ...
  - level: L3
  - files: `path/to/file`
  - criteria: AC...
  - decisions: D20
```

## Exit condition

All L3 decisions are `fixed`. No open questions at this level. No contradiction with L1/L2 decisions. Proceed to L4 (plan-code).

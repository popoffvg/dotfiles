---
name: plan-container
description: "C4 Level 2 (Container) planning phase: define services, databases, protocols, and technology decisions."
---

# plan-container — C4 Level 2 (Container)

Break the system into deployable containers and decide how they communicate.

## Prerequisites

All L1 (Context) decisions must be fixed.

## Deliverables

Update `_notes/plan.md` with:

### Container Decisions

| Question | Decision |
|---|---|
| What services/processes exist? | ... |
| What databases/stores are used? | ... |
| What message brokers or queues? | ... |
| What protocols between containers? (HTTP, gRPC, events) | ... |
| What technology choices? (language, framework, runtime) | ... |

Format:
```text
- D10 [L2, fixed]: <decision statement>
  rationale: <why>
```

### Glossary (extend)

Add any new domain terms discovered at this level. Review existing entries for accuracy.

### Acceptance Criteria (refine)

Add or refine criteria that relate to container boundaries, SLAs, or integration contracts.

### TODOs (L2)

Create TODOs for container-level work (infrastructure, configuration, API contracts):
```text
- [ ] T10: ...
  - level: L2
  - files: `path/to/file` (if applicable)
  - criteria: AC...
  - decisions: D10
```

## Exit condition

All L2 decisions are `fixed`. No open questions at this level. No contradiction with L1 decisions. Proceed to L3 (plan-component).

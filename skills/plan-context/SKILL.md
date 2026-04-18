---
name: plan-context
description: "C4 Level 1 (Context) planning phase: define system boundaries, external actors, integrations, and scope decisions."
---

# plan-context — C4 Level 1 (Context)

Define the system's place in the world before diving into internals.

## Inputs

- User's task description or feature request
- Existing `_notes/plan.md` (if resuming)

## Deliverables

Write or update these sections in `_notes/plan.md`:

### Description

One paragraph: what the system/feature does, who it serves, why it exists.

### Glossary (seed)

Extract initial domain entities from the description. Each entry:
```text
**<Term>** — <One-sentence definition in domain language>
  context: <Bounded context or module>
  aliases: <Alternative names if any>
```

Rules:
- Use domain language, not implementation jargon (`Order`, not `OrderDTO`).
- Ambiguous terms must specify their bounded context.

### Context Decisions

For each, capture as a `Decision` entry:

| Question | Decision |
|---|---|
| What is in scope? | ... |
| What is explicitly out of scope? | ... |
| Who are the external actors (users, systems)? | ... |
| What external systems do we integrate with? | ... |
| What are the trust boundaries? | ... |

Format:
```text
- D1 [L1, fixed]: <decision statement>
  rationale: <why>
```

### Acceptance Criteria (initial)

Write verifiable criteria as checkboxes. These may be refined in later phases.

## Exit condition

All L1 decisions are `fixed`. No open questions remain at this level. Glossary seeded. Proceed to L2 (plan-container) or skip to the appropriate level.

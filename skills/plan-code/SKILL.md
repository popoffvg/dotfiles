---
name: plan-code
description: "C4 Level 4 (Code) planning phase: define classes, functions, algorithms as SudoLang pseudocode with constraints and invariants."
---

# plan-code — C4 Level 4 (Code)

Design the implementation details — every L4 TODO must include a SudoLang algorithm description.

## Prerequisites

All L1, L2, and L3 decisions must be fixed.

## Deliverables

Update `_notes/plan.md` with:

### Code Decisions

| Question | Decision |
|---|---|
| What data structures? | ... |
| What algorithms? | ... |
| What error handling strategy? | ... |
| What patterns? (factory, strategy, observer) | ... |

Format:
```text
- D30 [L4, fixed]: <decision statement>
  rationale: <why>
```

### Glossary (finalize)

Final review — every domain noun in all TODOs and Criteria must have an entry. No implementation jargon.

### TODOs (L4)

Every L4 TODO **must** include a `algorithm:` block in SudoLang — declarative pseudocode specifying logic, constraints, and invariants:

```text
- [ ] T30: Implement order total calculation
  - level: L4
  - files: `pkg/checkout/total.go`
  - criteria: AC1
  - decisions: D30
  - algorithm:
    ```sudo
    CalcTotal(order) {
      Constraints {
        discount <= order.subtotal
        total >= 0
      }
      subtotal = sum(order.items.map(i => i.price * i.qty))
      discount = apply(order.coupon, subtotal)
      total = subtotal - discount + tax(subtotal, order.region)
    }
    ```
```

### SudoLang algorithm rules

- **Constraints block** — invariants that must hold (pre/post conditions).
- **Declarative flow** — describe *what*, not *how*. No imperative loops unless essential.
- **Named operations** — extract meaningful sub-operations (`apply`, `tax`) rather than inline logic.
- **Edge cases** — list as constraints or guard clauses, not prose.

## Exit condition

All L4 decisions are `fixed`. Every L4 TODO has a SudoLang algorithm block. No contradiction with L1–L3 decisions. Plan is ready for `/plan-verify`.

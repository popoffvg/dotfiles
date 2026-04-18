---
name: work-verify
description: >
  Legacy phase document. Current work-manager FSM does not include verify.
---

# work-verify (legacy)

This skill is kept for backward compatibility only.

Current FSM phases are:
- `research`
- `plan`
- `plan-verify`
- `implement`

Do not transition to `verify` from current work-manager flows.

Use:
- `work-plan-verifier` for plan auditing in `plan-verify`
- `work-plan` to refine plan
- `work-implement` to execute TODOs
- `/work:abandon` when ending active flow

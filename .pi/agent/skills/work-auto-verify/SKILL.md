---
name: work-auto-verify
description: >
  Legacy phase document. Current work-manager FSM does not include auto-verify.
---

# work-auto-verify (legacy)

This skill is kept for backward compatibility only.

Current FSM phases are:
- `research`
- `plan`
- `plan-verify`
- `implement`

Do not transition to `auto-verify` or `verify` from this skill.

If asked to verify plans before implementation, use `work-plan-verifier`.
If asked to execute TODOs, use `work-implement`.

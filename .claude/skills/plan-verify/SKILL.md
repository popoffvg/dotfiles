---
name: plan-verify
description: "Use after drafting `_notes/plan.md` to verify SudoLang contract compliance: sections, checkbox rules, criteria↔TODO traceability, and unresolved decision handling."
---

# plan-verify

Validate that a plan follows the `sudlang` contract before signaling readiness.

## Verification checklist

- Required sections exist: `Description`, `Acceptance Criteria`, `TODOs`.
- All Acceptance Criteria entries are `- [ ]` checkboxes.
- All TODO entries are `- [ ]` checkboxes.
- Every TODO has at least one `criteria:` mapping.
- Every Acceptance Criterion is referenced by at least one TODO.
- TODOs that change code include concrete file paths.
- Open decisions/questions are explicit (not hidden in TODO text).
- No vague TODOs (`improve`, `refactor stuff`, `handle edge cases` without specifics).

## Output format

When issues exist, report:
- `FAIL: <rule>`
- `location: <section/TODO id>`
- `fix: <specific rewrite>`

When all checks pass, report:
- `PASS: sudlang contract verified`

## Gate rule

Do not declare "Plan is ready" until `PASS: sudlang contract verified` is true.

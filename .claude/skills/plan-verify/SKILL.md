---
name: plan-verify
description: "Use after drafting `_notes/plan.md` to verify SudoLang contract compliance: sections, checkbox rules, criteria↔TODO traceability, and unresolved decision handling."
---

# plan-verify

Validate that a plan follows the `sudlang` contract before signaling readiness.

## Verification checklist

- Required sections exist: `Description`, `Acceptance Criteria`, `TODOs`.
- All Acceptance Criteria entries are `- [ ]` checkboxes.
- Every TODO is a `### TODO-N: <title>` header section.
- Each TODO header contains a `- [ ]` checkbox as the first item.
- Each TODO has all required fields: **Details**, **Skills**, **Autotest**, **Manual test**.
- Every TODO has an **Autotest** field: level (`unit`/`integration`/`e2e`), target file, test cases. `none` only valid for non-behavioral changes.
- Every TODO has a **Manual test** field: concrete steps, inputs, expected outcomes.
- If `Manual test: skip` — a **Skip manual reason** field must exist. Missing → FAIL.
- **Skip manual reason** must be specific — not "too hard". Valid: pure function fully covered by unit tests, no UI/external interface, TODO only adds tests.
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

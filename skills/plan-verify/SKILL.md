---
name: plan-verify
description: "Use after drafting `_notes/plan.md` to verify SudoLang contract compliance: sections, checkbox rules, criteria-TODO traceability, integrity, and contradiction detection."
---

# plan-verify

Validate that a plan follows the `sudlang` contract before signaling readiness.

## Scope guard (prevent skill misfire)

Use this skill **only** when the artifact under review is `_notes/plan.md` (or equivalent plan document with Acceptance Criteria + TODO sections).

If the active request is implementation/execution (for example work-manager `implement`, `work-next`, code edits, running tests, or commit-only tasks), **do not run plan-verify checks**. Hand off to the appropriate execution skill instead.

If the user message or injected context appears to contain a different skill header/config (for example `work-implement` YAML), treat that as routing noise and continue verifying only the plan document.

## Verification checklist

### Preflight (required before checklist)
- Confirm the target file path being verified (default `_notes/plan.md`).
- If the plan file is missing, return `FAIL` with location `plan file` and ask the user to provide/create it.
- If the document is not a plan contract (missing both Acceptance Criteria and TODOs), return `FAIL` with location `document type` and request the correct artifact.

### Structure
- Required sections exist: `Description`, `Glossary`, `Acceptance Criteria`, `TODOs`.
- All Acceptance Criteria entries are `- [ ]` checkboxes.
- Every TODO is a `### TODO-N: <title>` header section.
- Each TODO header contains a `- [ ]` checkbox as the first item.
- Each TODO has all required fields: **Details**, **Skills**, **Autotest**, **Manual test**.

### Test strategy
- Every TODO has an **Autotest** field specifying: level (`unit`/`integration`/`e2e`), target file, and test cases. `Autotest: none` only valid for non-behavioral changes (rename, move, docs).
- Every TODO has a **Manual test** field specifying concrete human-executable steps with inputs and expected outcomes.
- If `Manual test: skip` — a **Skip manual reason** field must explain why manual testing adds no value beyond autotests. Missing reason → FAIL.
- **Skip manual reason** must be specific (not "too hard" or "not worth it"). Valid: pure function fully covered by unit tests, no UI/external interface, TODO only adds tests.

### Traceability
- Every TODO declares a C4 `level:` (L1-L4).
- TODOs that change code include concrete file paths.

### C4 level gates
- Design decisions at level N are fixed before TODOs at level N+1 exist.
- L4 (Code-level) TODOs include a SudoLang algorithm block — declarative pseudocode with constraints/invariants.

### Glossary
- Glossary exists and every domain noun in Criteria/TODOs has an entry.
- Glossary uses domain language, not implementation jargon (`Order`, not `OrderDTO`).

### Open questions
- Open decisions/questions are explicit (not hidden in TODO text).
- No unresolved open questions or decisions — all must be resolved before the plan passes. If any exist, FAIL and list them so the user can decide.

### Clarity
- No vague TODOs (`improve`, `refactor stuff`, `handle edge cases` without specifics).

### Integrity checks
- Every `criteria:` reference in a TODO points to an existing AC ID.
- Every `decisions:` reference in a TODO points to an existing Decision ID.
- Every `depends on:` reference points to an existing item.
- No orphaned Decisions (every Decision is referenced by at least one TODO or another Decision).
- No circular dependencies between TODOs.
- TODO file paths are consistent — the same file is not claimed by contradicting TODOs.

### Contradiction detection
- No two Decisions contradict each other (e.g., D1 says "use REST" while D5 says "use gRPC" for the same interface).
- Glossary terms are consistent — the same concept must not have conflicting definitions.
- Acceptance Criteria do not contradict each other (e.g., AC1 requires feature X, AC3 forbids it).
- L4 algorithm constraints do not violate higher-level decisions (e.g., L2 says "eventual consistency" but L4 algorithm assumes synchronous writes).
- If a contradiction is detected: FAIL with both sides quoted and ask the user to resolve.

## Output format

When issues exist, report each as:
```
FAIL: <rule>
  location: <section/ID>
  fix: <specific rewrite or resolution needed>
```

When contradictions exist, report as:
```
CONTRADICTION: <summary>
  side A: <Decision/AC/Term ID> — <statement>
  side B: <Decision/AC/Term ID> — <statement>
  resolve: <ask user which to keep>
```

When all checks pass:
```
PASS: sudlang contract verified (integrity OK, no contradictions)
```

## Gate rule

Do not declare "Plan is ready" until `PASS` is true.

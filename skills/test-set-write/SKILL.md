---
name: test-set-write
description: Use when the user asks to create test sets, enumerate scenarios, generate edge cases, or draft a coverage matrix before implementation.
---

# Test Set Write

Create complete, implementation-ready test sets with explicit coverage and anti-miss checks.

## Output contract

Each test set must include:
1. **Scope** (feature, interfaces, out-of-scope)
2. **Assumptions** (env, permissions, data constraints)
3. **Scenario matrix** grouped by category
4. **Negative cases** and **boundary values**
5. **Race/retry/partial-failure** cases (if async/distributed)
6. **Oracle** for each case (what proves pass/fail)
7. **Traceability** map: requirement → scenario IDs

## Scenario format

Use stable IDs:
- `TS-HAPPY-001`
- `TS-NEG-00N`
- `TS-BOUNDARY-00N`
- `TS-RESILIENCE-00N`
- `TS-REGRESSION-00N`

For each scenario:
- Preconditions
- Trigger/action
- Expected observable result
- Failure signal(s)
- Priority (P0/P1/P2)

## Mandatory coverage checklist

- Happy path variants (not just one)
- Input validation failures (empty, null, malformed, oversized)
- Boundary values (min-1, min, max, max+1)
- State conflicts (already exists, deleted, stale version)
- Permission/auth variants (allowed, denied, expired)
- Dependency failures (timeout, 5xx, unavailable)
- Partial success handling
- Idempotency and duplicate requests
- Retry behavior and backoff limits
- Deterministic regression cases for known bugs

## Session-derived missed cases to prevent

From Pi/Claude session logs reviewed:
1. **Preflight missing** caused avoidable lint/config failures during verification.
   - Prevention: include a `Tooling Preconditions` section in every test set (required linters/config/assets/auth).
2. **Repeated near-identical fixes** happened after stale state assumptions.
   - Prevention: require `Read-after-change` checkpoint before next edit/test case derivation.
3. **Transient tool/permission stream failures** interrupted flow.
   - Prevention: add explicit `Fallback path` test scenarios (degraded but safe behavior) and stop blind retries.
4. **Partial subsystem failures** needed explicit user-visible assertions.
   - Prevention: include subsystem-specific error assertions (which subsystem failed, message mapping).

## Write algorithm

1. Extract requirements into atomic statements.
2. Build requirement IDs (`R1..Rn`).
3. Generate scenario candidates per requirement + per failure mode.
4. Run mandatory checklist; add missing scenarios.
5. Add preflight/tooling preconditions.
6. Add traceability table (`R# -> TS-*`).
7. Mark unresolved ambiguities as explicit open questions.

## Done criteria

A test set is complete only if:
- Every requirement has ≥1 scenario.
- Every checklist category has ≥1 scenario or explicit N/A reason.
- Every scenario has observable pass/fail oracle.
- Open questions are listed (none hidden).

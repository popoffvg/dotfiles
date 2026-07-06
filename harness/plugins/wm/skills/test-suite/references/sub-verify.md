# Test Set Verify

Audit an existing test set for completeness, correctness, and missed-case risk.

## Verification outputs

Return exactly:
1. **Coverage score** (0-100)
2. **Critical gaps** (must-fix)
3. **Non-critical gaps** (should-fix)
4. **False/weak assertions**
5. **Traceability defects** (requirements without tests or tests without requirements)
6. **Patch plan** (minimal edits to close gaps)

## Scoring rubric

- Requirement coverage: 30
- Negative + boundary depth: 20
- Resilience/failure-mode depth: 20
- Assertion quality (observable outcomes): 15
- Environment/preflight realism: 10
- Determinism/flakiness controls: 5

Fail gate: any P0 path or safety condition missing => **Not Ready** regardless of numeric score.

## Must-check invariants

- No requirement is untested.
- No scenario without explicit oracle.
- No single-point happy-path-only coverage.
- No hidden dependency assumptions.
- No retry loops without termination criteria.
- No vague assertions like "works" / "succeeds".

## Session-derived missed-case checks

Based on Pi/Claude session patterns, always verify:
1. **Tooling preconditions captured**
   - Is there a check for lint/auth/assets/config readiness before test execution?
2. **Stale-state protection present**
   - Do scenarios include read/refresh checkpoints after state-changing actions?
3. **Transient permission/tool failure handling**
   - Are there scenarios for temporary transport/permission interruptions with bounded retry or fallback?
4. **Subsystem-specific failure observability**
   - Do expected results identify exact failing subsystem, not generic failure text?
5. **Duplicate-fix regression lock**
   - Is there a deterministic regression case for previously repeated or reintroduced defects?

## Verification algorithm

1. Parse requirements and scenario IDs.
2. Build requirement↔scenario matrix.
3. Run gap scan by category (happy/neg/boundary/resilience/regression).
4. Evaluate oracle quality per scenario.
5. Run session-derived missed-case checks.
6. Compute score + Not Ready/Ready verdict.
7. Produce minimal patch list with concrete scenario IDs to add/update.

## Verdict format

- Verdict: Ready | Not Ready
- Score: NN/100
- Must-fix now: [IDs]
- Should-fix next: [IDs]
- Minimal patch set: bullet list with exact scenario IDs

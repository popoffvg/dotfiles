# Test Strategy: <TODO-N or task name>

Worked example — the canonical output shape produced by `/test-suite create` (`references/sub-create.md`)
(pairwise tiering). SUT: `POST /auth/refresh` token rotation handler.

## SUT
<one sentence>

## Factors

| ID | Factor | Values | Notes |
|----|--------|--------|-------|
| F1 | input.token | valid / expired / malformed | — |
| F2 | session in redis | present / absent | — |
| F3 | concurrent refresh | single / 2-parallel | only matters with F1=valid |

## Constraints
- F3=2-parallel only with F1=valid (concurrency is meaningful only for valid input).
- F1=malformed implies short-circuit before F2 is read — collapse those rows.

## Unit cases (pairwise + mandatory)

| ID | F1 | F2 | F3 | Tier-specific | Oracle | Priority |
|----|----|----|----|---------------|--------|----------|
| U-SMOKE-1 | valid | present | single | — | returns `{access, refresh}`; old key deleted from mock redis | P0 |
| U-PAIR-1 | expired | present | single | — | returns 401; mock redis untouched | P0 |
| U-PAIR-2 | malformed | — | — | — | returns 400; never calls redis | P0 |
| U-BOUND-1 | valid (token len=max) | present | single | — | returns `{access, refresh}` | P1 |
| U-REGR-1 | valid | absent | single | regression for #1234 | returns 401 (not 500) | P0 |

**Command:** `go test ./pkg/auth/...`

## Integration cases

| ID | F1 | F2 | F3 | Oracle | Priority |
|----|----|----|----|--------|----------|
| I-SMOKE-1 | valid | present | single | 200 + new pair; row gone from real Redis | P0 |
| I-PAIR-1 | valid | present | 2-parallel | exactly one 200, exactly one 401; only one new row in Redis | P0 |
| I-PAIR-2 | expired | present | single | 401; Redis key untouched | P1 |

**Command:** `go test -tags=integration ./pkg/auth/...`

## Manual cases

| ID | Scenario | Steps | Expected | Priority |
|----|----------|-------|----------|----------|
| M-1 | Refresh in browser session | 1. log in; 2. wait until access expires; 3. trigger an API call | network shows 401 → /refresh → retried call returns 200; no visible glitch | P0 |
| M-2 | Log shape on rotation | tail server logs while triggering U-SMOKE-1 | one `auth.refresh.rotated` event with `{user_id, old_kid, new_kid}` | P1 |

## Traceability

| Requirement | Cases |
|-------------|-------|
| Expired token rejected | U-PAIR-1, I-PAIR-2 |
| Old refresh key invalidated on rotation | U-SMOKE-1, I-SMOKE-1, M-2 |
| Concurrent refresh is safe | I-PAIR-1 |
| Malformed input never touches Redis | U-PAIR-2 |

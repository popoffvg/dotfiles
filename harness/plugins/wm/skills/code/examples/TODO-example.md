# TODO-1: Rotate refresh tokens on /auth/refresh

**Type:** workflow
**Depends on:** none
**Risk / blast radius:** 3 — changes the existing `Refresh` signature on `/auth/refresh`; retest the auth middleware and every caller of `Refresh`, not just the new rotation path.
**Thoughts:** [[003-decision-single-flight]], [[001-fact-token-ttl]]

## Outcome

A `User` can issue `RotateToken` to exchange a valid refresh token for a new `TokenPair`. On success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid immediately. If the refresh token has already been used, the `Session` is revoked and the `User` must re-authenticate.

## Changes

**Interface change — `pkg/auth/handler.go`:**

```diff
-func Refresh(ctx context.Context, token string) (string, error)
+func Refresh(ctx context.Context, req RefreshRequest) (TokenPair, error)
```

```ts
type RefreshRequest = { token: string }
type TokenPair = { access: string; refresh: string }

function refresh(req: RefreshRequest): TokenPair | 401 {
  const session = redis.get(`auth:${req.token}`)
  if (!session || session.expiresAt < now()) return 401

  const pair = mintTokens(session.userId)
  redis.del(`auth:${req.token}`)
  redis.set(`auth:${pair.refresh}`, session, TTL)
  return pair
}
```

## Autotest

- **Level:** unit
- **Target files:** `pkg/auth/handler_test.go`, `pkg/auth/token_test.go`
- **Cases:**
  - valid refresh returns 200 + new token pair
  - expired refresh returns 401
  - rotation deletes old Redis key
- **Command:** `go test ./pkg/auth/...`
- **Expected:** all pass, no new lint warnings

## Files

- `pkg/auth/handler.go` — modify
- `pkg/auth/token.go` — modify
- `pkg/auth/handler_test.go` — create

## Pre-reads (MUST read before editing)

- `pkg/auth/middleware.go` — existing token validation
- `pkg/redis/client.go` — Redis helpers used here

## Skills to load

- `go-modify`
- `impl-commit`

## Manual test

- **Steps:**
  1. `make run-dev`
  2. `curl -X POST localhost:8080/auth/refresh -d '{"token":"<valid>"}'`
  3. `curl -X POST localhost:8080/auth/refresh -d '{"token":"<expired>"}'`
- **Expected:**
  1. dev server starts
  2. 200 with new `{access, refresh}` pair
  3. 401, Redis key `auth:<old>` absent (`redis-cli get auth:<old>` → nil)
- **Skip?** no

## Commit

- **Prefix:** feat
- **Subject:** `feat: rotate refresh tokens on /auth/refresh`
- **Description:** Refresh tokens stayed valid after use, so a leaked token granted indefinite access. Rotation invalidates the prior token on every refresh.

## Definition of done

- [ ] All files in **Files** modified/created as specified
- [ ] Autotest command passes
- [ ] Manual test steps produce **Expected** outcomes
- [ ] No edits outside **Files** without logging in `worklog.md`
- [ ] Commit created with the message above

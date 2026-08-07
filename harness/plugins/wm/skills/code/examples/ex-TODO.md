---
status: todo
type: workflow
depends_on: []
risk: 3               # changes the existing Refresh signature; retest the auth middleware and every caller of Refresh, not just the new rotation path
---

# TODO-1: Rotate refresh tokens on /auth/refresh

## Outcome

A `User` can issue `RotateToken` to exchange a valid refresh token for a new `TokenPair`. On success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid immediately. If the refresh token has already been used, the `Session` is revoked and the `User` must re-authenticate.

## Constraints

| Constraint | From |
|------------|------|
| A second refresh on the same token returns 409 — never two valid `TokenPair`s from one token | [[003-decision-single-flight]] |
| A refresh token expires 15 minutes after issue (1 hour in dev); the new pair restarts the window | [[001-fact-token-ttl]] |

## Components

| Component | Part | Role |
|-----------|------|------|
| `pkg/auth.Handler` | main | Exchanges a valid refresh token for a new pair and invalidates the old one |
| `pkg/auth.TokenMinter` | supporting | Mints an access/refresh pair for a user id |

## Changes

### 1. Add the request and pair types — `pkg/auth.Handler`

- **Files:** `pkg/auth/handler.go`
- **Blast radius:** none yet — additive types, nothing reads them until increment 3
- **Diff:**

```diff
+// RefreshRequest is the body of POST /auth/refresh.
+type RefreshRequest struct {
+	Token string `json:"token"`
+}
+
+// TokenPair is an access/refresh token pair minted together; both rotate as a unit.
+type TokenPair struct {
+	Access  string `json:"access"`
+	Refresh string `json:"refresh"`
+}
```

### 2. Return a pair from the minter — `pkg/auth.TokenMinter`

- **Files:** `pkg/auth/token.go`
- **Blast radius:** every caller of `mintTokens` — `pkg/auth/handler.go`, `pkg/auth/login.go`
- **Diff:**

```diff
-func mintTokens(userID string) (string, error) {
-	access, err := signAccess(userID)
-	return access, err
+func mintTokens(userID string) (TokenPair, error) {
+	access, err := signAccess(userID)
+	if err != nil {
+		return TokenPair{}, err
+	}
+	refresh, err := signRefresh(userID)
+	if err != nil {
+		return TokenPair{}, err
+	}
+	return TokenPair{Access: access, Refresh: refresh}, nil
 }
```

### 3. Exchange the token in the handler — `pkg/auth.Handler`

- **Files:** `pkg/auth/handler.go`
- **Blast radius:** every caller of `Refresh` — `pkg/auth/middleware.go`, `cmd/api/routes.go`; a wrong Redis key here silently logs out every session
- **Diff:**

```diff
-func Refresh(ctx context.Context, token string) (string, error)
+func Refresh(ctx context.Context, req RefreshRequest) (TokenPair, error)
```

- **Behavior:**

```ts
function refresh(req: RefreshRequest): TokenPair | 401 | 409 {
  const session = redis.get(`auth:${req.token}`)
  if (!session) return 409 // already rotated — single-flight
  if (session.expiresAt < now()) return 401

  const pair = mintTokens(session.userId)
  redis.del(`auth:${req.token}`)
  redis.set(`auth:${pair.refresh}`, session, TTL)
  return pair
}
```

### 4. Widen the route to the new signature — `pkg/auth.Handler`

- **Files:** `pkg/auth/handler.go`
- **Blast radius:** `POST /auth/refresh` only — the last increment, nothing calls into it
- **Diff:**

```diff
-	tok, err := Refresh(ctx, body.Token)
+	pair, err := Refresh(ctx, RefreshRequest{Token: body.Token})
```

## Autotest

### Unit

- **Target files:** `pkg/auth/handler_test.go` (create), `pkg/auth/token_test.go` (modify)
- **Cases:**
  - valid refresh returns a new token pair, both values different from the input
  - refresh token past its 15-minute TTL returns 401
  - rotation deletes the old Redis key `auth:<old>`
  - second refresh with the same token returns 409 and mints nothing
- **Command:** `go test ./pkg/auth/...`

### E2E

- **Target files:** `test/e2e/auth_refresh_test.go` (create)
- **Entry point:** `POST /auth/refresh` on the running server, same as a real SDK client
- **Cases:**
  - login → refresh → the returned access token authorizes `GET /me` (200)
  - login → refresh → refresh again with the *first* refresh token → 409, and the second pair still authorizes `GET /me`
  - login → wait past TTL → refresh → 401 and `GET /me` with the old access token → 401
- **Command:** `go test -tags e2e ./test/e2e/ -run TestAuthRefresh`

## Files

- `pkg/auth/handler.go` — modify
- `pkg/auth/token.go` — modify
- `pkg/auth/handler_test.go` — create
- `test/e2e/auth_refresh_test.go` — create

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
- [ ] Every **Constraints** row holds in the shipped code
- [ ] Both Autotest commands pass — Unit and E2E
- [ ] Manual test steps produce **Expected** outcomes
- [ ] No edits outside **Files** without recording it in the notes (jj snapshots on session stop)
- [ ] Commit created with the message above

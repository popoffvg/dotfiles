---
status: todo                # todo → impl → verify → done (blocked: dep unmet / verify DEVIATES). Machine: ref-write.md § Status
type: behavior              # behavior | state machine | data shape — the change shape, never a brick
depends_on: []              # [TODO-M, …] real edges only; each must reach status: done first
risk: 3                     # changes the existing Refresh signature; retest the auth middleware and every caller of Refresh, not just the new rotation path
---

# TODO-1: Rotate refresh tokens on /auth/refresh

> A filled `<notes-dir>/todos/TODO-N.md` — **the human half of the pair**. Copy the section order and
> the shape of each one; the rules that govern them are `arch:sub-todo.md` § Section rules, and the
> element list and order are its § Required elements.
> This TODO adds no term missing from `GLOSSARY.md`, so it carries no `## New terms` section.
> `## Deviations` is shown filled, as `impl` leaves it — a file written by `todo` has no such section.

## Outcome

A `User` can issue `RotateToken` to exchange a valid refresh token for a new `TokenPair`. On success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid immediately. If the refresh token has already been used, the `Session` is revoked and the `User` must re-authenticate.

## Components

| Component | Touch | Type | Part | Role |
|-----------|-------|------|------|------|
| `pkg/auth.Handler` | modify | server | main | Exchanges a valid refresh token for a new pair and invalidates the old one |
| `pkg/auth.TokenMinter` | modify | command | supporting | Mints an access/refresh pair for a user id |

## Surface

- `pkg/auth/handler.go`

```diff
+type RefreshRequest struct {
+	Token string `json:"token"`
+}
+
+type TokenPair struct {
+	Access  string `json:"access"`
+	Refresh string `json:"refresh"`
+}
+
-func Refresh(ctx context.Context, token string) (string, error)
+func Refresh(ctx context.Context, req RefreshRequest) (TokenPair, error)
```

- `pkg/auth/token.go`

```diff
-func mintTokens(userID string) (string, error)
+func mintTokens(userID string) (TokenPair, error)
```

- `scripts/release-check.sh` — no surface; a script is a body. Contract:

```
scripts/release-check.sh          # no args, no flags
exit 0  → every check passed, one summary line on stdout
exit 1  → first failed check on stderr, prefixed `FAIL: `
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

## Commit

**Title:** `feat: rotate refresh tokens on /auth/refresh`

**Body:**

Refresh tokens stayed valid after use, so one leaked token granted access for as long as the user
kept refreshing.

Each refresh now returns a new pair and revokes the token it replaces, so a stolen token dies at the
next legitimate refresh.

A short expiry on the refresh token was the other option. It was rejected because it signs out an
idle user on a normal day, and the stolen token stays usable until it expires.

## Deviations

| What | Shipped instead | Why | Note |
|------|-----------------|-----|------|
| `## Surface`: `Refresh` | takes `ctx context.Context` as its first argument | the store call it now makes must be cancellable | [[012-impl-decision-refresh-takes-ctx]] |

---

**Increments:** [TODO-1.agent.md](TODO-1.agent.md)

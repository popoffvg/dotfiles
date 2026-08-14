---
status: todo                # todo → impl → verify → done (blocked: dep unmet / verify DEVIATES). Machine: ref-write.md § Status
type: behavior              # behavior | state machine | data shape — the change shape, never a brick
depends_on: []              # [TODO-M, …] real edges only; each must reach status: done first
risk: 3                     # changes the existing Refresh signature; retest the auth middleware and every caller of Refresh, not just the new rotation path
---

# TODO-1: Rotate refresh tokens on /auth/refresh

> This file is a filled TODO body. Copy it to `<notes-dir>/todos/TODO-N.md`, replace the content,
> and delete every `>` line — each one states the rule for the block above it.
> The H1 title is imperative, ≤ 60 chars. `N` is 1-indexed and contiguous, one file per ledger row.
> Budget: ≤ 512 lines. Over budget means two deliverables — split the ledger row.
> Sections run in this order and no other. A human reads down to Commit with the repo closed and
> stops there; everything below it is scaffolding for the implementer.

## Outcome

A `User` can issue `RotateToken` to exchange a valid refresh token for a new `TokenPair`. On success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid immediately. If the refresh token has already been used, the `Session` is revoked and the `User` must re-authenticate.

> `<actor> can <capability> [when <condition>]`, 2–5 sentences, present tense, active. The first
> sentence is the capability; the rest give a reader without context the trigger, the state change,
> and the failure. `GLOSSARY.md` terms verbatim.
> Banned: file paths, function or struct names, routes, package names, libraries, "add a field",
> "wire up". A pure refactor says so: "No new capability; reshapes X so future Y share a path".

## New terms

> Present only when the TODO introduces a term missing from `GLOSSARY.md`; the term is added there
> in the same pass. Otherwise delete the whole section — never write "none".
>
> | Term | Kind | Description |
> |------|------|-------------|
> | TokenJar | entity | Per-user container of active refresh tokens; bounded to 5, LRU-evicted |
>
> `Kind` is one word from the `GLOSSARY.md` set — data or brick. The description is one sentence
> carrying the visible contract: TTL, bounds, error semantics.

## Constraints

| Constraint | From |
|------------|------|
| A second refresh on the same token returns 409 — never two valid `TokenPair`s from one token | [[003-decision-single-flight]] |
| A refresh token expires 15 minutes after issue (1 hour in dev); the new pair restarts the window | [[001-fact-token-ttl]] |

> One row per settled decision **an increment below can violate** — this is the implementer's only
> source for settled decisions, since `spec.md` keeps none. State the rule as an invariant or an
> imperative; the trade-off and the rejected options stay in the note.
> A decision no increment here can violate binds another TODO — omit it. A constraint the tests can
> check gets a matching Autotest case. Nothing binds this slice → delete the section.

## Components

| Component | Touch | Type | Part | Role |
|-----------|-------|------|------|------|
| `pkg/auth.Handler` | modify | server | main | Exchanges a valid refresh token for a new pair and invalidates the old one |
| `pkg/auth.TokenMinter` | modify | command | supporting | Mints an access/refresh pair for a user id |

> **Component** — `package.Class` in the project's notation, a symbol and never a bare path.
> **Touch** — what this TODO does to the symbol: `create | modify | delete`, e.g.
> `| pkg/auth.TokenJar | create | service | supporting | Holds one user's active refresh tokens |`.
> It types the symbol, not the file — a created component may land in a file **Files** marks
> `modify`. A component this TODO only reads is not touched and stays out of the table; name it in
> **Pre-reads** instead.
> **Type** — the brick: `command | service | flow | gateway | server | consumer | policy |
> scheduler | wiring` (roster: the `arch` skill). Fits none, or fits two → the component owns more
> than one responsibility; split it before writing this body.
> **Part** — exactly one row is `main`, the component carrying the Outcome's behavior. Two
> candidates → the TODO does two things.
> **Role** — this TODO's slice of the component's job, not its full purpose.
> ≤ 5 rows. Every row maps to at least one path in **Files**, and every non-test path in **Files**
> belongs to a row.

## Changes

> An ordered increment sequence — the diffs that build the commit, in apply order. `n` contiguous
> from 1, ≤ 10 increments, each naming one Components row and no row missing from that table.
> Order deepest-first so the repo builds after each. Increment 1 creates the commit; each later
> approved increment is appended to it. A rejected increment stops the TODO.

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

> **Files** — this increment's paths only, a subset of `## Files`.
> **Blast radius** — the predicted reach of a mistake: the symbols, callers, and consumers a wrong
> edit forces you to retest. Name them; "low" is not a blast radius.
> **Diff** — ≤ 25 changed lines, real language, one block per file. New surface is all-`+` and
> written out in full: every field, method, and doc comment. No `// ...`. An increment that cannot
> build alone adds `builds: only with increment <n>`.

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

> **Behavior** appears on the one increment carrying the Outcome's logic, and only when the diff
> does not already show the flow. TS pseudocode following the `flow-scetch` skill: ≤ 40 lines, every
> side effect and error path visible, no real imports or paths inside the snippet. It must deliver
> the Outcome above. The sketch shape comes from `type` first, then the `main` component's brick.

### 4. Widen the route to the new signature — `pkg/auth.Handler`

- **Files:** `pkg/auth/handler.go`
- **Blast radius:** `POST /auth/refresh` only — the last increment, nothing calls into it
- **Diff:**

```diff
-	tok, err := Refresh(ctx, body.Token)
+	pair, err := Refresh(ctx, RefreshRequest{Token: body.Token})
```

## Autotest

> Both levels are required. A level that cannot exist says `none — <concrete reason>`; an E2E
> deferred to another TODO names that TODO.

### Unit

- **Target files:** `pkg/auth/handler_test.go` (create), `pkg/auth/token_test.go` (modify)
- **Cases:**
  - valid refresh returns a new token pair, both values different from the input
  - refresh token past its 15-minute TTL returns 401
  - rotation deletes the old Redis key `auth:<old>`
  - second refresh with the same token returns 409 and mints nothing
- **Command:** `go test ./pkg/auth/...`

> Each case proves part of the Outcome or one `## Constraints` row. One sentence each, input →
> expected. **Command** is a single runnable shell command.

### E2E

- **Target files:** `test/e2e/auth_refresh_test.go` (create)
- **Entry point:** `POST /auth/refresh` on the running server, same as a real SDK client
- **Cases:**
  - login → refresh → the returned access token authorizes `GET /me` (200)
  - login → refresh → refresh again with the *first* refresh token → 409, and the second pair still authorizes `GET /me`
  - login → wait past TTL → refresh → 401 and `GET /me` with the old access token → 401
- **Command:** `go test -tags e2e ./test/e2e/ -run TestAuthRefresh`

> **Entry point** is where the request enters as a caller enters it. Each case asserts the Outcome
> as an observer sees it, never as the implementation sees it.

## Commit

**Title:** `feat: rotate refresh tokens on /auth/refresh`

**Body:**

Refresh tokens stayed valid after use, so one leaked token granted access for as long as the user
kept refreshing.

Each refresh now returns a new pair and revokes the token it replaces, so a stolen token dies at the
next legitimate refresh.

A short expiry on the refresh token was the other option. It was rejected because it signs out an
idle user on a normal day, and the stolen token stays usable until it expires.

> The one commit every increment above appends to — the chain's last link, and the human's last read.
> **Title** — the literal `<prefix>: <line>` the implementer commits, ≤ 72 chars, imperative, no
> period. Prefix ∈ feat | fix | refactor | chore | docs | test.
> **Body** — one paragraph per part, in order: cause, goal, and the decision if the commit rejected a
> live alternative. Cause and goal come from the ledger row's `Why`; the decision from the notes this
> TODO obeys. Contract: the `commit-message` skill.
> Read it against the Outcome: the body claims a capability the Outcome does not, or the Outcome
> names one the body cannot account for → one of the two is wrong. Fix it before any increment lands.

<!-- ── Everything below is scaffolding: machine-checkable, no human read ── -->

## Files

- `pkg/auth/handler.go` — modify
- `pkg/auth/token.go` — modify
- `pkg/auth/handler_test.go` — create
- `test/e2e/auth_refresh_test.go` — create

> One line per path: create | modify | delete | rename → `<new path>`.

## Pre-reads (MUST read before editing)

- `pkg/auth/middleware.go` — existing token validation
- `pkg/redis/client.go` — Redis helpers used here

> Every file the implementer must understand before editing, with the reason. None → `none — reason: <specific>`.

## Skills to load

- `go-modify`
- `impl-commit`

> None → `none`.

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

> Steps are literal commands or actions; Expected aligns 1:1 with them. Skipping needs a specific reason.

## Definition of done

- [ ] All files in **Files** modified/created as specified
- [ ] Every **Constraints** row holds in the shipped code
- [ ] Both Autotest commands pass — Unit and E2E (or the level is `none` with its stated reason)
- [ ] Manual test steps produce **Expected** outcomes
- [ ] No edits outside **Files** without recording it in the notes (jj snapshots on session stop)
- [ ] Commit created with the message above

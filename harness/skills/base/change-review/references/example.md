# A stolen refresh token stops working at the next refresh

## Outcome

> **Check:** each bullet is a thing a user or a caller can do once this change lands. Find the capability you expect and do not see, and the one you did not ask for.

- A `User` can issue `RotateToken` to exchange a valid refresh token for a new `TokenPair` — a public method on `pkg/auth.Handler`.
- On success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid immediately — a state machine on `Session`: active → rotated → revoked.
- If the refresh token has already been used, the `Session` is revoked and the `User` must re-authenticate — reuse is the trap state.
- The refresh TTL is a setting, 15 minutes by default — a config key.

## New terms

> **Check:** read each **Description** once. Say if you would use another word for this thing, or if the word already means something else in the code.

| Term | Kind | Description | Forbidden |
|------|------|-------------|-----------|
| TokenJar | entity | Per-user container of active refresh tokens; bounded to 5, LRU-evicted | token bag, `TokenSet` |

## Components

> **Check:** this tree is the whole reach of the change. Find the component you know must change and do not see here. Confirm that the `main` component is the one that carries the Outcome.

```text
  pkg/auth                            # OWNS the refresh exchange
~ ├── Handler                         #   server · main — exchanges a valid refresh token for a new pair
~ │   └── Refresh()                   #     takes a `RefreshRequest`, returns a `TokenPair`, and invalidates the old refresh token
~ └── TokenMinter                     #   command · supporting — mints an access/refresh pair for a user id
~     └── MintPair()                  #     returns a `TokenPair` instead of one token string

  cmd/api                             # OWNS the HTTP routes
~ └── Routes                          #   wiring · supporting — maps `POST /auth/refresh` to the handler

  scripts                             # OWNS the release scripts
+ └── ReleaseCheck                    #   command · supporting — builds from clean and checks every asset against the manifest
```

## Flow changes

> **Check:** read the marked steps only. Confirm that each new check runs at the right place, and that each stop gives the caller the right answer.

### The session refresh, POST /auth/refresh — main flow step 4

*`pkg/auth.Handler.Refresh`*

```python
def Refresh(body):
    request = decode(body, RefreshRequest)
    if malformed(request):
        return 400
    token = store.lookup(request.refresh_token)
    if token is None or token.expired:
        return 401
    if token.used:                                  # +
        revoke(token.session)                       # +
        return 409                                  # +
    pair = TokenPair(                               # ~ was: one access token
        access=sign_access_token(token.user_id),
        refresh=sign_refresh_token(token.user_id),  # +
    )
    store.delete(token)                             # +
    emit(TokenRotated)                              # +
    return pair, 200
```

## Increments

> **Check:** for each increment, read the summary, then **Surprises**. Agree or disagree with each surprise: these are the details you would otherwise find only in the code. Confirm that each diff stays in the one component under its heading. At each `### Commit` section, confirm that its title states one change.

### 1.1. Add the request and pair types

*`pkg/auth.Handler`*

The handler gains a request type that carries one refresh token, and a pair type that carries a new access token and a new refresh token. Nothing reads them yet.

- **Change:** signature change
- **Extends:** new — checked `pkg/auth.LoginRequest` and `pkg/auth.Session`: neither carries a refresh token, and both are read by callers this change does not touch
- **Surprises:**
  - none — no code reads the two types until increment 1.2
- **Surface:**

```diff
+type RefreshRequest struct {
+	Token string `json:"token"`
+}
+
+type TokenPair struct {
+	Access  string `json:"access"`
+	Refresh string `json:"refresh"`
+}
```

### 1.2. Return a pair from the minter

*`pkg/auth.TokenMinter`*

Before, `mintTokens` signed one access token for a user id. Now it also signs a refresh token and returns both as one `TokenPair`.

- **Change:** signature change
- **Extends:** `pkg/auth.mintTokens` — returns the refresh token beside the access token
- **Surprises:**
  - A signing error on either token fails the whole mint: no half pair is returned, and the error passes through unchanged.
  - `Handler.Login` and `Handler.Refresh` stop compiling until increment 1.3 moves them to the pair.
- **Surface:**

```diff
-func mintTokens(userID string) (string, error)
+func mintTokens(userID string) (TokenPair, error)
```

### 1.3. Read the access token from the pair

*`pkg/auth.Handler`*

`Login` and `Refresh` call the new `mintTokens` and use `pair.Access` where they used the one token before. What each call returns to its client does not change.

- **Change:** call-site migration
- **Extends:** `pkg/auth.Handler.Login`, `pkg/auth.Handler.Refresh` — read the access token from the pair
- **Surprises:**
  - `Refresh` keeps its old behavior here: increment 2.1 changes it.
- **Surface:** none — no signature or field changes; only the two call sites change.

---

### Commit 1

**Title:** `refactor: return a token pair from the minter`

**Body:**

The minter signed only an access token, so a refresh could not hand out a new refresh token.

The minter now signs both tokens and returns them as one pair. Login and refresh read the access token from the pair, so no client sees a change yet.

**Proves:** Unit — `a mint signs both tokens`

### 2.1. Exchange the token in the handler

*`pkg/auth.Handler`*

Before, `Refresh` checked a refresh token and returned a new access token, and the old refresh token stayed valid. Now it takes a `RefreshRequest`, returns a new `TokenPair`, and deletes the old refresh token, so each token works once.

- **Change:** new behavior
- **Extends:** `pkg/auth.Handler.Refresh` — exchanges the token instead of only checking it
- **Surprises:**
  - A token that is already used answers 409, not 401: 409 tells the client a second refresh raced this one.
  - The old token is deleted before the new one is stored. A crash between the two steps logs the user out; it never leaves two valid tokens.
  - `cmd/api.Routes` stops compiling until increment 2.2 moves it to the new call.
- **Surface:**

```diff
-func Refresh(ctx context.Context, token string) (string, error)
+func Refresh(ctx context.Context, req RefreshRequest) (TokenPair, error)
```

### 2.2. Route the refresh request to the new call

*`cmd/api.Routes`*

Before, the `POST /auth/refresh` route passed the raw token string to `Refresh` and wrote back one access token. Now it decodes the body into a `RefreshRequest` and writes back the whole `TokenPair` as JSON.

- **Change:** wiring
- **Extends:** `cmd/api.Routes` — the refresh route takes and returns the new types
- **Surprises:**
  - A body that does not decode answers 400 before `Refresh` runs, so a malformed request never touches the store.
  - The response body changes from a bare string to an object: a client that reads the old shape breaks.
- **Surface:** none — the route path and method stay; only the body shapes change, and increment 1.1 declares them.

---

### Commit 2

**Title:** `feat: rotate refresh tokens on /auth/refresh`

**Body:**

Refresh tokens stayed valid after use, so one leaked token granted access for as long as the user kept refreshing.

Each refresh now returns a new pair and revokes the token it replaces, so a stolen token dies at the next legitimate refresh.

A short expiry on the refresh token was the other option. It was rejected because it signs out an idle user on a normal day, and the stolen token stays usable until it expires.

**Proves:** Unit — `a rotation mints one new pair`, `a reused token`, `an unknown token`; E2E — `a replayed token fails and the live pair still works`

### 3.1. Add the release check

*`scripts.ReleaseCheck`*

A new script builds the release from clean, checks each asset against the manifest, and builds a second time to prove the cache works. It stops at the first failure and prints what failed.

- **Change:** new behavior
- **Extends:** new — checked `scripts/` and the CI jobs: no step checks a release before it ships
- **Surprises:**
  - It refuses to run when `CI` is set, because the build step publishes from CI.
  - The second build must not touch the network; a refetch fails the check even when every asset is correct.
- **Surface:** no diff — a script is a body. Contract:

```
release-check          # no args, no flags
exit 0  → every check passed, one summary line on stdout
exit 1  → first failed check on stderr, prefixed `FAIL: `
```

---

### Commit 3

**Title:** `build: check a release before it ships`

**Body:**

Nothing checked a release before it shipped, so a missing asset reached users.

A script now builds the release from clean and checks every asset against the manifest.

**Proves:** none — the script has no automated case; a manual run against a real build proves it.

## Deviations

> **Check:** each row is a place where the shipped code differs from the text you approved. Agree with each **Why**, or ask for the approved shape.

| What | Shipped instead | Why |
|------|-----------------|-----|
| `## Increments` 2.1: `Refresh` | takes `ctx context.Context` as its first argument | the store call it now makes must be cancellable |

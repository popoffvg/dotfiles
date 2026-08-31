# TODO-1 — increments

> A filled `<notes-dir>/todos/TODO-N.agent.md` — the **agent half** of the pair. Copy the section
> order and the shape of each increment; the rules that govern them are
> `arch:ref-todo-sections.md`, and the element list and order are `arch:sub-todo.md`
> § Required elements.

**Design:** [TODO-1.md](TODO-1.md) — Outcome, Components, **Surface** (the diff), Autotest, Commit.

## Constraints

Obey [CONSTRAINTS.md](../CONSTRAINTS.md) — every row.

## Changes

### 1. Add the request and pair types — `pkg/auth.Handler`

- **Files:** `pkg/auth/handler.go`
- **Surface:** `RefreshRequest`, `TokenPair`
- **Do:** Add both types as § Surface declares them. Nothing reads them yet — this increment is additive and exists so increments 2 and 3 have a type to return.
- **Blast radius:** none yet — additive types, nothing reads them until increment 3

> The shape every increment follows. Note what is absent: the type declarations themselves. They are
> in § Surface, and repeating them here would put one fact in two files.

### 2. Return a pair from the minter — `pkg/auth.TokenMinter`

- **Files:** `pkg/auth/token.go`
- **Surface:** `mintTokens`
- **Do:** Widen `mintTokens` to the § Surface signature. Mint the refresh token alongside the access token and return both; propagate either signing error unchanged. Migrate both call sites to the new return.
- **Blast radius:** every caller of `mintTokens` — `pkg/auth/handler.go`, `pkg/auth/login.go`

> **Do** names the migration explicitly. A signature change whose callers are not named in some
> increment's **Do** is a caller that will be left broken.

### 3. Exchange the token in the handler — `pkg/auth.Handler`

- **Files:** `pkg/auth/handler.go`
- **Surface:** `Refresh`
- **Do:** Reshape `Refresh` to the § Surface signature and implement the rotation: look the session up by the presented refresh token, mint a new pair, delete the old key, store the new one. Migrate `middleware.go` and `cmd/api/routes.go` to the new call.
- **Blast radius:** every caller of `Refresh` — `pkg/auth/middleware.go`, `cmd/api/routes.go`; a wrong Redis key here silently logs out every session
- **Behavior:**

```ts
function refresh(req: RefreshRequest): TokenPair | 401 | 409 {
  const session = lookupSession(req.token)
  if (!session) return 409 // already rotated — single-flight
  if (session.expiresAt < now()) return 401

  const pair = mintTokens(session.userId)
  dropSession(req.token)
  storeSession(pair.refresh, session, TTL)
  return pair
}
```

> This increment carries the Outcome's logic, so **Do** is not enough on its own: the two failure
> codes and the delete-before-store order are decisions a reader cannot infer from the prose. The
> sketch is pseudocode — `lookupSession`, not `redis.get`; no real import, key format, or path appears
> in it, so there is nothing to copy.

### 4. Add the release check — `scripts.ReleaseCheck`

- **Files:** `scripts/release-check.sh` (create)
- **Surface:** none — a script is a body; its contract is the plain block in § Surface
- **Do:** Write the check as that contract describes, in the order the sketch below gives. Fail on the first failure with a `FAIL: ` message naming what failed.
- **Blast radius:** the release job only — nothing imports it; a false pass here ships an unbuilt asset
- **Behavior:**

```ts
function releaseCheck(): 0 | 1 {
  if (env.CI) return fail("run with CI unset — publish must not fire from a check")

  cleanBuildDirs()
  build()

  for (const variant of VARIANTS) {
    for (const [name, wantBytes] of manifest(variant).expectedBytes) {
      if (!exists(asset(variant, name))) return fail(`missing ${variant}/${name}`)
      if (sizeOf(asset(variant, name)) !== wantBytes) return fail(`${variant}/${name} size ≠ manifest`)
    }
    if (!exists(licenceNotes(variant))) return fail(`${variant} ships no licence notes`)
  }

  if (!exists(DESCRIPTOR)) return fail("the build produced no asset descriptor")
  if (catalogueRef() !== EXPECTED_REF) return fail("the catalogue entrypoint misses the descriptor")

  const second = rebuild()                          // the cache edge: must not touch the network
  if (second.refetched) return fail("a second build refetched from the network")
  if (second.alreadyPresent !== TOTAL_FILES) return fail("a file was neither cached nor fetched")

  return 0
}
```

> **The shape to copy when the deliverable is a whole body** — a script, a test file, a migration, a
> query. `Surface: none`, and the sketch carries the checks in order and, above all, **the edge cases**:
> the env var that must be unset, the second run that must not refetch, the count that must match.
> `stat -f%z`, `jq -r`, `set -euo pipefail`, the real paths: all of it is implementation the implementer
> writes at the keyboard. Paste the finished script into either half and the TODO stops being a spec.

## Files

- `pkg/auth/handler.go` — modify
- `pkg/auth/token.go` — modify
- `pkg/auth/handler_test.go` — create
- `scripts/release-check.sh` — create
- `test/e2e/auth_refresh_test.go` — create

## Pre-reads (MUST read before editing)

- `pkg/auth/middleware.go` — existing token validation
- `pkg/redis/client.go` — Redis helpers used here

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

## Definition of done

- [ ] All files in **Files** modified/created as specified
- [ ] Every `CONSTRAINTS.md` row holds in the shipped code
- [ ] Both Autotest commands pass — Unit and E2E (or the level is `none` with its stated reason)
- [ ] Manual test steps produce **Expected** outcomes
- [ ] No edits outside **Files** without recording it in the notes (jj snapshots on session stop)
- [ ] Every symbol in `TODO-1.md` § Surface has its declared shape in the shipped code
- [ ] Commit created with the `TODO-1.md` **Commit** message

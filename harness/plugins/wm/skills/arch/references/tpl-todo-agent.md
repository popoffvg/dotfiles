# TODO-1 — increments

> This file is a filled TODO **agent half**. Copy it to `<notes-dir>/todos/TODO-N.agent.md`, replace
> the content, and delete every `>` line — each one states the rule for the block above it.
> The H1 is `# TODO-N — increments` and carries no title: the title lives in `TODO-N.md`, and a second
> copy of it drifts. No frontmatter either — `status` has one home, the human half.
> **No line budget, and no diff.** This file is as long as the increments need. The one diff for the
> whole TODO is `TODO-N.md` § Surface; an increment here says *what to do*, never *what to paste*. What
> is still counted: ≤ 10 increments, `n` contiguous from 1, and not a single ```diff block
> (`arch:sub-todo.md` § Budget).
> Sections run in this order and no other.

**Design:** [TODO-1.md](TODO-1.md) — Outcome, Components, **Surface** (the diff), Autotest, Commit.

> The one link back, and the first line in this file. Read it before increment 1, and keep § Surface
> open while working: this file says what to do and in what order, that file says what the code must
> become. Neither half restates the other.

## Constraints

| # | Constraint |
|---|------------|
| C1 | A second refresh on the same token returns 409 — never two valid `TokenPair`s from one token |
| C2 | A refresh token expires 15 minutes after issue (1 hour in dev); the new pair restarts the window |

**Provenance:** [TODO-1.trace.md](TODO-1.trace.md) — one row per `C<n>` above, naming the thought or document it came from.

> One row per settled decision **an increment below can violate** — this is the implementer's only
> source for settled decisions, since `spec.md` keeps none. It sits here, immediately above the
> increments it bounds, because it exists for whoever writes the code: the human settled these
> decisions during the grill and they live in `thoughts/`, so a copy in the human half would be the
> design restating what the reviewer already agreed to.
> **`#`** is the id the trace companion anchors on — `C<n>`, 1-indexed, contiguous, and never reused
> inside one TODO. Renumbering a row silently repoints a trace row at a different rule, so append
> rather than renumber once the trace exists.
> State the rule as an invariant or an imperative. The trade-off, the rejected options, and the note
> or document behind the rule all stay out of this table: `TODO-1.trace.md` is where a reader goes
> for the why, and it is the one home for provenance.
> A decision no increment below can violate binds another TODO — omit it. A constraint the tests can
> check gets a matching case in the human half's `## Autotest`. Nothing binds this slice → delete the
> whole section, never write "none".

## Changes

> An ordered increment sequence — **what to do, in apply order, and never a diff.** The diff for the
> whole TODO lives once, in `TODO-1.md` § Surface; an increment says which slice of it to deliver and
> what the code behind that slice must do. `n` contiguous from 1, ≤ 10 increments, each naming one row
> of `TODO-1.md` § Components and no row there missing from this sequence. Order deepest-first so the
> repo builds after each. Increment 1 creates the commit; each later approved increment is appended to
> it. A rejected increment stops the TODO.
>
> Each increment carries these bullets, in order:
> **Files** — this increment's paths only, a subset of `## Files`.
> **Surface** — which part of `TODO-1.md` § Surface this increment lands, named by symbol. `none` when
> the increment adds no surface (a body-only file, a wiring change).
> **Do** — one to four imperative sentences: the work, in words. What to write, what to migrate, what
> to delete. No code, no fenced block, no pasted signature — the signature is already in § Surface and
> a second copy drifts.
> **Blast radius** — the predicted reach of a mistake: the symbols, callers, and consumers a wrong edit
> forces you to retest. Name them; "low" is not a blast radius.
> **Behavior** — only where **Do** cannot carry the logic: a real branch structure, an error path that
> matters, an ordering that is not obvious. TS pseudocode per the `flow-scetch` skill, ≤ 40 lines.
> **Builds** — only when this increment leaves the repo not compiling: `builds: only with increment <n>`.

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

> One line per path: create | modify | delete | rename → `<new path>`.
> Every non-test path maps to a row of `TODO-1.md` § Components, and every row there maps to a path here.

## Pre-reads (MUST read before editing)

- `pkg/auth/middleware.go` — existing token validation
- `pkg/redis/client.go` — Redis helpers used here

> Every file the implementer must understand before editing, with the reason. None → `none — reason: <specific>`.
> A component the TODO only reads belongs here, not in the Components table.

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
- [ ] Every **Constraints** row above holds in the shipped code
- [ ] Both Autotest commands pass — Unit and E2E (or the level is `none` with its stated reason)
- [ ] Manual test steps produce **Expected** outcomes
- [ ] No edits outside **Files** without recording it in the notes (jj snapshots on session stop)
- [ ] Every symbol in `TODO-1.md` § Surface has its declared shape in the shipped code
- [ ] Commit created with the `TODO-1.md` **Commit** message

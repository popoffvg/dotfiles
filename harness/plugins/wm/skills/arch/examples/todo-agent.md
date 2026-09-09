# TODO-1 — increments

**Design:** [TODO-1.md](TODO-1.md) — Outcome, Components, **Surface** (the diff), Autotest, Commit.

> A filled `<notes-dir>/todos/TODO-N.agent.md` — **the agent half of the pair**. Copy the section
> order and the shape of each increment, and delete the `>` lines — each one states the rules for the
> piece above it.
>
> **No frontmatter here.** `status` has one home, the human half, and a second copy of it drifts
> (`arch:sub-todo.md` § Required elements, which also carries the element list and order).
>
> `**Design:**` is the first line: the pair is two files, and each half links the other by name.
>
> The procedure around the file — the fan-out, the budgets, the verification chain, the pre-save
> checklist — is `arch:sub-todo.md`; the rules that cut across sections rather than sitting in one are
> `arch:ref-todo-sections.md`. The prose follows `harness-dev:text-style`.

## Constraints

Obey every rule that `~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts` prints.

> **The command, and nothing else.** One fixed line, first in the file, above the increments it
> bounds. The line is the same in every TODO: it never lists ids, never quotes a rule, never adds a
> case.
>
> **Always present, even when the corpus has settled no decision yet.** Rules appear as decisions
> settle, so a TODO that dropped the line would be implemented against an empty set.
>
> A rule *this* TODO's tests can check gets a matching case in the human half's `## Autotest` — the one
> place a constraint reaches into a single row.
>
> Where the rules come from — the `thoughts/` decision note that *is* the rule — is
> `arch:ref-todo-sections.md` § Constraints. What the generated set looks like:
> `~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts`, run against the live corpus.

## Changes

> **An ordered sequence of increments — what to do, in apply order.** One TODO is still one
> deliverable and one commit; `## Changes` splits only its *execution*, so the implementer lands a
> small, verifiable piece at a time and the human approves each real diff as it appears. How the
> increments reach that one commit, and what a single approval buys:
> `arch:ref-todo-sections.md` § How the increments reach the commit.
>
> **It carries no diff and no pasted signature.** The diff is the human half's `## Surface`, written
> once.
>
> **Increment** = the smallest step worth approving on its own. Its heading is
> ``### <n>. <imperative title> — `<package.Class>` ``, with `n` 1-indexed and contiguous. Each
> increment names exactly one `## Components` row from the human half; a component may span several
> increments.
>
> Each increment carries these bullets, in order:
>
> | Bullet | Required | Content |
> |--------|----------|---------|
> | **Landed** | always | `yes` or `no` — whether this increment is already in the commit. `todo` writes `no` on every increment; `impl` flips one to `yes` after the amend |
> | **Change** | always | the increment's change kind — one of the nine in `impl:ref-change-types.md`, the same roster the TODO's `type:` uses |
> | **Files** | always | the repo-relative paths this increment alone touches — a subset of `## Files` |
> | **Surface** | always | which part of the human half's `## Surface` this increment lands, named by symbol — or `none` when it adds no surface (a body-only file, a wiring change) |
> | **Do** | always | one to four imperative sentences: the work, in words. What to write, what to migrate, what to delete. No code, no fenced block, no pasted signature |
> | **Blast radius** | always | the **predicted** reach: the symbols, callers, and consumers a mistake here forces you to retest. Name them; `"low"` is not a blast radius |
> | **Behavior** | only where **Do** cannot carry the logic — a real branch structure, an error path that matters, a non-obvious ordering | TS pseudocode per the `flow-sketch` skill, ≤ 40 lines, side effects and error paths visible |
> | **Builds** | only when the increment leaves the repo not compiling | `builds: only with increment <n>` |
>
> **Landed is the record; the human half's frontmatter `increment:` is the index over it.** A resuming
> session reads the key to know where to start, then reads the markers to know what it is starting
> after. `impl` writes both in the same step, after the amend (`impl:sub-impl.md` step 5.5), and
> `bin/spec-lint.py` check B11 fails when `<approved>` and the count of `**Landed:** yes` disagree.
> Full rules: `arch:ref-write.md` § Progress.
>
> **Change is the increment's own kind, not the TODO's.** A `type: new behavior` TODO usually holds one
> `new behavior` increment and several that are `signature change`, `wiring`, or `call-site migration`
> around it. That spread tells the human which increment to read line by line and which to glance at,
> before any diff exists. A TODO whose every increment is `wiring` contradicts its own `type:` — one of
> the two is wrong.
>
> **Do is prose, and that is the point.** The signature is in `## Surface`; what an increment adds is
> the *instruction* — which call sites to migrate, what order to touch things in, what to delete. A
> **Do** that pastes the signature back has put one fact in two files; a **Do** that says "implement
> the handler" has said nothing. Every signature change names its call sites in some increment's
> **Do** — `## Surface` shows the new shape, not who has to move to it.
>
> **Ordering — deepest first**, so the repo builds after each increment: the callee before its caller,
> the type before its user, the wiring last. An increment that cannot leave the repo compiling says
> `builds: only with increment <n>`, and that is a last resort.
>
> **Sizing: ≤ 10 increments.** More than that and the TODO is too big — split the ledger row. An
> increment whose **Do** is one sentence is fine; small is the point. The `budget-check` hook counts
> the increments (`arch:sub-todo.md` § Budget) and hard-rejects any ```diff block in this file.
>
> On save the `format-todo` PostToolUse hook runs prettier over each ```ts block. Write the sketch;
> the hook aligns it.

### 1. Add the request and pair types — `pkg/auth.Handler`

- **Landed:** no
- **Change:** signature change
- **Files:** `pkg/auth/handler.go`
- **Surface:** `RefreshRequest`, `TokenPair`
- **Do:** Add both types as § Surface declares them. Nothing reads them yet — this increment is additive and exists so increments 2 and 3 have a type to return.
- **Blast radius:** none yet — additive types, nothing reads them until increment 3

> The shape every increment follows. Note what is absent: the type declarations themselves. They are
> in § Surface, and repeating them here would put one fact in two files.

### 2. Return a pair from the minter — `pkg/auth.TokenMinter`

- **Landed:** no
- **Change:** signature change
- **Files:** `pkg/auth/token.go`
- **Surface:** `mintTokens`
- **Do:** Widen `mintTokens` to the § Surface signature. Mint the refresh token alongside the access token and return both; propagate either signing error unchanged. Migrate both call sites to the new return.
- **Blast radius:** every caller of `mintTokens` — `pkg/auth/handler.go`, `pkg/auth/login.go`

> **Do** names the migration explicitly. A signature change whose callers are not named in some
> increment's **Do** is a caller that will be left broken.

### 3. Exchange the token in the handler — `pkg/auth.Handler`

- **Landed:** no
- **Change:** new behavior
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

- **Landed:** no
- **Change:** new behavior
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

> Every repo-relative path the increments touch, one line each, marked `create` or `modify`.
>
> Every non-test path maps to a `## Components` row in the human half — except a file changed only as
> a consequence of another row's decision, which carries no row of its own.
>
> Each increment's **Files** bullet is a subset of this list
> (`arch:sub-todo.md` § Pre-save checklist).

## Pre-reads (MUST read before editing)

- `pkg/auth/middleware.go` — existing token validation
- `pkg/redis/client.go` — Redis helpers used here

> Every file to understand before editing, one line each saying what to take from it.
>
> **Mandatory and never empty.** An implementer with no context needs the reading list even when the
> increments look self-explanatory.
>
> A component this TODO only *reads* belongs here rather than in the human half's `## Components` —
> that table is what the TODO changes.

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

> **Required even when Autotest covers the behaviour** — it catches the integration and the UX a suite
> cannot see.
>
> `Steps` are literal commands and `Expected` outcomes align 1:1 by number.
>
> `Skip?` defaults to `no`; to skip, `skip — reason: <specific>`.
>
> Keep only cases a test cannot prove: UX feel, log shape, real third-party behaviour.

## Definition of done

- [ ] All files in **Files** modified/created as specified
- [ ] Every rule `~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts` prints holds in the shipped code
- [ ] Both Autotest commands pass — Unit and E2E (or the level is `none` with its stated reason)
- [ ] Manual test steps produce **Expected** outcomes
- [ ] No edits outside **Files** without recording it in the notes (jj snapshots on session stop)
- [ ] Every symbol in `TODO-1.md` § Surface has its declared shape in the shipped code
- [ ] Commit created with the `TODO-1.md` **Commit** message

> The checklist the implementer ticks before advancing `status` to `verify` and filling the ledger's
> Commit: Files, constraints, Autotest, Manual test, scope discipline, Surface, Commit.
>
> Add items only for unusual post-conditions — "migration applied on staging", a feature flag to flip.
>
> **It sits in the agent half, so it points at this file where it can.** The Files row names a section
> above it and the constraints row names the generator. The one thing it cannot restate is the commit
> message: that row cites the human half by name.

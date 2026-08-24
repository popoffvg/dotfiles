---
status: todo                # todo → impl → verify → done (blocked: dep unmet / verify DEVIATES). Machine: ref-write.md § Status
type: behavior              # behavior | state machine | data shape — the change shape, never a brick
depends_on: []              # [TODO-M, …] real edges only; each must reach status: done first
risk: 3                     # changes the existing Refresh signature; retest the auth middleware and every caller of Refresh, not just the new rotation path
---

# TODO-1: Rotate refresh tokens on /auth/refresh

> This file is a filled TODO body — **the human half of the pair**. Copy it to
> `<notes-dir>/todos/TODO-N.md`, replace the content, and delete every `>` line — each one states
> the rule for the block above it.
> The H1 title is imperative, ≤ 60 chars. `N` is 1-indexed and contiguous, one **pair** plus its
> **trace** per ledger row.
> Budget: ≤ 550 lines — a ceiling on the row, not a nudge about prose. A human half that long is
> two deliverables wearing one number; split the ledger row. The `budget-check` hook counts it on
> every write (`arch:sub-todo.md` § Budget).
> **The increments live in `TODO-1.agent.md`, described and never diffed** — this file holds the one
> diff, in `## Surface`. No test-file body, and no per-increment path list, appears here.
> Sections run in this order and no other. A human reads this file end to end with the repo closed
> and never opens the agent file.

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

## Components

| Component | Touch | Type | Part | Role |
|-----------|-------|------|------|------|
| `pkg/auth.Handler` | modify | server | main | Exchanges a valid refresh token for a new pair and invalidates the old one |
| `pkg/auth.TokenMinter` | modify | command | supporting | Mints an access/refresh pair for a user id |

> **Component** — `package.Class` in the project's notation, a symbol and never a bare path.
> **Touch** — what this TODO does to the symbol: `create | modify | delete`, e.g.
> `| pkg/auth.TokenJar | create | service | supporting | Holds one user's active refresh tokens |`.
> It types the symbol, not the file — a created component may land in a file the agent file's
> **Files** marks `modify`. A component this TODO only reads is not touched and stays out of the
> table; it belongs in the agent file's **Pre-reads** instead.
> **Type** — the brick: `command | service | flow | gateway | server | consumer | policy |
> scheduler | wiring` (roster: the `arch` skill). Fits none, or fits two → the component owns more
> than one responsibility; split it before writing this body.
> **Part** — exactly one row is `main`, the component carrying the Outcome's behavior. Two
> candidates → the TODO does two things.
> **Role** — this TODO's slice of the component's job, not its full purpose.
> ≤ 5 rows. This table is the map the agent file's `## Changes` walks: every row is named by at
> least one increment there, and no increment there names a component missing from here. Each row's
> new shape is shown in `## Surface` below.

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

> **The whole contract change this TODO makes, in one place — and the diff the human approves.**
> One bullet naming the file, then one ```diff for it. Every file with a surface appears; files are
> ordered deepest-first, the same order the increments apply.
> **Surface only** — types, fields, method and function signatures, and settings (config keys, flags,
> defaults) with their real values. New surface is all-`+` in real syntax, no field or signature
> elided, and **no comments of any kind**: a decision that wants one goes in a `thoughts/` note and,
> restated, in the agent file's `## Constraints`.
> **Never a body.** A function body, a loop, a branch chain, a shell script, a query, a regex, a
> fixture, a table of literal expected values — none of it belongs here or anywhere in the pair. The
> body behind each signature is the implementer's to write, from the agent file's **Behavior** sketch.
> The rule and its test: `arch:sub-todo.md` § A diff carries the surface, not a body.
> **A file whose whole content is a body has no surface**, so it carries a plain-fenced contract block
> instead of a ```diff — invocation, arguments, exit codes, output — exactly as `scripts/release-check.sh`
> does above.
> ≤ 150 changed lines per file, unless that file cannot compile below it: then say so in a
> `**Compile floor:**` bullet under its diff.
> This section is what makes the gate real: a human who has read Components knows *which* symbols
> move, and reading this knows *what they become*. It is the last thing they approve before any code
> is written.

## Autotest

> Both levels are required. A level that cannot exist says `none — <concrete reason>`; an E2E
> deferred to another TODO names that TODO.
> **Cases, never a test file.** This section says what is asserted and where the assertion enters —
> it never carries the test's source. A shell script, a fixture, a table of literals, or any block
> that *is* the test body belongs nowhere in the pair: the implementer writes it from the cases
> (`arch:sub-todo.md` § A diff carries the surface, not a body).

### Unit

- **Target files:** `pkg/auth/handler_test.go` (create), `pkg/auth/token_test.go` (modify)
- **Cases:**
  - valid refresh returns a new token pair, both values different from the input
  - refresh token past its 15-minute TTL returns 401
  - rotation deletes the old Redis key `auth:<old>`
  - second refresh with the same token returns 409 and mints nothing
- **Command:** `go test ./pkg/auth/...`

> Each case proves part of the Outcome or one `## Constraints` row from the agent file. One sentence
> each, input → expected. **Command** is a single runnable shell command.

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

> The one commit every increment in the agent file appends to — the chain's last link, and the
> human's last read.
> **Title** — the literal `<prefix>: <line>` the implementer commits, ≤ 72 chars, imperative, no
> period. Prefix ∈ feat | fix | refactor | chore | docs | test.
> **Body** — one paragraph per part, in order: cause, goal, and the decision if the commit rejected a
> live alternative. Cause and goal come from the ledger row's `Why`; the decision from the notes this
> TODO obeys. Contract: the `commit-message` skill.
> Read it against the Outcome: the body claims a capability the Outcome does not, or the Outcome
> names one the body cannot account for → one of the two is wrong. Fix it before any increment lands.

---

**Increments:** [TODO-1.agent.md](TODO-1.agent.md) · **Trace:** [TODO-1.trace.md](TODO-1.trace.md)

> The two links out of this file, and the last line in it. The agent file carries `## Constraints`,
> `## Changes` (the increments, described — no diffs), `## Files`, `## Pre-reads`, `## Manual test`,
> and `## Definition of done` — the implementer's half. The trace file carries one row per decision
> behind this TODO and where that decision is written down; it is the auditor's read, and the place a
> reviewer goes to challenge a link in the chain above rather than approve it.
> A pair is incomplete without the agent file: a `TODO-N.md` with no `TODO-N.agent.md` cannot be
> implemented. A pair with no `TODO-N.trace.md` is implementable and unaccountable — every decision
> in it reads as arbitrary, and the impl-decision notes written while authoring it are unreachable.

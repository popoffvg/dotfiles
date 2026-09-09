---
status: todo                # todo → impl → verify → done (blocked: dep unmet / verify DEVIATES). Machine: ref-write.md § Status
type: new behavior          # the change kind — one of the nine in impl:ref-change-types.md, never a brick
depends_on: []              # [TODO-M, …] real edges only; each must reach status: done first
risk: 3                     # changes the existing Refresh signature; retest the auth middleware and every caller of Refresh, not just the new rotation path
approve: increment          # inherit | increment | todo | none — override the spec, with the reason: every caller of Refresh moves, so the human reads each step. ref-write.md § Approval
increment: 0/4              # <approved>/<total> — impl stamps it after each increment lands; `todo` writes `0/<total>`. ref-write.md § Progress
---

> Six keys, all metadata — the inline `#` comments above are part of the shape, keep them.
>
> **`status`** — the lifecycle phase. `todo` authors it at `todo`, or `blocked` when a `depends_on`
> TODO is not yet `done`. Never author straight to `impl` or `done`. Machine and who sets each
> transition: `arch:ref-write.md` § Status.
>
> **`type`** — the change kind, one of the nine in `impl:ref-change-types.md`. **Exactly one, and it
> is the TODO's main work**: two kinds with equal claim is a split signal. The consequences a kind
> drags along do not change it — a `new behavior` TODO still migrates its call sites. It never names
> a brick; the brick is the **Type** column of `## Components`.
>
> **`depends_on`** — `[]`, one entry, or several, each of which must reach `status: done` first. No
> forward references. Real edges only: a file this TODO cannot touch until M creates it, a symbol M
> introduces, a test that cannot pass before M lands. "Feels later" is not an edge — a false one
> serializes the spec, because this list computes the waves.
>
> **`risk`** — a 1–5 score for **reach**: the surface a regression forces you to retest, not effort.
> A one-line edit to a shared type is a 5; a large isolated new module is a 1.
>
> | Score | Reach | Retest |
> |-------|-------|--------|
> | 1 | local, additive — new path, no existing behavior touched | just the new path |
> | 2 | one component, isolated edit | that component |
> | 3 | modifies behavior others call | component + its callers |
> | 4 | shared/utility code, several consumers | every consumer |
> | 5 | core contracts many modules depend on | cross-module regression pass |
>
> Score ≥ 3 → Autotest/Manual test covers the callers, not just the new code. A high score signals
> keep-it-small, not blocked.
>
> **`approve`** — what the human approves during impl: `inherit | increment | todo | none`. Anything
> but `inherit` states its reason inline, as above. Full rules: `arch:ref-write.md` § Approval.
>
> **`increment`** — `<approved>/<total>`. `<total>` is the number of increments in the agent half's
> `## Changes`; `<approved>` is how many are already in the commit. `todo` writes `0/<total>`; `impl`
> raises it by one each time an increment lands, so an interrupted run resumes at `<approved> + 1`.
> `arch:ref-write.md` § Progress.

# TODO-1: Rotate refresh tokens on /auth/refresh

> `TODO-N: <imperative line>` — the same line the ledger row carries. `N` is contiguous and 1-indexed,
> one pair per ledger row (`arch:sub-todo.md` § File location).
>
> A filled `<notes-dir>/todos/TODO-N.md` — **the human half of the pair**. Copy the section order and
> the shape of each one; each `>` block states the rules for the piece above it. The procedure around
> the file — the fan-out, the budgets, the verification chain, the pre-save checklist — is
> `arch:sub-todo.md`, and the element list and order are its § Required elements.
> `## Deviations` is shown filled, as `impl` leaves it — a file written by `todo` has no such section.
> The prose follows `harness-dev:text-style`, and — because a human reads this file to decide whether
> to approve it — the `i-have-adhd` rules.

## Outcome

A `User` can issue `RotateToken` to exchange a valid refresh token for a new `TokenPair`. On success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid immediately. If the refresh token has already been used, the `Session` is revoked and the `User` must re-authenticate.

> **Capability, not implementation.** Answers *"what new can the system do once this lands?"* in
> use-case language.
>
> Phrasing: `<actor> can <capability> [when <condition>]`, or `<aggregate> emits <event> when
> <command> succeeds`. Present tense, active.
>
> Two to five sentences: the first is the capability, the rest give a reader without context the
> trigger, the state change, and the failure. Past five, the TODO is too big — split it. `GLOSSARY.md`
> names verbatim.
>
> **Banned:** file paths, function/struct names, routes, package names, libraries, "add a field",
> "wire up". Don't restate the spec Goal — scope to *this* TODO's slice.
>
> Good: *"A `User` can issue `RotateToken`; on success the `Session` emits `TokenRotated` and the
> prior refresh token becomes invalid."*
> Bad: *"Add a `/auth/refresh` handler in `pkg/auth/handler.go`"* (paths) · *"Introduce a
> `RefreshRequest` struct"* (types, not capability).
>
> A pure refactor with no new capability says so: *"No new capability; reshapes the `Session`
> aggregate so future `RotateToken` variants share a path."* Still in terms, not paths.

## New terms

| Term | Kind | Description |
|------|------|-------------|
| TokenJar | entity | Per-user container of active refresh tokens; bounded to 5, LRU-evicted |

> One row per domain term this TODO adds that `GLOSSARY.md` does not already carry.
>
> **Every row here is `new` by definition** — that is what the section is — and it reaches
> `GLOSSARY.md` with `Status: new`. A term the code already carries belongs in `GLOSSARY.md` as
> `existing` and never in this table.
>
> `Kind` comes from the `GLOSSARY.md` set. **Description** is one sentence carrying the visible
> contract: TTL, bounds, error semantics.
>
> **The row reaches `GLOSSARY.md` as an entry, but the pair's author does not merge it** — the row is returned and
> the caller merges it (`arch:sub-todo.md` § Execution, step 3), because one shared table written by a
> wave of forks loses rows.
>
> **Unlimited — no row cap, and the 550-line budget does not count it** (`arch:sub-todo.md` § Budget).
> Every term the TODO adds gets its row; a term left out to keep the section short is a term the
> implementer has to guess.
>
> A TODO that adds no term omits the whole section. Never write `## New terms` with `none` under it.

## Components

| Component | Touch | Type | Part | Role |
|-----------|-------|------|------|------|
| `pkg/auth.Handler` | modify | server | main | Exchanges a valid refresh token for a new pair and invalidates the old one |
| `pkg/auth.TokenMinter` | modify | command | supporting | Mints an access/refresh pair for a user id |

> The `package.Class` set this TODO touches, one row each, **main part first**. A human reads this
> create/modify/delete list *instead of* any diff: it is the whole reach of the change, stated for a
> reader who never opens the agent half.
>
> **Component** — `package.Class` in the project's own notation (`pkg/auth.Handler`,
> `blocks/upload/model.UploadState`). A symbol, never a bare file path — paths live in the agent
> half's **Files**.
>
> **Touch** — `create | modify | delete`. **It types the symbol, not the file**: a `create` component
> may land in a file **Files** marks `modify`, and a `modify` component may need a new file. A
> component this TODO only reads belongs in **Pre-reads**, not here. An all-`create` table is a
> greenfield slice; a `delete` row names its replacement row in the same table, or the TODO that
> already shipped it.
>
> **Type** — the **brick**: `command | service | flow | gateway | server | consumer | policy |
> scheduler | wiring`. The roster, with the metric and common structure of each, is
> `arch:ref-bricks.md`. A component that fits no brick, or fits two, owns more than one
> responsibility — split it before writing the body.
>
> **Part** — `main` or `supporting`, and **exactly one row is `main`**: the component carrying the
> Outcome's behavior. Two candidates means the TODO does two things.
>
> **Role** — one sentence, this TODO's slice of the component's job. Not the component's full purpose.
>
> Every row maps to at least one path in the agent half's **Files**, and every non-test path there
> belongs to a row — except a file changed only as a consequence of another row's decision. Every row
> is named by at least one increment in `## Changes`, and no increment there names a component missing
> from this table.
>
> **Unlimited — no row cap, and the 550-line budget does not count it** (`arch:sub-todo.md` § Budget).
> One row per symbol touched, however many that is: a reach stated short is a reach the human approves
> blind. A wide table is not a split signal — two `main` candidates and an over-budget `## Surface`
> are.

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

> **The one diff in the pair, and the whole contract change this TODO makes, written once.** One
> bullet naming a file, then one ```diff for that file, deepest-first — the same order the increments
> apply.
>
> **Surface** means what a caller of the changed code can see: types, fields, method and function
> signatures, and settings — config keys, flags, defaults — with their real values. New surface is
> all-`+` in real syntax, and no field or signature is ever elided.
>
> **Why the human half.** This is what a reviewer approves before any code exists: Components says
> *which* symbols move, Surface says *what they become*. Approving one without the other approves a
> rename. It is also why this half's budget is 550 lines rather than a hundred — the diff needs the
> room.
>
> **No comments, and no `AGENT:` markers.** A decision that seems to want a comment belongs in a
> `thoughts/` note and, restated, in the agent half's `## Constraints`. The implementer writes
> whatever comments `CODE_STYLE.md` asks for; a comment predicted here is one they would rewrite.
>
> **Sizing: ≤ 150 changed lines per file.** Over that, first look for a body — deleting one usually
> takes the file under on its own. If every line is real surface and the file still cannot compile
> below the budget, keep it and add a `**Compile floor:**` bullet under that diff saying why.
>
> **A file whose whole content is a body has no surface** — the `scripts/release-check.sh` block above
> is that case: a plain fenced contract (invocation, arguments, exit codes, output) instead of a
> ```diff. A check script, a migration, a test file, a generated query all take this shape, and the
> increment that builds one carries `Surface: none` plus a **Behavior** sketch.
>
> Two doctrines govern what a diff may hold, and they live in the reference because Autotest and
> `## Changes` cite them too:
>
> - **A diff carries the change, not what the change forces.** One entry per file whose contract this
>   TODO *decides*; a file that only moves to a contract decided elsewhere in the same section carries
>   no entry. Full test and the agent-half home of a skipped consequence:
>   `arch:ref-todo-sections.md` § A diff carries the change, not what the change forces.
> - **A diff carries the surface, not a body.** Show the signature; the logic goes in the increment's
>   **Behavior** sketch as pseudocode nobody can copy. The one exception is a human asking for a
>   specific body directly, and it is marked. Full rules: `arch:ref-todo-sections.md` § A diff carries
>   the surface, not a body.

## Autotest

### Unit

- **Target files:** `pkg/auth/handler_test.go` (create), `pkg/auth/token_test.go` (modify)
- **Cases:**
  - **Rotation mints exactly one new pair and retires the old token**
    - property: `refresh(t) -> (t', pair)` where `t' != t` and Redis key `auth:<t>` is gone
    - over: any unexpired refresh token; pinned: token at exactly its TTL boundary
  - **An expired token is rejected**
    - refresh token past its 15-minute TTL → 401
  - **A reused token is rejected without minting**
    - second refresh with the same token → 409, and no new pair exists
- **Command:** `go test ./pkg/auth/...`

### E2E

- **Target files:** `test/e2e/auth_refresh_test.go` (create)
- **Entry point:** `POST /auth/refresh` on the running server, same as a real SDK client
- **Cases:**
  - **A refreshed session keeps working**
    - login → refresh → the returned access token authorizes `GET /me` (200)
  - **Reuse punishes the stale token, never the live session**
    - login → refresh → refresh again with the *first* refresh token → 409, and the second pair still authorizes `GET /me`
  - **Expiry ends access on both tokens**
    - login → wait past TTL → refresh → 401 and `GET /me` with the old access token → 401
- **Command:** `go test -tags e2e ./test/e2e/ -run TestAuthRefresh`

> **Two levels, both required.** One TODO ships the behavior *and* the proof at both scales — that is
> what makes it self-contained. Neither level is optional by default. What the change *proves* is a
> design question the reviewer answers at the gate: a capability nobody can assert is a capability
> nobody agreed to.
>
> | Level | Proves | Scope |
> |-------|--------|-------|
> | `Unit` | the changed unit behaves, in isolation | the new/edited function, type, or component; no network, no DB, no process boundary |
> | `E2E` | the **Outcome** holds through the real entry point | the request/command enters where a user or caller enters it and the observable result is asserted |
>
> Each level carries, on its own bullets:
>
> - **Target files** — the test file path, `create` if new.
> - **Entry point** — `E2E` only: where the request or command enters, named as a caller enters it
>   (`POST /auth/refresh` on the running server), so each case asserts the Outcome as an observer sees
>   it rather than as the implementation sees it.
> - **Cases** — grouped under **bold behaviour claims**, never a flat list. A claim is one sentence
>   naming what the group proves; each claim traces to the Outcome or to a generated rule this TODO
>   can violate, both directions — an Outcome promise with no claim is a coverage gap, a claim the
>   Outcome never made is scope creep. Each group is backed one of two ways: **examples**, as
>   `input → expected` bullets under the claim; or **a property**, when the claim has algebraic shape
>   (round trip, inverse, idempotence, invariant — catalog in `test-suite:ref-property-based.md`),
>   written as `property: <formula>` then `over: <input domain>; pinned: <known edges>`. The pinned
>   edges are that group's examples; no separate example bullets beside a property.
> - **Command** — one runnable shell command. Never "run the relevant tests".
>
> **Cases, never the test.** This is the only place a test appears in the pair, and it appears as
> sentences: no assertion source, no fixture, no table of literal expected values, no shell. A test
> that *cannot* be written from the case means the case is too vague, and the fix is a sharper
> sentence, not a paste. When the test file itself is the deliverable, it is an increment with a
> **Behavior** sketch in the agent half.
>
> A level that genuinely cannot exist is written `none — <one-line concrete reason>`, and the reason
> names what makes it impossible. Auto-reject: "covered by the unit test", "trivial", "no e2e harness"
> (name the missing harness and add a TODO for it instead). A pure refactor may set `E2E: none — no
> observable behavior changes; unit suite pins the reshaped API`, but only when the Outcome itself
> claims no new capability.
>
> A TODO whose Outcome is not observable end-to-end alone defers: `none — observable only via TODO-3;
> its E2E case asserts this path`. Three rules bind that deferral:
>
> - **The named TODO must exist in the ledger**, and its `## Autotest` `E2E` must carry a case that
>   asserts this path. A deferral to a TODO whose E2E never mentions it is an untested path with a
>   citation.
> - **Deferring to a Manual test does not count.** `Manual test` catches what no suite can see; it is
>   not the automated cover this level claims.
> - **The shape is rare.** An enabler with one consumer is increment 1 of that consumer, so it has no
>   `E2E` of its own to defer. What is left is the genuinely separate row: another repo, or an
>   interface with two or more consumers.

## Commit

**Title:** `feat: rotate refresh tokens on /auth/refresh`

**Body:**

Refresh tokens stayed valid after use, so one leaked token granted access for as long as the user
kept refreshing.

Each refresh now returns a new pair and revokes the token it replaces, so a stolen token dies at the
next legitimate refresh.

A short expiry on the refresh token was the other option. It was rejected because it signs out an
idle user on a normal day, and the stolen token stays usable until it expires.

> **The message of the one commit `## Changes` builds, written here in full and copied — never
> re-derived at commit time.** Two fields, both human-read.
>
> **Title** — the exact line the implementer commits: `<prefix>: <line>`, ≤ 72 chars, imperative, no
> period, prefix from the standard set. The ledger entry's `Commit` is this line.
>
> **Body** — cause, goal, and the decision if a live alternative was rejected, one paragraph each in
> that order. Cause and goal expand the ledger entry's `Why`; the decision comes from the notes
> `## Constraints` cites. Full contract: `wm:commit-message`.
>
> **Write the body for a reader who has only the repo.** No `TODO-N`, no note id, no ticket — the
> increments are gone once the commit lands, and this text is all that stays. A body only someone
> holding the TODO could have written is the wrong body.
>
> **Check it against the Outcome before any increment lands.** Same change, stated twice for two
> audiences: the Outcome in the actor's terms, the title in the repo's. A capability in one and not
> the other means the TODO is wrong — fix it at `todo`, not at commit time.

## Deviations

| What | Shipped instead | Why | Note |
|------|-----------------|-----|------|
| `## Surface`: `Refresh` | takes `ctx context.Context` as its first argument | the store call it now makes must be cancellable | [[012-impl-decision-refresh-takes-ctx]] |

> **Not yours to write.** `todo` never creates this section; the pair leaves the gate with the
> sections above and nothing after them. `impl` appends it when the user corrects a shown diff into
> something a section above forbids, and only when the correction stays inside this TODO.
>
> Read it as a reader of the pair: the approved text above still says what the human approved, and
> this table says where the shipped code went elsewhere and which note holds the reason. One row per
> correction, four columns:
>
> - **What** — the section and the symbol, id, or case the correction contradicts: `## Surface:
>   Refresh`, `## Autotest Unit: case 3`, `## Outcome`.
> - **Shipped instead** — the shape or behavior that actually landed, one line.
> - **Why** — the reason the approved version lost, one line.
> - **Note** — the `[[NNN-impl-decision-slug]]` holding the full reasoning.
>
> `revise` folds every row into the section it names and deletes the whole block. A correction that
> reaches past this TODO — another TODO's symbol, a ledger row, a settled `decision` note — is not a
> deviation: it routes to `revise`.

---

**Increments:** [TODO-1.agent.md](TODO-1.agent.md)

> The pair is two files, and each half links the other by name.

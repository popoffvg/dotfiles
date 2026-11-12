---
status: todo                # todo → impl → verify → done (blocked: dep unmet / verify DEVIATES). Machine: ref-write.md § Status
type: new behavior          # the change kind — one of the nine in impl:ref-change-types.md, never a brick
depends_on: []              # [TODO-M, …] real edges only; each must reach status: done first
risk: red                   # reach: changes the Refresh signature, every caller retests; flow: breaks main user flow step `POST /auth/refresh`; recovery: none, a user who fails refresh is logged out
size: M                     # 5 files, 6 increments — the PR this TODO becomes
approve: increment          # inherit | increment | todo | none — override the spec, with the reason: every caller of Refresh moves, so the human reads each step. ref-write.md § Approval
where: inherit              # inherit | in-place | worktree — the checkout impl writes into; override the spec with the reason. ref-write.md § Where the work happens
increment: 0/6              # <approved>/<total> — impl stamps it after each increment lands; `todo` writes `0/<total>`. ref-write.md § Progress
---

> Eight keys, all metadata — the inline `#` comments above are part of the shape, keep them.
>
> `status`, `type`, `approve`, `where`, and `increment` rules: `arch:ref-write.md` § Status,
> § Approval, § Where the work happens, and § Progress; change-kind rules:
> `impl:ref-change-types.md`.
>
> **`depends_on`** — `[]`, one entry, or several, each of which must reach `status: done` first. No
> forward references. Real edges only: a file this TODO cannot touch until M creates it, a symbol M
> introduces, a test that cannot pass before M lands. "Feels later" is not an edge — a false one
> serializes the spec, because this list computes the waves.
>
> **`risk`** — `red`, `yellow`, or `green`: the **worst** answer to three questions. No default:
> choose one, and the comment gives the answer to each question, naming the consumers reach retests.
>
> | Question | red | yellow | green |
> |----------|-----|--------|-------|
> | **reach** — what a regression forces you to retest | changes a shape or behavior that 30% or more of the codebase's modules read | changes a shape or behavior that fewer modules read; they retest | the new path only; an added field other modules ignore is here too |
> | **flow** — the main user flow | breaks a step of it | breaks a step in some cases | leaves it working |
> | **recovery** — the user's way around a broken feature | none | a slow one | a backdoor, or the user can wait days or weeks |
>
> **flow** cites a step of the main user flow — the `main` flow in `<notes-dir>/workflows/flows.json`
> (`dive:sub-workflow.md` § Rules — `flows.json`). A **flow** or **recovery** answer the spec does
> not state carries its color and `assumed` — `recovery: green, assumed`. An `assumed` green counts as yellow until the human confirms it.
>
> What each color changes in `impl`:
>
> | Color | Approval | Autotest + Manual test cover | First pass |
> |-------|----------|------------------------------|------------|
> | red | `increment`, whatever `approve` says (`ref-write.md` § Approval) | every consumer, and the main user flow end to end | opus `@implementer` |
> | yellow | as `approve` says | the component and its callers | sonnet `@implementer` |
> | green | as `approve` says | the new path | sonnet `@implementer` |
>
> A red TODO is a signal to keep it small, not a block.
>
> **`size`** — `S`, `M`, or `L`: how big the PR is that a reviewer opens when this TODO lands. Work
> and reading time, not reach — a one-line edit to a core type is `risk: red, size: S`.
>
> Read it off two counts, and take the band that holds **both** — the paths in the agent half's `## Files` and the increments in `## Increments`:
>
> | Size | `## Files` paths | Increments |
> |------|------------------|------------|
> | S | ≤ 3 | ≤ 3 |
> | M | ≤ 8 | ≤ 6 |
> | L | more | more |
>
> Write both numbers as the trailing comment, so the reader sees what produced the letter. The
> counts are in the pair, so `spec-lint` B14 recomputes the letter — a hand-picked `S` over nine
> files fails.
>
> **`L` needs the human's word before the pair is written.** Nine files is past the ask-first line of
> `arch:sub-todo.md` § Operating principles, and the honest fix is usually two ledger rows. When the human keeps it as one row,
> the comment carries their reason instead of the counts.
>
# TODO-1: A stolen refresh token stops working at the next refresh

> `TODO-N: <what it brings>` — the same line the ledger row carries, ≤ 60 chars. `N` is contiguous
> and 1-indexed, one pair per ledger row (`arch:sub-todo.md` § File location).
>
> A filled `<notes-dir>/todos/TODO-N.md` — **the human half of the pair**. The body is a change
> review: **load the `change-review` skill first.** It owns the title rule, the rules every section
> shares, the `> **Check:**` line of each H2, and the rules inside each section. Each `>` block here
> states only what the wm flow adds to that section; the copy deletes every `>` line except the
> `> **Check:**` lines. The procedure around the file — the fan-out, the budgets, the verification
> chain, the pre-save checklist — is `arch:sub-todo.md`, and the element list and order are its
> § Required elements. `## Deviations` is shown filled, as `impl` leaves it — a file written by
> `todo` has no such section.
>
> **What the wm flow adds to the shared rules:**
>
> - **A file path belongs in the agent half's `## Files`**, keyed by increment.
> - **The 200-line budget does not count a table** (`arch:sub-todo.md` § Budget).
> - **A split is a split of the ledger row.**
> - **A domain term is a `GLOSSARY.md` term**, written verbatim.

## Outcome

> **Check:** each bullet is a thing a user or a caller can do once this change lands. Find the capability you expect and do not see, and the one you did not ask for.

- A `User` can issue `RotateToken` to exchange a valid refresh token for a new `TokenPair` — a public method on `pkg/auth.Handler`.
- On success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid immediately — a state machine on `Session`: active → rotated → revoked.
- If the refresh token has already been used, the `Session` is revoked and the `User` must re-authenticate — reuse is the trap state.
- The refresh TTL is a setting, 15 minutes by default — a config key.

> Rules: `change-review` § Outcome. Scope the bullets to *this* TODO's slice; do not restate the
> spec Goal.

## New terms

> **Check:** read each **Description** once. Say if you would use another word for this thing, or if the word already means something else in the code.

| Term | Kind | Description | Forbidden |
|------|------|-------------|-----------|
| TokenJar | entity | Per-user container of active refresh tokens; bounded to 5, LRU-evicted | token bag, `TokenSet` |

> Rules: `change-review` § New terms. The project glossary is `GLOSSARY.md`, and `Kind` comes from
> its set.
>
> **Every row here is `new`**, and it reaches `GLOSSARY.md` with `Status: new`. A term the code
> already carries belongs in `GLOSSARY.md` as `existing` and never in this table.
>
> **The pair's author does not merge the row into `GLOSSARY.md`** — the row is returned and the
> caller merges it (`arch:sub-todo.md` § Execution, step 3), because one shared table written by a
> wave of forks loses rows. The merge lands before the human approves stage 1, so the human reads
> the glossary entry and the TODO together.

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

> Rules: `change-review` § Components. The brick roster, with the metric and common structure of
> each brick, is `arch:ref-bricks.md`. What the wm flow adds:
>
> - **The mark types the symbol, not the file**: a `+` component may land in a file **Files** marks
>   `modify`, and a `~` component may need a new file. A component this TODO only reads belongs in
>   the agent half's **Pre-reads**. A `-` component names its replacement in the same tree, or the
>   TODO that already shipped it.
> - **Every component maps to at least one path in the agent half's `## Files`**, and every non-test
>   path there belongs to a component — except a file changed only as a consequence of another
>   component's decision. Every component is named by at least one increment, and no increment
>   names a component missing from the tree.
> - **A caller names its TODO**: `called by <package.Symbol> (TODO-N)`. A caller in this spec is
>   code outside the package that a TODO writes. A planned caller is a step of a design or a later
>   phase that the spec links: `called by <the step> (planned, <link>)`.
> - **A wide tree is not a split signal** — two `main` candidates and more than ten increments are.

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

> Rules: `change-review` § Flow changes. The main user flow is the `main` flow in
> `<notes-dir>/workflows/flows.json` (`dive:sub-workflow.md` § Rules — `flows.json`). Every marked
> line has a case in `TODO-N.test.md` `## Autotest`.

## Increments

> **Check:** for each increment, read the summary, then **Surprises**. Agree or disagree with each surprise: these are the details you would otherwise find only in the code. Confirm that each diff stays in the one component under its heading. At each `### Commit` section, confirm that its title states one change.

> Rules: `change-review` § Increments. What the wm flow adds:
>
> - **Landed** — `yes` or `no`, the first bullet: whether this increment is in its commit. `todo`
>   writes `no`; `impl` flips it after the commit or amend (`arch:ref-write.md` § Progress).
> - **Change** is one of the nine kinds in `impl:ref-change-types.md`. A `type: new behavior` TODO
>   usually holds one `new behavior` increment and several `signature change`, `wiring`, or
>   `call-site migration` increments around it. A TODO whose every increment is `wiring`
>   contradicts its own `type:`.
> - **Extends** — an increment that meets a need in `PATTERNS.md` § Need → use extends that row's
>   **Use**.
> - **A public symbol missing from every Surface diff has no increment to land in**
>   (`impl:sub-impl.md` step 5); a private helper may land with a body.
> - **At each commit border, `impl` checks** that the repo builds, the existing tests pass, and the
>   Autotest cases of the **Proves** line pass, before the next increment starts.
> - **A body needs the human's word.** The two diff doctrines and the `**Body requested:**` marker
>   are `arch:ref-todo-sections.md` § A diff carries the change, not what the change forces and
>   § A diff carries the surface, not a body.
> - **Compile floor.** A diff over 150 lines that cannot shrink — no body to delete, every line real
>   surface — adds a `**Compile floor:**` bullet under the diff saying why.
> - **Past the sizes, split the ledger row.**

### 1.1. Add the request and pair types

*`pkg/auth.Handler`*

The handler gains a request type that carries one refresh token, and a pair type that carries a new access token and a new refresh token. Nothing reads them yet.

- **Landed:** no
- **Change:** signature change
- **Extends:** new — checked `pkg/auth.LoginRequest` and `pkg/auth.Session`: neither carries a refresh token, and both are read by callers this TODO does not change
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

- **Landed:** no
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

- **Landed:** no
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

> Rules: `change-review` § Commit. What the wm flow adds:
>
> - **The ledger entry's `Commit`** is the title of the commit that holds the `main` component's
>   `new behavior` increment.
> - **The Body names no `TODO-N`, increment number, ADR number, or ticket.**
> - **Proves** names cases of `TODO-N.test.md` `## Autotest`. Every Autotest case is named by
>   exactly one commit. Fix a mismatch between the commit titles and the Outcome at `todo`, not at
>   commit time.

### 2.1. Exchange the token in the handler

*`pkg/auth.Handler`*

Before, `Refresh` checked a refresh token and returned a new access token, and the old refresh token stayed valid. Now it takes a `RefreshRequest`, returns a new `TokenPair`, and deletes the old refresh token, so each token works once.

- **Landed:** no
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

- **Landed:** no
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

Refresh tokens stayed valid after use, so one leaked token granted access for as long as the user
kept refreshing.

Each refresh now returns a new pair and revokes the token it replaces, so a stolen token dies at the
next legitimate refresh.

A short expiry on the refresh token was the other option. It was rejected because it signs out an
idle user on a normal day, and the stolen token stays usable until it expires.

**Proves:** Unit — `a rotation mints one new pair`, `the pair carries the same user`, `an expired token`, `a reused token`, `an unknown token`; E2E — `the returned pair authorizes the next call`, `a replayed token fails and the live pair still works`, `expiry ends access on both tokens`

### 3.1. Add the release check

*`scripts.ReleaseCheck`*

A new script builds the release from clean, checks each asset against the manifest, and builds a second time to prove the cache works. It stops at the first failure and prints what failed.

- **Landed:** no
- **Change:** new behavior
- **Extends:** new — checked `scripts/` and the CI jobs: no step checks a release before it ships
- **Surprises:**
  - It refuses to run when `CI` is set, because the build step publishes from CI.
  - The second build must not touch the network; a refetch fails the check even when every asset is correct.
  - A variant with no licence notes fails, even when its assets match the manifest.
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

**Proves:** none — the script has no Autotest case; the agent half's `## Manual test` runs it against a real build.

## Deviations

> **Check:** each row is a place where the shipped code differs from the text you approved. Agree with each **Why**, or ask for the approved shape.

| What | Shipped instead | Why |
|------|-----------------|-----|
| `## Increments` 2.1: `Refresh` | takes `ctx context.Context` as its first argument | the store call it now makes must be cancellable |

> Rules: `change-review` § Deviations. **Not yours to write.** `todo` never creates this section;
> the pair leaves the gate with the sections above and nothing after them. `impl` appends it, with
> its `> **Check:**` line, when the user corrects a shown diff into something a section above
> forbids, and only when the correction stays inside this TODO (`impl:sub-impl.md`, the step that records a
> deviation).
>
> A deviation is tactical, so it is never an ADR (`arch:sub-todo.md` § Implementation decisions).
> The fixup commit message carries the same **Why**, so it survives when `revise` folds the row in
> and deletes the table. A correction that reaches past this TODO — another TODO's symbol, a ledger
> row, a settled `architecture` or `feature` ADR — is not a deviation: it routes to `revise`.

---

**Tests:** [TODO-1.test.md](TODO-1.test.md)

**Agent:** [TODO-1.agent.md](TODO-1.agent.md)

> One row is three files. This half links the other two by name, on the last two lines; each of them
> links back on its first line.

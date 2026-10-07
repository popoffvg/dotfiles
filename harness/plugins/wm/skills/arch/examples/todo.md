---
status: todo                # todo → impl → verify → done (blocked: dep unmet / verify DEVIATES). Machine: ref-write.md § Status
type: new behavior          # the change kind — one of the nine in impl:ref-change-types.md, never a brick
depends_on: []              # [TODO-M, …] real edges only; each must reach status: done first
risk: red                   # reach: changes the Refresh signature, every caller retests; flow: breaks main user flow step `POST /auth/refresh`; recovery: none, a user who fails refresh is logged out
approve: increment          # inherit | increment | todo | none — override the spec, with the reason: every caller of Refresh moves, so the human reads each step. ref-write.md § Approval
where: inherit              # inherit | in-place | worktree — the checkout impl writes into; override the spec with the reason. ref-write.md § Where the work happens
increment: 0/4              # <approved>/<total> — impl stamps it after each increment lands; `todo` writes `0/<total>`. ref-write.md § Progress
---

> Seven keys, all metadata — the inline `#` comments above are part of the shape, keep them.
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
>
> **Rules every section shares.** A section's own `>` block states only what is specific to it.
>
> - **Symbols, not paths.** Name a symbol as `## Components` does (`pkg/auth.Handler`) and write a
>   `GLOSSARY.md` term verbatim. A file path belongs in the agent half's **Files**, never in this half.
> - **A required section with nothing to say writes one line: `none — <concrete reason>`.** A section
>   marked *optional* is omitted instead, never written with `none` under it.
> - **Tables are unlimited.** No row cap, and the 550-line budget does not count a table
>   (`arch:sub-todo.md` § Budget). A row left out to keep a section short is a fact the implementer guesses.
> - **A size cap is a split signal.** Past the cap the ledger row does two things — split the row, do
>   not shorten the section.
> - **Each section stands on its own** for a reader with the repo closed and the agent half shut.

## Outcome

- A `User` can issue `RotateToken` to exchange a valid refresh token for a new `TokenPair` — a public method on `pkg/auth.Handler`.
- On success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid immediately — a state machine on `Session`: active → rotated → revoked.
- If the refresh token has already been used, the `Session` is revoked and the `User` must re-authenticate — reuse is the trap state.
- The refresh TTL is a setting, 15 minutes by default — a config key.

> **One feature per bullet, capability first.** Answers *"what new can the system do once this
> lands, and what lands to do it?"* The reviewer reads this list, then knows what `## Components`
> and `## Increments` below will show before scrolling to them.
>
> Each bullet is `<actor> can <capability> [when <condition>]` or `<aggregate> emits <event> when
> <command> succeeds`, present tense, active — then an em dash and what lands: `<plain-words kind>
> on <symbol>`. The kind is free text, not a roster: a public method, a state machine, an event, an
> endpoint, a config key, a migration, a script. Name a symbol as `## Components` does; a bullet
> with no new thing behind it ends at the capability.
>
> **Two to seven bullets, one sentence each, biggest first.** The first is the capability; the
> rest give the trigger, the state change, and the failure. Don't restate the spec Goal — scope to
> *this* TODO's slice.
>
> **Banned:** paths, routes, libraries, "add a field", "wire up".
>
> Good: *"A `User` can issue `RotateToken`; on success the `Session` emits `TokenRotated` — a public
> method on `pkg/auth.Handler`."*
> Bad: *"Add a `/auth/refresh` handler in `pkg/auth/handler.go`"* (path, no capability) ·
> *"Introduce a `RefreshRequest` struct"* (type, not capability).
>
> A pure refactor with no new capability says so in one bullet: *"No new capability; reshapes the
> `Session` aggregate so future `RotateToken` variants share a path."*

## New terms

| Term | Kind | Description | Forbidden |
|------|------|-------------|-----------|
| TokenJar | entity | Per-user container of active refresh tokens; bounded to 5, LRU-evicted | token bag, `TokenSet` |

> **Optional** — one row per domain term this TODO adds that `GLOSSARY.md` does not already carry.
>
> **Every row here is `new` by definition** — that is what the section is — and it reaches
> `GLOSSARY.md` with `Status: new`. A term the code already carries belongs in `GLOSSARY.md` as
> `existing` and never in this table.
>
> `Kind` comes from the `GLOSSARY.md` set. **Description** is one sentence carrying the visible
> contract: TTL, bounds, error semantics. **Forbidden** lists the other names the author met for
> the concept, or `none`. Before adding a row, check that no entry already defines the concept —
> a second name for an existing concept is a rename, not a new term.
>
> **The row reaches `GLOSSARY.md` as an entry, but the pair's author does not merge it** — the row is returned and
> the caller merges it (`arch:sub-todo.md` § Execution, step 3), because one shared table written by a
> wave of forks loses rows. The merge lands before the human approves stage 1, so the human reads
> the glossary entry and the TODO together.

## Components

| Component | Touch | Type | Part | Role | Change |
|-----------|-------|------|------|------|--------|
| `pkg/auth.Handler` | modify | server | main | Exchanges a valid refresh token for a new pair | Takes a `RefreshRequest`, returns a `TokenPair`, and invalidates the old refresh token. |
| `pkg/auth.TokenMinter` | modify | command | supporting | Mints an access/refresh pair for a user id | Returns a `TokenPair` instead of one token string. |

> The `package.Class` set this TODO touches, one row each, **main part first**. A human reads this
> create/modify/delete list *instead of* any diff: it is the whole reach of the change, stated for a
> reader who never opens the agent half.
>
> **Component** — `package.Class` in the project's own notation (`pkg/auth.Handler`,
> `blocks/upload/model.UploadState`).
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
> **Change** — one sentence, what this TODO changes in the component. A `create` row says what the new
> symbol adds; a `delete` row says what replaces it.
>
> Every row maps to at least one path in the agent half's **Files**, and every non-test path there
> belongs to a row — except a file changed only as a consequence of another row's decision. Every row
> is named by at least one increment in `## Increments`, and no increment there names a component
> missing from this table.
>
> **A wide table is not a split signal** — two `main` candidates and more than ten increments are.

## Increments

> **The whole contract change, cut into the steps `impl` applies, one H3 per step in apply order.**
> An increment is the smallest step worth approving on its own. `## Components` says *which* symbols
> move; each increment says *what they become* and *how the step gets there*.
>
> **Each increment is self-contained for review.** A reviewer reads one H3 and nothing else, and
> can approve or reject it: what changes, what it is for, what it can break, and the exact new shape.
> So **Do** never points elsewhere ("as above", "see increment 1", "as § Surface declares"), and the
> diff holds every symbol the **Do** names as new or changed. An increment that needs another one to
> make sense is one increment, or is in the wrong order.
>
> **No file paths.** Name a symbol as `## Components` does. Which file each increment touches is in
> the agent half's **Files**, keyed by increment number.
>
> Heading: ``### <n>. <imperative title> — `<package.Class>` ``, `n` 1-indexed and contiguous. It
> names exactly one `## Components` row; a component may span several increments. Every row is named
> by at least one increment, and no increment names a component missing from that table.
>
> Bullets, in this order:
>
> | Bullet | Required | Content |
> |--------|----------|---------|
> | **Landed** | always | `yes` or `no` — whether this increment is in the commit. `todo` writes `no`; `impl` flips it after the amend (`arch:ref-write.md` § Progress) |
> | **Change** | always | this increment's change kind — one of the nine in `impl:ref-change-types.md` |
> | **Extends** | always | the existing symbol this increment grows, and what it gains: `` `pkg.Type.Method` — <what it gains> ``. Or `` new — checked `<A>`, `<B>`: <why none fits> `` |
> | **Do** | always | one to four imperative sentences: what to write, what to migrate, what to delete. No code, no pasted signature |
> | **Blast radius** | always | the symbols, callers, and consumers a mistake here forces you to retest. Name them; `"low"` is not a blast radius |
> | **Behavior** | only where **Do** cannot carry the logic — a real branch structure, an error path that matters, a non-obvious ordering | TS pseudocode per the `flow-sketch` skill, ≤ 40 lines, side effects and error paths visible |
> | **Builds** | only when the increment leaves the repo not compiling | `builds: only with increment <n>` |
> | **Surface** | always | the diff this increment lands, as one ```diff block — or a plain contract block, or `none — <reason>` |
>
> **Change is the increment's own kind, not the TODO's.** A `type: new behavior` TODO usually holds
> one `new behavior` increment and several `signature change`, `wiring`, or `call-site migration`
> increments around it. The spread tells the human which increment to read line by line. A TODO
> whose every increment is `wiring` contradicts its own `type:`.
>
> **Extends makes a new symbol cost a search.** The default is to grow what exists: a new transition
> on the state machine the repo has, a new method on the gateway that already calls that system, a
> new row in the table that already lists its siblings. An increment that meets a need in
> `PATTERNS.md` § Need → use extends that row's **Use**. `new` is legal only with the symbols you
> checked and the fact that rules each one out — "a second state machine for destroy" fails when
> the installation machine can take a `destroying` state.
>
> **Every new symbol is in a Surface diff.** `impl` lands the all-`+` lines of every **Surface** first,
> as a skeleton with stub bodies, and later increments add no type, function, or method
> (`impl:sub-impl.md` step 5). A symbol missing here has no increment to land in.
>
> **Order — deepest first**, so the repo builds after each: the callee before its caller, the type
> before its user, the wiring last. `builds: only with increment <n>` is a last resort.
>
> **Sizing: ≤ 10 increments, ≤ 150 changed lines per diff.** More increments and the TODO is too big
> — split the ledger row. Over 150 lines, first look for a body; deleting one usually takes the diff
> under. If every line is real surface and it still cannot compile below that, add a
> `**Compile floor:**` bullet under the diff saying why.

### 1. Add the request and pair types — `pkg/auth.Handler`

- **Landed:** no
- **Change:** signature change
- **Extends:** new — checked `pkg/auth.LoginRequest` and `pkg/auth.Session`: neither carries a refresh token, and both are read by callers this TODO does not change
- **Do:** Add the request type and the pair type. Nothing reads them yet; increments 2 and 3 return them.
- **Blast radius:** none — additive types that no caller reads yet
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

> The shape every increment follows. **Surface** means what a caller of the changed code can see:
> types, fields, method and function signatures, and settings — config keys, flags, defaults — with
> their real values. New surface is all-`+` in real syntax, and no field or signature is elided.

### 2. Return a pair from the minter — `pkg/auth.TokenMinter`

- **Landed:** no
- **Change:** signature change
- **Extends:** `pkg/auth.mintTokens` — returns the refresh token beside the access token
- **Do:** Make `mintTokens` mint the refresh token beside the access token and return both. Propagate either signing error unchanged. Migrate both callers to the new return.
- **Blast radius:** every caller of `mintTokens` — `pkg/auth.Handler.Refresh`, `pkg/auth.Handler.Login`
- **Surface:**

```diff
-func mintTokens(userID string) (string, error)
+func mintTokens(userID string) (TokenPair, error)
```

> **Do** names the migration. A signature change whose callers no increment's **Do** names is a
> caller left broken. The callers carry no diff of their own: their new shape is fixed by this one
> (`arch:ref-todo-sections.md` § A diff carries the change, not what the change forces).

### 3. Exchange the token in the handler — `pkg/auth.Handler`

- **Landed:** no
- **Change:** new behavior
- **Extends:** `pkg/auth.Handler.Refresh` — exchanges the token instead of only checking it
- **Do:** Make `Refresh` take a `RefreshRequest` and return a `TokenPair`. Look the session up by the presented refresh token, mint a new pair, delete the old token, store the new one. Migrate the auth middleware and the API route table to the new call.
- **Blast radius:** every caller of `Refresh` — `pkg/auth.Middleware`, `cmd/api.Routes`; a wrong store key here logs out every session
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

- **Surface:**

```diff
-func Refresh(ctx context.Context, token string) (string, error)
+func Refresh(ctx context.Context, req RefreshRequest) (TokenPair, error)
```

> This increment carries the Outcome's logic, so **Do** is not enough: the two failure codes and the
> delete-before-store order are decisions a reader cannot infer from prose. The sketch is pseudocode —
> `lookupSession`, not `redis.get`; no real import, key format, or path.
>
> **An interface implementation shows the interface, not its methods.** A type that implements an
> interface carries one assertion line per interface (`var _ lifecycle.SettingsStore = (*InstallationsDirectory)(nil)`)
> and lists only the public methods no interface declares, plus its constructor. A method the
> interface declares is new surface only when the TODO changes that interface.
>
> **No comments and no `AGENT:` markers in a diff.** A decision that seems to want a comment belongs
> in a `thoughts/` note.

### 4. Add the release check — `scripts.ReleaseCheck`

- **Landed:** no
- **Change:** new behavior
- **Extends:** new — checked `scripts/` and the CI jobs: no step checks a release before it ships
- **Do:** Write the release check in the order the sketch gives. Stop at the first failure with a `FAIL: ` message that names what failed.
- **Blast radius:** the release job only — nothing imports it; a false pass ships an unbuilt asset
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

  const second = rebuild()                          // the cache edge: must not touch the network
  if (second.refetched) return fail("a second build refetched from the network")

  return 0
}
```

- **Surface:** no diff — a script is a body. Contract:

```
release-check          # no args, no flags
exit 0  → every check passed, one summary line on stdout
exit 1  → first failed check on stderr, prefixed `FAIL: `
```

> **The shape to copy when the deliverable is a whole body** — a script, a test file, a migration, a
> query. Its **Surface** is a plain fenced contract (invocation, arguments, exit codes, output)
> instead of a diff, and the sketch carries the checks in order and, above all, the edge cases: the
> env var that must be unset, the second run that must not refetch. The real commands and paths are
> implementation the implementer writes at the keyboard.
>
> The doctrines limiting a diff's contents — its decided change, not consequences; its surface, not
> a body — are `arch:ref-todo-sections.md` § A diff carries the change, not what the change forces
> and § A diff carries the surface, not a body.

## Flow changes

### `POST /auth/refresh` — `pkg/auth.Handler.Refresh` — main flow step 4

```
pkg/auth.Handler.Refresh
├── decode the body into a RefreshRequest
│   └── malformed → 400
├── look up the refresh token in the store
│   └── missing or expired → 401
├── + check the token was already used
│   └── revoke the Session → 409
├── ~ step mint a TokenPair for the user id — was: one access token
│   ├── sign the access token
│   └── + step sign the refresh token
├── + step delete the old refresh token from the store
├── + step emit TokenRotated
└── return the pair → 200
```

> **Which running paths this TODO changes, and how, step by step.** The increments show what the
> symbols become. This section shows what a call does, in order, and which steps are new. A reviewer
> reads it to see every new step and every new check before any code exists.
>
> **One H3 per flow.** A flow is one path a call takes from its entry point to its result: a request
> handler, a CLI command, a job, an event consumer. Name the entry point the way a caller enters it,
> then the `package.Class.method` that runs it. When the flow is a step of the `main` flow in
> `<notes-dir>/workflows/flows.json`, add `— main flow step <n>`.
>
> **Steps as a tree, in the order they run.** One fenced block per flow. The root is the
> `package.Class.method`; each step is one line, drawn as the Linux `tree` command draws it: `├── ` for a
> step, `└── ` for the last step at its level, `│   ` in front of each line one level deeper. A step that
> runs sub-steps or stops the flow holds them as its children. One line per step, in domain words:
> what happens, and what the caller gets when the step stops the flow (`→ 401`). No code; a symbol
> only when it is a `## Components` row.
>
> **Each changed step opens with its marker**, right after the branch characters. A step with no marker is unchanged context.
>
> | Marker | Means | The line also says |
> |--------|-------|--------------------|
> | `+ step` | a new step | what it does |
> | `+ check` | a new guard that can stop the flow | what it rejects and what the caller gets |
> | `+ branch` | a new path the flow can take | the condition that takes it |
> | `~ step` | a step that now does something else | what it did before, after `— was:` |
> | `- step` | a step that is gone | nothing more; the line stays so the gap shows |
> | `moved` | a step that runs at a new position | the parent and the step it ran after before, after `— was:` |
>
> **Show the whole tree up to 12 lines.** Past 12, keep each changed step, its parent chain, and one
> unchanged sibling on each side, and write `…` for the lines between.
>
> **Every marked step has a case in `TODO-N.test.md` `## Autotest`.** A `+ check` or a `+ branch`
> with no error case is a path nobody tests.
>
> A new flow is all `+ step`. The usual `none` is a rename: `none — renames Session fields; every
> step runs as before`.

## Commit

**Title:** `feat: rotate refresh tokens on /auth/refresh`

**Body:**

Refresh tokens stayed valid after use, so one leaked token granted access for as long as the user
kept refreshing.

Each refresh now returns a new pair and revokes the token it replaces, so a stolen token dies at the
next legitimate refresh.

A short expiry on the refresh token was the other option. It was rejected because it signs out an
idle user on a normal day, and the stolen token stays usable until it expires.

> **The message of the one commit the increments build, written here in full and copied — never
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
| `## Increments` 3: `Refresh` | takes `ctx context.Context` as its first argument | the store call it now makes must be cancellable | [[012-impl-decision-refresh-takes-ctx]] |

> **Not yours to write.** `todo` never creates this section; the pair leaves the gate with the
> sections above and nothing after them. `impl` appends it when the user corrects a shown diff into
> something a section above forbids, and only when the correction stays inside this TODO.
>
> Read it as a reader of the pair: the approved text above still says what the human approved, and
> this table says where the shipped code went elsewhere and which note holds the reason. One row per
> correction, four columns:
>
> - **What** — the section and the symbol, id, or case the correction contradicts: `## Increments 3:
>   Refresh`, `## Autotest Unit: case 3`, `## Outcome`.
> - **Shipped instead** — the shape or behavior that actually landed, one line.
> - **Why** — the reason the approved version lost, one line.
> - **Note** — the `[[NNN-impl-decision-slug]]` holding the full reasoning. **Required on every
>   row, and written before the row is.** This block is temporary: `revise` folds the rows in and
>   deletes it, so the note is the only thing that survives. A row with an empty Note column takes
>   the reason with it, and the approved text it replaced then reads as if nobody chose against it.
>   `spec-lint.py` check B4 fails a row without one.
>
> `revise` folds every row into the section it names and deletes the whole block. A correction that
> reaches past this TODO — another TODO's symbol, a ledger row, a settled `decision` note — is not a
> deviation: it routes to `revise`.

---

**Tests:** [TODO-1.test.md](TODO-1.test.md)

**Agent:** [TODO-1.agent.md](TODO-1.agent.md)

> One row is three files. This half links the other two by name, on the last two lines; each of them
> links back on its first line.

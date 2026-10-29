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
> and reading time, not reach — a one-line edit to a core type is `risk: 5, size: S`.
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
> **`L` needs the human's word before the pair is written.** Nine files is Operating principle 4's
> ask-first line, and the honest fix is usually two ledger rows. When the human keeps it as one row,
> the comment carries their reason instead of the counts.
>
# TODO-1: A stolen refresh token stops working at the next refresh

> `TODO-N: <what it brings>` — the same line the ledger row carries, ≤ 60 chars. `N` is contiguous
> and 1-indexed, one pair per ledger row (`arch:sub-todo.md` § File location).
>
> **The title states what the TODO brings: the gain a user or the system has once it lands, never the
> work done to get it.** A reader who reads only the title MUST know why the TODO exists. The work
> goes in `## Increments`; the repo-terms line goes in each `### Commit` section.
>
> Good: *"A stolen refresh token stops working at the next refresh"* (the gain) ·
> *"A replayed refresh token signs the user out"*.
> Bad: *"Rotate refresh tokens on /auth/refresh"* (the work, no gain) · *"Add `TokenPair` type"*
> (a type, no gain) · *"Refactor `Session`"* (a verb with no result).
>
> A filled `<notes-dir>/todos/TODO-N.md` — **the human half of the pair**. Copy the section order and
> the shape of each one; each `>` block states the rules for the piece above it, except the
> `> **Check:**` line under each H2, which the copy keeps. The procedure around
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
>
> **Each H2 opens with a `> **Check:**` line, and the copy keeps it.** It is the one `>` line that
> stays: it tells the human what to check in that section before approving. Copy it verbatim. You
> MAY add one sentence that names the point in this TODO most worth checking — "the 409 in
> increment 2.1 is a new answer clients have never seen". Every other `>` line is a rule for the
> author, and the copy deletes it.

## Outcome

> **Check:** each bullet is a thing a user or a caller can do once this TODO lands. Find the capability you expect and do not see, and the one you did not ask for.

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

> **Check:** read each **Meaning** once. Say if you would use another word for this thing, or if the word already means something else in the code.

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

> **Check:** this tree is the whole reach of the change. Find the component you know must change and do not see here. Confirm that the `main` component is the one that carries the Outcome.

```text
pkg/auth                            # OWNS the refresh exchange
├── Handler                         #   modify · server · main — exchanges a valid refresh token for a new pair
│   └── Refresh()                   #     takes a `RefreshRequest`, returns a `TokenPair`, and invalidates the old refresh token
└── TokenMinter                     #   modify · command · supporting — mints an access/refresh pair for a user id
    └── MintPair()                  #     returns a `TokenPair` instead of one token string

cmd/api                             # OWNS the HTTP routes
└── Routes                          #   modify · wiring · supporting — maps `POST /auth/refresh` to the handler

scripts                             # OWNS the release scripts
└── ReleaseCheck                    #   create · command · supporting — builds from clean and checks every asset against the manifest
```


> The symbols this TODO touches, drawn as a **component tree** with the `show-me` skill. A human
> reads this tree *instead of* any diff: it is the whole reach of the change, stated for a reader who
> never opens the agent half.
>
> **One tree per package. The root is the package path and carries `# OWNS <one clause>`** — what the
> package is answerable for once this TODO lands. Two packages are two trees, never one stretched
> trunk; the tree holding the `main` component comes first.
>
> **A component is a child of a root, named bare** — `Handler`, not `pkg/auth.Handler`, because the
> root already says the package. A symbol, never a file path — paths live in the agent half's
> **Files**.
>
> **Every component line ends with `<touch> · <brick> · <part> — <role>`**, in one aligned comment
> column, indented one step past its root.
>
> **Touch** — `create | modify | delete`. **It types the symbol, not the file**: a `create` component
> may land in a file **Files** marks `modify`, and a `modify` component may need a new file. A
> component this TODO only reads belongs in **Pre-reads**, not here. An all-`create` tree is a
> greenfield slice; a `delete` component names its replacement in the same tree, or the TODO that
> already shipped it.
>
> **Brick** — `command | service | flow | gateway | server | consumer | policy | scheduler | wiring`.
> The roster, with the metric and common structure of each, is `arch:ref-bricks.md`. A component that
> fits no brick, or fits two, owns more than one responsibility — split it before writing the body.
>
> **Part** — `main` or `supporting`, and **exactly one component across every tree is `main`**: the
> one carrying the Outcome's behavior. Two candidates means the TODO does two things.
>
> **Role** — one sentence, this TODO's slice of the component's job. Not the component's full purpose.
>
> **A child of a component is one member this TODO decides** — a method, a field, a case. It carries a
> comment and no `·` triple, and it says what the member does for this TODO. Draw only the members
> the change decides; a member the TODO leaves alone is noise. The signatures stay in each increment's **Surface**.
>
> Every component maps to at least one path in the agent half's **Files**, and every non-test path
> there belongs to a component — except a file changed only as a consequence of another component's
> decision. Every component is named by at least one increment in `## Increments`, and no increment there
> names a component missing from the tree.
>
> **A wide tree is not a split signal** — two `main` candidates and more than ten increments are.
>
> **Every public member names its caller.** A component or member this TODO makes public (exported,
> or reachable from outside its package) ends its comment with `called by <package.Symbol> (TODO-N)`:
> the caller outside the package, in this spec. An interface implementation names the interface
> instead: `implements encoding.TextUnmarshaler`. The rules:
>
> - **No outside caller → private.** A caller is code outside the package that this spec writes, or a
>   planned caller: a step of a design or a later phase that the spec links, named as
>   `called by <the step> (planned, <link>)`. A test is not a caller. A caller someone "may" add, with
>   no step in a design, is not a caller.
> - **Expose the caller's operation, not its steps.** When a caller must call several members in a
>   fixed order to keep one invariant (take the lease, write, release), the package exposes that
>   sequence as one operation and keeps the steps private.
> - **A mechanism that keeps an invariant is private** — a lease, a lock, a retry loop, a wait limit.
>   The operation that needs it drives it. Only the errors a caller matches on stay public.

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

> **Which running paths this TODO changes, and how, step by step.** The increments below show what the
> symbols become. This section shows what a call does, in order, and which steps are new. A reviewer
> reads it to see every new step and every new check before any code exists.
>
> **One H3 per flow.** A flow is one path a call takes from its entry point to its result: a request
> handler, a CLI command, a job, an event consumer. The heading names the entry point in domain
> words, the way a caller enters it. When the flow is a step of the `main` flow in
> `<notes-dir>/workflows/flows.json`, add `— main flow step <n>`. The line under the heading is the
> `package.Class.method` that runs the flow, as italic code: ``*`pkg/auth.Handler.Refresh`*``.
>
> **Steps as Python-style pseudocode, in the order they run.** One ` ```python ` block per flow, so
> every editor colors the keywords. The first line is `def <method>(<inputs>):`, with the method of
> the italic line. The keywords carry the control flow, and the indent carries the nesting:
>
> | Keyword | Use it for |
> |---------|------------|
> | `if` / `elif` / `else` | a guard or a path the flow can take |
> | `for attempt in range(5):` | a retry, with its bound |
> | `while` | a wait with no fixed count; a comment names its limit |
> | `with` | a scope that holds a resource: a lease, a transaction, an open file |
> | `return` | the result the caller gets, also a status (`return 401`) |
> | `raise` | a stop with the error the caller gets (`raise objfs.ErrVersionMismatch`) |
>
> One line per step. Write the names in domain words (`read_instance_record(id)`). A symbol keeps
> its exact name only when it is a `## Components` row or an error the caller matches on. The block
> is not code: no types, no error plumbing, no imports. A fact the code cannot show, such as
> "nothing written" or "a start that a crash cut", goes in a trailing comment.
>
> **Each changed line ends with its marker comment.** A line with no marker is unchanged context.
>
> | Marker | Means | The comment also says |
> |--------|-------|-----------------------|
> | `# +` | a new line: a step, or a new `if` / `elif` / `else` / `raise` (a check or a path) | an optional note |
> | `# ~ was: <before>` | a line that now does something else | what it did before |
> | `# - <the step>` | a step that is gone: the whole line is this comment, so the gap shows | nothing more |
> | `# moved, was: after <step>` | a line that runs at a new position | the step it ran after before |
>
> **Show the whole flow up to 20 lines.** Past 20, keep each changed line, the `def`, the `if` /
> `for` / `with` lines that hold it, and one unchanged line on each side. Write `...` for the lines
> between.
>
> **Every marked line has a case in `TODO-N.test.md` `## Autotest`.** A new `if`, `elif`, `else`, or
> `raise` with no case that takes it is a path nobody tests.
>
> A new flow has `# +` on every line. The usual `none` is a rename: `none — renames Session fields;
> every step runs as before`.

## Increments

> **Check:** for each increment, read the summary, then **Surprises**. Agree or disagree with each surprise: these are the details you would otherwise find only in the code. Confirm that each diff stays in the one component under its heading. At each `### Commit` section, confirm that its title states one change.

> **The whole contract change, cut into the steps `impl` applies, one H3 per step in apply order,
> grouped into commits.** An increment is the smallest step worth approving on its own. A commit is
> the smallest group of increments with a clear border. `## Components` says *which* symbols move;
> each increment says *what they become* and *what will surprise the reader*; each `### Commit`
> section says what the group ships.
>
> **One TODO, one deliverable, one or more commits.** Cut a new commit when the next increments ship
> a second cause: a refactor that prepares the change, the change itself, a tool beside it. A TODO
> with one cause has one commit, `### Commit 1`, after its last increment.
>
> **A commit has a clear border.** At each commit, `impl` checks three things before the next
> increment starts:
>
> - The repo builds, and the existing tests pass.
> - The commit has its own **Title** and **Body**, with one cause.
> - The Autotest cases its **Proves** line names pass.
>
> So a signature change and the increment that migrates its callers are always in one commit. A
> broken build never crosses a commit border.
>
> **Each increment is self-contained for review.** A reviewer reads one H3 and nothing else, and
> can approve or reject it. So the summary never points elsewhere ("as above", "see increment 1.1"),
> and the diff holds every symbol the summary names as new or changed.
>
> **One increment, one component.** The component line names exactly one `## Components` row, and the
> increment changes code of that component only. A change in a second component — a caller moved to
> a new signature, a route that calls the new method, a constructor that passes the new dependency —
> is its own increment, with **Change** `call-site migration` or `wiring`. Every row is named by at
> least one increment, and no increment names a component missing from that table.
>
> **No file paths.** Name a symbol as `## Components` does. Which file each increment touches is in
> the agent half's **Files**, keyed by increment number.
>
> Heading: `### <c>.<i>. <imperative title>` — `c` is the commit, `i` the increment inside it. Both
> are 1-indexed and contiguous, and `i` starts again at 1 in each commit. The title is in domain
> words with no symbol. Then, in this order:
>
> | Part | Content |
> |------|---------|
> | **component** | The line under the heading: the `## Components` row, as italic code — ``*`pkg/auth.TokenMinter`*`` |
> | **summary** | A plain paragraph right under the heading, one to three sentences: what the increment brings. When it changes existing behavior, it compares the two: `Before, <what the code did>. Now, <what it does>.` No code, no signature |
> | **Landed** | `yes` or `no` — whether this increment is in its commit. `todo` writes `no`; `impl` flips it after the commit or amend (`arch:ref-write.md` § Progress) |
> | **Change** | this increment's change kind — one of the nine in `impl:ref-change-types.md` |
> | **Extends** | the existing symbol this increment grows, and what it gains: `` `pkg.Type.Method` — <what it gains> ``. Or `` new — checked `<A>`, `<B>`: <why none fits> `` |
> | **Surprises** | one to seven nested bullets: the details a reader misses in the summary and the diff and finds later only in the code |
> | **Surface** | the diff this increment lands, as one ```diff block — or a plain contract block, or `none — <reason>` |
>
> **Surprises is what the reader would find only in the code.** An edge case, a refused input, a
> changed default, an order that matters, a callee error passed through, a caller that stops
> compiling. Name the symbol, the value, or the case. A restated summary, "be careful", or a risk
> with no case is not a surprise. `none — <reason>` only when no code reads the new code yet.
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
> **Every new public symbol is in a Surface diff.** An increment adds only the public types,
> functions, and methods its own diff names (`impl:sub-impl.md` step 5); a private helper may land
> with a body. A public symbol missing here has no increment to land in.
>
> **Order — deepest first**: the callee before its caller, the type before its user, the wiring
> last. **A broken build lasts one increment**: a signature change that a caller in another
> component reads is followed at once by the increment that migrates that caller, in the same
> commit, and its **Surprises** names the callers that stop compiling. `impl` applies the two as one
> step.
>
> **Sizing: ≤ 10 increments per commit, ≤ 4 commits, ≤ 150 changed lines per diff.** More and the
> TODO is too big — split the ledger row. Over 150 lines, first look for a body; deleting one usually
> takes the diff under. If every line is real surface and it still cannot compile below that, add a
> `**Compile floor:**` bullet under the diff saying why.

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

> The shape every increment follows. **Surface** means what a caller of the changed code can see:
> types, fields, method and function signatures, and settings — config keys, flags, defaults — with
> their real values. New surface is all-`+` in real syntax, and no field or signature is elided.

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

> The callers carry no diff here: they are another component, so increment 1.3 moves them, and this
> increment's **Surprises** names them (`arch:ref-todo-sections.md` § A diff carries the change, not
> what the change forces).

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

> **The message of one commit, written here in full and copied — never re-derived at commit time.**
> It closes the group of increments above it, after a `---` line. Three fields.
>
> **Title** — the exact line the implementer commits: `<prefix>: <line>`, ≤ 72 chars, imperative, no
> period, prefix from the standard set. The ledger entry's `Commit` is the title of the commit that
> holds the `main` component's `new behavior` increment.
>
> **Body** — cause, goal, and the decision if a live alternative was rejected, one paragraph each in
> that order. Full contract: `wm:commit-message`. Write it for a reader who has only the repo: no
> `TODO-N`, no increment number, no ADR number, no ticket. The increments are gone once the commit
> lands, and this text is all that stays.
>
> **Proves** — the `TODO-N.test.md` cases that pass from this commit on, as `<level> — `<case>``,
> comma-separated. Every Autotest case is named by exactly one commit: the first one at which it can
> pass. A commit with no case of its own writes `none — <reason>` — the concrete reason the
> existing tests are its whole proof.
>
> **Check the commits against the Outcome before any increment lands.** Together, the titles state
> the change the Outcome promises, in the repo's terms. A capability in one and not the other means
> the TODO is wrong — fix it at `todo`, not at commit time.

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

> This increment carries the Outcome's logic, so its **Surprises** carry the two decisions a reader
> cannot infer from the summary: the 409 and the delete-before-store order. The steps in run order
> are in `## Flow changes`.
>
> **An interface implementation shows the interface, not its methods.** A type that implements an
> interface carries one assertion line per interface (`var _ lifecycle.SettingsStore = (*InstallationsDirectory)(nil)`)
> and lists only the public methods no interface declares, plus its constructor. A method the
> interface declares is new surface only when the TODO changes that interface.
>
> **No comments and no `AGENT:` markers in a diff.** A decision that seems to want a comment belongs
> in an ADR.

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

> **The shape to copy when the deliverable is a whole body** — a script, a test file, a migration, a
> query. Its **Surface** is a plain fenced contract (invocation, arguments, exit codes, output)
> instead of a diff, and its **Surprises** carry the edge cases: the env var that must be unset, the
> second run that must not refetch. The real commands and paths are implementation the implementer
> writes at the keyboard.
>
> The doctrines limiting a diff's contents — its decided change, not consequences; its surface, not
> a body — are `arch:ref-todo-sections.md` § A diff carries the change, not what the change forces
> and § A diff carries the surface, not a body.

---

### Commit 3

**Title:** `build: check a release before it ships`

**Body:**

Nothing checked a release before it shipped, so a missing asset reached users.

A script now builds the release from clean and checks every asset against the manifest.

**Proves:** none — the script has no Autotest case; the agent half's `## Manual test` runs it against a real build.

## Deviations

| What | Shipped instead | Why | ADR |
|------|-----------------|-----|------|
| `## Increments` 2.1: `Refresh` | takes `ctx context.Context` as its first argument | the store call it now makes must be cancellable | [ADR-0012](../adr/0012-refresh-is-cancellable.md) |

> **Not yours to write.** `todo` never creates this section; the pair leaves the gate with the
> sections above and nothing after them. `impl` appends it when the user corrects a shown diff into
> something a section above forbids, and only when the correction stays inside this TODO.
>
> Read it as a reader of the pair: the approved text above still says what the human approved, and
> this table says where the shipped code went elsewhere and which ADR holds the reason. One row per
> correction, four columns:
>
> - **What** — the section and the symbol, id, or case the correction contradicts: `## Increments 2.1:
>   Refresh`, `## Autotest Unit: case 3`, `## Outcome`.
> - **Shipped instead** — the shape or behavior that actually landed, one line.
> - **Why** — the reason the approved version lost, one line.
> - **ADR** — a markdown link to the `kind: implementation` ADR holding the full reasoning.
>   **Required on every row, and written before the row is.** This block is temporary: `revise`
>   folds the rows in and deletes it, so the ADR is the only thing that survives. A row with an empty ADR column takes
>   the reason with it, and the approved text it replaced then reads as if nobody chose against it.
>   `spec-lint.py` check B4 fails a row without one.
>
> `revise` folds every row into the section it names and deletes the whole block. A correction that
> reaches past this TODO — another TODO's symbol, a ledger row, a settled `architecture` or `feature` ADR — is not a
> deviation: it routes to `revise`.

---

**Tests:** [TODO-1.test.md](TODO-1.test.md)

**Agent:** [TODO-1.agent.md](TODO-1.agent.md)

> One row is three files. This half links the other two by name, on the last two lines; each of them
> links back on its first line.

# code — todo (TODO bodies)

Authors `todos/TODO-N.md` bodies from a reviewed `spec.md` + `thoughts/`. Owns the TODO element
list, the **verification chain**, and the **outcome** rules. Spec contract + the gate: `ref-write.md`.
Vocabulary: `../GLOSSARY.md`.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

## Precondition — past the gate

Run `todo` only after a human has reviewed the spec (`ref-write.md` § the gate). `new` stops before
this deliberately. Before authoring: `spec.md` frontmatter `status: review`, **no `status: open` question
note in `thoughts/`** (`~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts` exits 0), ledger
settled, and the human has asked for TODOs. Otherwise stop and run `/code new` first.

## Audience — a context-free Sonnet implementer

No project context, no judgment, no permission to improvise. If the implementer must *infer*
anything — a path, a name, a test command, a decision — the TODO is broken. Rewrite it.

**Self-contained means: the TODO alone is enough.** The implementer reads this one file and never
opens `spec.md` or a thought note to know *what* to build. `spec.md` carries no Design Decisions to
fall back on, so a constraint **an increment of this TODO can violate** is restated here in
`## Constraints` — the note links are provenance, not required reading. Test the draft by asking:
with `spec.md` and `thoughts/` deleted, could an implementer still write the code and both tests?
If not, the TODO is not finished.

**Self-contained is not exhaustive.** Restate the rule, never its discussion: one `## Constraints`
row, in the words the implementer must obey. A constraint no increment of this TODO can violate is
not restated at all — it binds another TODO, and a second copy here is a copy that drifts. The same
holds for the spec's Description, Goal, and target picture: they are the human reviewer's context,
not the implementer's, and they never appear in a TODO body.

**Budget — a TODO body is ≤ 150 lines.** Over budget means the TODO carries more than one
deliverable: split it into two ledger rows, never shrink the diffs or drop the Autotest to fit.

## Operating principles

1. **Concrete over abstract.** Real paths, commands, signatures. No "etc.", "as needed".
2. **Strong verbs.** *rename X to Y, add field Z to type T, delete function F* — never *improve, handle, refactor stuff, clean up*.
3. **Every section is a checklist to tick off.** Prose → bullets, a table, or a code block.
4. **One TODO = one deliverable = one commit.** One outcome a user can observe; group the edits that deliver it, nothing else. >8 files → ask before writing.
5. **The diff is the spec** — every change ships as a unified diff the implementer applies, never prose it translates. Pseudocode (the `flow-scetch` skill) is a supplement, not a substitute.
6. **No outward links** — reference other TODOs only via `Depends on`.
7. **Pre-reads are mandatory** — every file to understand before editing.
8. **New terms are defined, not assumed** — a domain term missing from `GLOSSARY.md` gets a `## New terms` row (see § New terms below).
9. **Components come before changes** — name the `package.Class` set and mark the one holding the main part, then split the work into ordered increments over those components (see § Components, § Changes).
10. **The commit is approved in small increments, not in one read.** `## Changes` is an ordered increment sequence: each increment is one small diff a human approves alone, and each approved increment is appended to the same commit. One TODO stays one deliverable; only its *review* is split (see § Changes).

## File location

`<notes-dir>/todos/TODO-N.md`, `N` 1-indexed and contiguous, one file per ledger entry. Restate that
that entry's outcome verbatim at the top. Resolve `<notes-dir>` from the active phase — never hardcode `.notes/`.

## Required elements — in order

A `---` frontmatter block carries the technicals (status + the four fields below); the body carries
prose only. Exact keys and headings, this order. The template ([tpl-todo.md](../references/tpl-todo.md))
is this list as a fillable skeleton; they stay in lock-step. The **verification chain** runs first
(type → Outcome → Terms → Constraints → Components → Changes → Autotest), then execution scaffolding — a human reads the
frontmatter + body top-down and stops after Autotest; the implementer reads on.

**Frontmatter** (`---` block, before the H1) — machine fields, all always required:

| Key | Required | Block |
|-----|----------|-------|
| `status` | always | — |
| `type` | always | verify |
| `depends_on` | always (`[]` if none) | scaffold |
| `risk` | always | verify |

**Body** — headings, this order:

| # | Element | Level | Required | Block |
|---|---------|-------|----------|-------|
| 1 | `TODO-N: <title>` | H1 | always | — |
| 2 | `Outcome` | H2 | always | verify |
| 3 | `New terms` | H2 | only if the TODO adds terms missing from GLOSSARY.md | verify |
| 4 | `Constraints` | H2 | always when a settled decision binds this TODO | verify |
| 5 | `Components` | H2 | always | verify |
| 6 | `Changes` | H2 | always — an ordered increment sequence, one H3 per increment | verify |
| 7 | `Autotest` | H2 | always — **both** a `Unit` and an `E2E` sub-block | verify |
| 8 | `Files` | H2 | always | scaffold |
| 9 | `Pre-reads (MUST read before editing)` | H2 | always | scaffold |
| 10 | `Skills to load` | H2 | always | scaffold |
| 11 | `Manual test` | H2 | always | scaffold |
| 12 | `Commit` | H2 | always | scaffold |
| 13 | `Definition of done` | H2 | always | scaffold |

Missing any always field/element → invalid. Worked example: [../examples/ex-TODO.md](../examples/ex-TODO.md) — match its concreteness.

## The verification chain

A correct TODO is self-explanatory: a human approves it by walking seven elements, repo closed.

**type → Outcome → New terms → Constraints → Components → Changes → Autotest**

| Element | Verifies | Link |
|---------|----------|------|
| `type` (frontmatter) | what kind of change — frames the rest | — |
| Outcome | is this the right capability? (the anchor) | — |
| New terms | right vocabulary, consistent with GLOSSARY.md? | grounds Outcome |
| Constraints | which settled decisions bind this slice? | bounds Outcome |
| Components | which `package.Class` set changes, and which one holds the main part? | locates Outcome |
| Changes | do the increments deliver the Outcome, and is each one small enough to approve alone? | fulfills Outcome |
| Autotest | do the unit **and** e2e tests prove the Outcome? | verifies Outcome |

Outcome is the anchor; Changes and Autotest are checked *against* it. Consistent chain → correct
TODO. The rest — Files, Pre-reads, Skills, Commit, Manual test, Definition of done — is execution
scaffolding, machine-checkable (paths exist, command runs, subject ≤ 72 chars), no human read.

## Section rules

> The first four are frontmatter keys (`status`, `type`, `depends_on`, `risk`); the rest are body headings.

### status
The TODO's lifecycle phase — `todo → impl → verify → done`, `blocked` off the path. Machine + who sets each transition: `ref-write.md` § Status. `todo` authors it at `todo` (or `blocked` if a `depends_on` TODO is not yet `done`); never author a TODO straight to `impl`/`done`.

### type
One of `workflow | state machine | component | event handler | data shape change`. Determines the pattern any `## Changes` **Behavior** snippet follows — see the `flow-scetch` skill.

### depends_on
`[]`, or `[TODO-M]`, or several (`[TODO-2, TODO-3]`) — each must reach `status: done` first. No forward references. This list defines the **waves** in `spec.md` § Plan, so record only real edges (`ref-write.md` § Waves): a file this TODO's **Files** cannot touch until M creates it, a symbol M introduces, or a test that cannot pass before M lands. "Feels later" is not an edge — a false one serializes the spec.

### risk
A 1–5 score for **reach** — the surface a regression forces you to retest, not effort. A one-line edit to a shared type is a 5; a large isolated new module is a 1.

| Score | Reach | Retest |
|-------|-------|--------|
| 1 | local, additive — new path, no existing behavior touched | just the new path |
| 2 | one component, isolated edit | that component |
| 3 | modifies behavior others call | component + its callers |
| 4 | shared/utility code, several consumers | every consumer |
| 5 | core contracts many modules depend on | cross-module regression pass |

Format: `risk: <1-5>` in frontmatter. Score ≥ 3 → Autotest/Manual test covers the callers, not just the new code. High score signals keep-it-small, not blocked.

### Outcome
**Capability, not implementation.** Answers *"what new can the system do once this lands?"* in use-case language.

- Phrasing: `<actor> can <capability> [when <condition>]` or `<aggregate> emits <event> when <command> succeeds`. Present tense, active.
- GLOSSARY.md names verbatim. One or two sentences — more means the TODO is too big, split.
- **Banned:** file paths, function/struct names, routes, package names, libraries, "add a field", "wire up".
- Don't restate the spec Goal — scope to *this* TODO's slice.

Good: *"A `User` can issue `RotateToken`; on success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid."*
Bad: *"Add a `/auth/refresh` handler in `pkg/auth/handler.go`"* (paths/infra) · *"Introduce a `RefreshRequest` struct"* (types, not capability).

Pure refactor with no new capability → say so: *"No new capability; reshapes the `Session` aggregate so future `RotateToken` variants share a path."* Still in Terms, not paths.

### New terms
Any domain term not in GLOSSARY.md gets a row here, immediately after Outcome, **and** is added to GLOSSARY.md the same pass:

```markdown
## New terms

| Term | Kind | Description |
|------|------|-------------|
| TokenJar | entity | Per-user container of active refresh tokens; bounded to 5, LRU-evicted |
```

`Kind` ∈ the GLOSSARY.md set. Description is one sentence with the visible contract (TTL, bounds, error semantics). No new terms → omit the section (never write `## New terms\nnone`).

### Constraints

The settled decisions **an increment of this slice can violate** — one row per decision, the rule
only. Since `spec.md` keeps no Design Decisions, this section is the implementer's only source for
them; it is not a mirror of `thoughts/`.

```markdown
## Constraints

| Constraint | From |
|------------|------|
| A second refresh on the same token returns 409; never two valid pairs | [[003-decision-single-flight]] |
| Refresh tokens expire 15 minutes after issue | [[002-fact-token-ttl]] |
```

- One sentence per row, in the imperative or as an invariant — what the code must do, not what was debated. No trade-off prose, no rejected alternatives: those stay in the note.
- Exactly one row per decision an increment can violate; a decision no increment can violate belongs to the TODO it binds, not to this one.
- A constraint the tests can check gets a matching case in **Autotest**.
- No settled decision binds this slice → omit the section (never write `## Constraints\nnone`).

### Components

The `package.Class` set this TODO touches, one row each, **main part first**. This table is the map
`## Changes` walks: every row is named by at least one increment, and no increment names a component
missing from this table.

```markdown
## Components

| Component | Part | Role |
|-----------|------|------|
| `pkg/auth.Handler` | main | Accepts the rotation request and returns the new pair |
| `pkg/auth.TokenMinter` | supporting | Mints an access/refresh pair for a user id |
| `pkg/redis.Client` | supporting | Stores and deletes the session key |
```

- **Component** — `package.Class` in the project's own notation (`pkg/auth.Handler`, `auth.SessionStore`,
  `blocks/upload/model.UploadState`). A symbol, never a bare file path — paths live in **Files**. New
  component → suffix ` (new)`.
- **Part** — `main` or `supporting`. **Exactly one row is `main`**: the component that carries the
  Outcome's behavior. Two candidates for `main` → the TODO does two things, split it.
- **Role** — one sentence, this TODO's slice of the component's job. Not the component's full purpose.
- Every row maps to at least one path in **Files**, and every non-test path in **Files** belongs to a row.
- More than 5 rows → the TODO is too wide; ask before writing.

### Changes

**An ordered sequence of increments — the diffs that build the commit, in apply order.** One TODO
is still one deliverable and one commit; `## Changes` splits only its *review*, so the human approves
a small diff at a time instead of a whole feature at once.

**Increment** = the smallest diff worth approving on its own. `### <n>. <imperative title> — `<package.Class>``,
`n` 1-indexed and contiguous. Each increment names exactly one row from `## Components`; a component
may span several increments.

Each increment carries these bullets, in order, then its diff:

| Bullet | Required | Content |
|--------|----------|---------|
| **Files** | always | the repo-relative paths this increment alone touches — a subset of `## Files` |
| **Blast radius** | always | the **predicted** reach: the symbols, callers, and consumers a mistake here forces you to retest. Name them; `"low"` is not a blast radius |
| **Diff** | always | unified git-diff in the file's real language, one ```diff block per file, ≤ 25 changed lines |
| **Behavior** | only on the increment carrying the Outcome's logic, and only when the diff does not show the flow | TS pseudocode per the `flow-scetch` skill, ≤ 40 lines, side effects + error paths visible |

**Ordering — deepest first.** Order increments so the repo builds after each one: the callee before
its caller, the type before its user, the wiring last (same rule as **layer (Ln)**). An increment that
cannot build alone says so: `builds: only with increment <n>`.

**New surface ships as an all-`+` diff written out in full** — every field, method, and doc comment,
real syntax. No `// ...` placeholders. The implementer copies; it does not design. A decision belongs
in a `thoughts/` note (and, restated, in `## Constraints`) — never buried in a `/* ... */`.

**Sizing.** > 25 changed lines in one diff → split it. > 10 increments → the TODO is too big, split
the TODO. An increment whose diff is one line is fine; small is the point.

> On save the `format-todo` PostToolUse hook (`bin/format-todo.sh`) runs prettier over each ```ts block; unparseable pseudocode is left verbatim, ```diff blocks untouched. Don't hand-align the block — write it, the hook formats it.

````markdown
### 1. Return a pair from the minter — `pkg/auth.TokenMinter`

- **Files:** `pkg/auth/token.go`
- **Blast radius:** every caller of `mintTokens` — `pkg/auth/handler.go`, `pkg/auth/login.go`
- **Diff:**

```diff
-func mintTokens(userID string) (string, error)
+func mintTokens(userID string) (TokenPair, error)
```

### 2. Exchange the token in the handler — `pkg/auth.Handler`

- **Files:** `pkg/auth/handler.go`
- **Blast radius:** `Refresh`'s callers — `pkg/auth/middleware.go`, `cmd/api/routes.go`
- **Diff:**

```diff
-func Refresh(ctx context.Context, token string) (string, error)
+func Refresh(ctx context.Context, req RefreshRequest) (TokenPair, error)
```

- **Behavior:**

```ts
function refresh(req: RefreshRequest): TokenPair | 401 { ... }
```
````

**How the increments reach the commit** (executed by `sub-impl.md`, stated here so the human knows
what an approval buys): increment 1 creates the commit; each later approved increment is appended to
that same commit (`git commit --amend --no-edit`). The final message is `## Commit`. A rejected
increment stops the TODO — nothing after it is applied.

### Autotest

**Two levels, both required: `Unit` and `E2E`.** One TODO ships the behavior *and* the proof at both
scales — that is what makes it self-contained. Neither level is optional by default.

| Level | Proves | Scope |
|-------|--------|-------|
| `Unit` | the changed unit behaves, in isolation | the new/edited function, type, or component; no network, no DB, no process boundary |
| `E2E` | the **Outcome** holds through the real entry point | the request/command enters where a user or caller enters it and the observable result is asserted |

Each level carries, on its own bullets:
- **Target files** — the test file path (`create` if new).
- **Cases** — one-sentence `input → expected` bullets; each traces to the Outcome or to a `## Constraints` row. Derive the minimal-but-covering set via `test` (pairwise tiering).
- **Command** — one runnable shell command. Never "run the relevant tests".

A level that genuinely cannot exist is written `none — <one-line concrete reason>`; the reason names
what makes it impossible, not that it feels redundant. Auto-reject: "covered by the unit test",
"trivial", "no e2e harness" (name the missing harness and add a TODO for it instead). A pure refactor
with no behavior change may set `E2E: none — no observable behavior changes; unit suite pins the
reshaped API`, but only when the Outcome itself claims no new capability.

For a TODO whose Outcome is not observable end-to-end alone (a leaf in `W1` that nothing calls yet),
the `E2E` level names the wave-mate or later TODO whose e2e test covers it: `none — observable only
via TODO-3; its E2E case asserts this path`. That is the one shape where an e2e gap is legal, and it
must name the TODO.

### Manual test
Required even when Autotest covers the behavior — catches integration / UX the suite can't see. `Steps` (literal commands) and `Expected` aligned 1:1. `Skip?` defaults to `no`; to skip, `skip — reason: <specific>`. Keep only cases a test can't prove (UX feel, log shape, real third-party behavior).

### Commit
`Prefix` from the standard set; `Subject` the exact line the implementer commits (≤ 72 chars, imperative, no period); `Description` the commit body — why the commit exists, copied from the ledger entry's `Why`. Full conventions: `sub-commit.md`.

### Definition of done
Checklist the implementer ticks before advancing `status` to `verify` and filling the ledger's Commit: Files, Autotest, Manual test, scope discipline, Commit subject. Add items only for unusual post-conditions (e.g. "migration applied on staging").

## Implementation decisions

Choices the spec didn't make — file naming, package structure, error strategy, data shape — are
**impl-decisions**. Write each to `thoughts/` before the next section. Template + when-to-write:
[`tpl-note-impl-decision.md`](../references/tpl-note-impl-decision.md).

## Iteration

Edit in place, same `N` unless order changes (then renumber and update the ledger). A TODO already `status: done` → don't bump; make a new one.

## Pre-save checklist

- [ ] All `always` elements present and ordered; `New terms` present iff the TODO adds terms; `Constraints` present iff a settled decision binds this TODO
- [ ] Every `## Constraints` row's `From` link resolves to a real `thoughts/` file
- [ ] **Self-contained**: with `spec.md` and `thoughts/` deleted, the TODO still says what to build and what to assert
- [ ] **Not over-stated**: every `## Constraints` row names a rule an increment below can violate; no spec Description/Goal/target-picture prose was copied in
- [ ] Body ≤ 150 lines — over budget → split the ledger row, don't compress
- [ ] **Autotest** has both a `Unit` and an `E2E` sub-block, each with Target files + Cases + one runnable Command — or `none — <concrete reason>` (an `E2E: none` that defers to another TODO names it)
- [ ] Every **Files** / **Pre-reads** path exists (or is marked `create`)
- [ ] `## Components` has exactly one `main` row, ≤ 5 rows, each a `package.Class` symbol; every row maps to a **Files** path and every non-test **Files** path maps to a row
- [ ] `## Changes` is an ordered increment sequence — `n` contiguous from 1, ≤ 10 increments, each naming one **Components** row, ordered deepest-first so the repo builds after each (or marked `builds: only with increment <n>`)
- [ ] Every increment carries **Files** (a subset of `## Files`), a **Blast radius** that names the real symbols/callers to retest, and a ```diff of ≤ 25 changed lines — new surface written out in full, no `// ...`
- [ ] Every **Components** row is named by at least one increment, and no increment names a component missing from the table
- [ ] **Outcome** is a capability in GLOSSARY.md terms — no paths, types, routes, libraries
- [ ] **Manual test** Steps/Expected aligned 1:1
- [ ] `Commit.Subject` ≤ 72 chars, imperative; no vague verbs anywhere; no spec-Goal/AC references
- [ ] Matching ledger row exists in `spec.md`, and the TODO sits in exactly one `## Plan` wave whose members' **Files** sets are disjoint from this one's

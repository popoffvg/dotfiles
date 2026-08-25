# code — todo (TODO bodies)

Authors the `todos/TODO-N.md` + `todos/TODO-N.agent.md` **pair** from a reviewed `spec.md` +
`thoughts/`, and appends the settled decisions it finds to `<notes-dir>/CONSTRAINTS.md`. Owns the
TODO element list, the **verification chain**, and the **outcome** rules.
Spec contract + the gate: `ref-write.md`. Vocabulary: `wm:GLOSSARY.md`.

## One ledger row, two halves

| File | Read by | Holds | Length |
|------|---------|-------------|--------|
| `TODO-N.md` | the human, repo closed | frontmatter, Outcome, New terms, Components, **Surface (the diff)**, Autotest, Commit | ≤ 550 lines |
| `TODO-N.agent.md` | the implementer | Constraints (the pointer), Changes (the increments, **described — no diff**), Files, Pre-reads, Manual test, Definition of done | **unlimited** |

The split is by audience, not by size. `TODO-N.md` is the design a human approves — what the system
will be able to do, which symbols move, **what those symbols become**, what proves it, and what the
commit says. `TODO-N.agent.md` is how to get there: the order of the work, what to do at each step,
and the rules that bound it.

**The diff is the human's, and it lives in one place.** `## Surface` in the human half carries the
whole contract change — every type, field, signature, and setting the TODO touches — because that is
the thing a reviewer approves before code exists. The agent half never carries a diff: an increment
says *what to do*, and the shape it produces is already written once in § Surface. A diff in both
halves is one fact in two files, and the two disagree the moment either is edited.

**No TODO carries a constraint, and none carries an origin.** The settled decisions live once, in
`<notes-dir>/CONSTRAINTS.md` (§ Constraints), and the agent half points at that file. The *why*
behind any of them is not stored in `todos/` at all: it lives in `thoughts/`, and the `trace` skill
walks to it on demand. A copy of a rule in twenty TODOs is twenty rules to change when the decision
changes; a stored origin link is a link that rots the moment a note is superseded.

**No file restates another.** The title, the `status`, the Outcome, and the diff live in `TODO-N.md`
alone; the paths, the increments, and the pre-reads in `TODO-N.agent.md` alone. Each half carries
exactly one link to the other, and no second copy of anything travels along it.

**The row is atomic.** Both files are written in the same pass, and both are deleted or renumbered
together. A `TODO-N.md` with no agent half cannot be implemented; an agent half with no human half is
work nobody approved.

## Precondition — past the gate

Run `todo` only after a human has reviewed the spec (`ref-write.md` § the gate). `new` stops before
this deliberately. Before authoring: `spec.md` frontmatter `status: review`, **no `status: open` question
note in `thoughts/`** (`~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts` exits 0), ledger
settled, and the human has asked for TODOs. Otherwise stop and run `/code new` first.

## Execution — one fork per ledger row, wave by wave

`todo` authors every pair in the ledger, and the ledger already says which rows are independent:
`new` compiled the `## Plan` wave table, and a wave is by definition a set of rows with no edge
between them. Author a wave **in parallel — one fork per row**. The run then costs one round trip
per wave instead of one per TODO.

**Why a fork and not a fresh agent.** A fork starts from this conversation, so the corpus is read
once by the caller and inherited by every row: `spec.md`, the `thoughts/` graph, `GLOSSARY.md`, and
the grill that settled them. A `general-purpose` agent would re-read the corpus once per row and
still arrive without the grill — and the grill is where the decisions that become `CONSTRAINTS.md`
rows were made. A fork also inherits the caller's model (`model:` is ignored on a fork),
which is the right one here: writing `## Changes` is design, not extraction.

**The unit is the row, never one file of it.** One fork writes `TODO-N.md` **and**
`TODO-N.agent.md`. The row is atomic (§ One ledger row, two halves) and the two are written against
each other — Components is the map `## Changes` walks. Splitting them across forks puts the map and
the walk in contexts that cannot see each other.

### Step 1 — read the corpus once (caller)

`spec.md` (ledger + wave table), the `thoughts/` graph, `GLOSSARY.md`. Everything read here is
inherited by every fork; everything skipped here is re-read N times or missed N times.

Enter `thoughts/` through the index, never by reading the directory: run
`~/.claude/scripts/wm-thought-index.py <notes-dir>/thoughts`, read every note's `description`, and
open in full the notes that bear on the rows in this run's waves (`arch:ref-note-format.md` §
Finding the thought for your task). The descriptions are the map the forks inherit — a note whose
description shows it bears on no row in the wave costs nothing to leave closed.

### Step 2 — fan out the wave (caller)

One fork per row in the current wave, **all `Agent` calls in one assistant message** — calls in
separate messages run serially, not in parallel. Each prompt names the row and its number block and
nothing more; the context is already there.

```
Agent(subagent_type="fork", prompt=
  "[TODO-N] Author the pair for ledger row N: <the row's outcome, verbatim>.
   Follow ${CLAUDE_PLUGIN_ROOT}/skills/arch/commands/sub-todo.md in full — you are past the gate.
   Write exactly two files: <notes-dir>/todos/TODO-N.md and <notes-dir>/todos/TODO-N.agent.md.
   Impl-decision notes: take thoughts/ numbers <lo>-<hi>, no others.
   Write nothing else — not spec.md, not GLOSSARY.md, not CONSTRAINTS.md, not another row's files.
   Return, and only this: your `## New terms` rows (or `none`), your `## Files` paths, the
   impl-decision notes you wrote, every settled decision an increment of this row can violate that
   CONSTRAINTS.md does not already carry — the rule and its origin — and any contradiction in the
   row you could not resolve.
   Do not summarize the files — the caller reads them.")
```

The `budget-check` hook fires inside the fork, where the write happens (§ Budget). The caller does
not re-count what the hook already blocked.

### Step 3 — merge what a fork may not write (caller)

A fork owns its pair and nothing shared. Each artifact below is one file that every row in the wave
would otherwise write at once:

| Shared artifact | Who writes | Why not the fork |
|---|---|---|
| `GLOSSARY.md` | caller, from the returned `## New terms` rows | Parallel writes to one table lose rows — and only the caller can see two forks minting two names for one concept. |
| `CONSTRAINTS.md` | caller, from the returned rules | The same table-write collision, plus the reason the file exists: only the caller can see that two forks returned one rule twice, and appending it twice is the duplication the file removes. Assign `R<n>` in return order and never renumber. |
| `spec.md` — ledger, wave table | caller only | A row a fork finds wrong is a spec problem, not a pair problem: the caller fixes the ledger row, or stops and runs `revise`. |
| `thoughts/NNN-*.md` | the fork, inside its assigned block | The number is the collision: two forks both take the next free `NNN` and write the same file. The block is handed out in the prompt. |
| the notes `jj commit` | caller, once per wave | `code:ref-subcommand-rules.md` § Log to notes-dir. |

Then run the four checks that are cross-row by construction, and so belong to nobody inside a fork:

- **Two pairs in one wave share a `## Files` path** → the wave was wrong. Fix the wave table in
  `spec.md`, or merge the rows; shipping the overlap puts two implementers in one file.
- **A fork's real `depends_on` is an edge the wave table does not carry** → move the row to a later
  wave and re-check the one it left.
- **Two rows named one concept differently** → one term wins in `GLOSSARY.md`, and the pair that
  loses is edited to match before the next wave reads it.
- **A fork returns a rule it could not source** → the decision was made and never recorded. The
  caller writes the missing note at a number outside every handed-out block, or stops and runs
  `/code new` when the decision is the human's to make; then the `CONSTRAINTS.md` row cites it.
  Appending a rule with no origin is how a corpus becomes unarguable.

### Step 4 — the next wave

Fan out `W2` only once `W1`'s pairs are on disk. A `W2` row's **Pre-reads**, **Files**, and
increment order are written against the symbols a `W1` row introduces, and those symbols are named
in that row's pair — which does not exist until its fork returns. Wall clock is the number of waves,
not the number of rows.

A fork that dies, or returns nothing → re-spawn that row. The caller never authors a row itself:
one row, one author, or its two halves stop being written against each other.

**A single row is not a fan-out.** Re-authoring one row's files (§ Iteration), or a ledger holding
one row, is written inline. The fork is for a wave.

## Audience — a context-free Sonnet implementer

No project context, no judgment, no permission to improvise. If the implementer must *infer*
anything — a path, a name, a test command, a decision — the TODO is broken. Rewrite it.

**Self-contained means: the pair plus `CONSTRAINTS.md` is enough.** The implementer reads
`TODO-N.md`, `TODO-N.agent.md`, and the one file the agent half points at, and never opens `spec.md`
or a thought note to know *what* to build. Test the draft by asking: with `spec.md` and `thoughts/`
deleted, could an implementer still write the code and both tests? If not, the TODO is not finished.

**The rules are read, not restated.** `CONSTRAINTS.md` is short — one line per settled decision — so
the implementer reads all of it and obeys the rows that bite. A rule copied into the agent half is
the second copy that drifts, and choosing *which* rows to copy is a judgment the pair's author makes
once and every later reader inherits blind.

**Self-contained is not exhaustive.** The spec's Description, Goal, and target picture are the human
reviewer's context, not the implementer's, and they never appear in a TODO body. Neither does the
discussion behind a rule: that lives in `thoughts/`, and the `trace` skill fetches it when someone
wants to argue with the rule rather than obey it.

## Budget

The human half is ≤ 550 lines; the agent half has no line budget.

`TODO-N.md` at 550 lines is a ceiling, not a nudge. The prose sections — Outcome, New terms,
Components, Autotest, Commit — run to well under a hundred lines on a real row; the rest of the room
is for `## Surface`, which is why the number is this large. Hitting the ceiling therefore means the
contract change itself is too big for one row: split the ledger row. The budget is not the tool for
tightening a wordy Outcome; § Not over-stated in the pre-save checklist is.

`TODO-N.agent.md` is as long as the increments need. Ten increments at their compile floor is a long
file, and a long agent half is not a signal of anything — the size that matters there is the
**increment**, not the file. Never compress a diff, drop a pre-read, or merge two increments to make
the file shorter.

What is counted in the agent half instead of lines: ≤ 10 increments, `n` contiguous from 1, and **no
```diff block at all** — the diff belongs to `## Surface` in the human half. **More than 10 increments
is the real "too big" signal**: it is per-increment, so it does not grow just because a row is
legitimately detailed, and it is what catches an oversized TODO now that no line count does.

In the human half, `## Surface` is capped per file at 150 changed lines (or a declared **Compile
floor**), and the 550-line budget bounds the section as a whole.

**Split the case, not the stack.** A capability over budget is split by *narrowing what it accepts*,
never by *removing a layer*. Narrow it to one input, one format, one type, one path — hardcode what
this row is not about, and name the row that widens it. Every half still reaches the real entry
point, so every half still has a real `E2E`.

Remove a layer instead and both halves stop being capabilities: neither has an entry point, both
write `E2E: none`, and every design gap moves to the last wave — which is the one place a gap is
most expensive to find. **The test of a split: if it turns either half's `E2E` into `none`, it is the
wrong split.** Narrow is not the same as shallow; a thin slice through every layer is the first row,
and later rows widen it.

Which work is a row at all — and why an enabler with one consumer is increment 1 of its consumer
rather than a row of its own — is `ref-write.md` § Merges that fall out of this rule.

> **The budget is counted, not trusted.** The `budget-check` PostToolUse hook (`wm:bin/budget-check.sh`)
> counts every budget on this page — the human half's lines, the agent half's
> increments and diff lines, `CONSTRAINTS.md`'s unresolvable origins, and `spec.md`'s lines — each
> time one of a row's two files, `CONSTRAINTS.md`, or `spec.md` is written, and blocks with the count
> and the split to make. It also rejects a section written into the wrong file, and a `[[note]]`
> origin that resolves to no live note. It runs after the write, because an `Edit` call cannot show the resulting file. A
> ticked checklist row is the author grading their own file; this is the same rule counted. Raising a
> budget is never the fix: the number is the size at which the second deliverable becomes visible.
> Run it by hand: `python3 <plugin>/bin/budget-check.py <file>` (exit 1 = over budget).

## Operating principles

1. **Concrete over abstract.** Real paths, commands, signatures. No "etc.", "as needed".
2. **Strong verbs.** *rename X to Y, add field Z to type T, delete function F* — never *improve, handle, refactor stuff, clean up*.
3. **Every section is a checklist to tick off.** Prose → bullets, a table, or a code block.
4. **One TODO = one deliverable = one commit.** One outcome a user can observe; group the edits that deliver it, nothing else. >8 files → ask before writing.
5. **The surface ships as a diff; the logic ships as a sketch.** Every changed type, field, signature, and setting is a unified diff the implementer applies, never prose it translates. Every body — the code behind those signatures — is pseudocode (the `flow-scetch` skill) the implementer writes from. Neither substitutes for the other, and a body pasted as a diff is the one shape both rules reject (§ A diff carries the surface, not a body).
6. **No outward links** — reference other TODOs only via `Depends on`.
7. **Pre-reads are mandatory** — every file to understand before editing.
8. **New terms are defined, not assumed** — a domain term missing from `GLOSSARY.md` gets a `## New terms` row (see § New terms below).
9. **Components come before changes** — name the `package.Class` set and mark the one holding the main part, then split the work into ordered increments over those components (see § Components, § Changes).
10. **The commit is approved in small increments, not in one read.** `## Changes` is an ordered increment sequence: each increment is one small diff a human approves alone, and each approved increment is appended to the same commit. That approval happens at `impl`, against the real diff — which is why the sequence lives in the agent half and not in the gate read. One TODO stays one deliverable; only its *review* is split (see § Changes).

## File location

`<notes-dir>/todos/TODO-N.md` and `<notes-dir>/todos/TODO-N.agent.md`, `N` 1-indexed and contiguous,
one pair per ledger entry. The rules both halves obey sit outside `todos/`, in
`<notes-dir>/CONSTRAINTS.md`, one file for the whole corpus.
`TODO-N.md` restates that entry's outcome verbatim at the top. Resolve `<notes-dir>` from the active
phase — never hardcode `.notes/`.

## Required elements — in order

Exact keys and headings, this order, in the file named. The filled examples are
[`examples/todo.md`](../examples/todo.md) and [`examples/todo-agent.md`](../examples/todo-agent.md);
the corpus file they point at is [`examples/constraints.md`](../examples/constraints.md). They carry
the artifact and no rules — every rule about a TODO section is on this page, so the two can no
longer drift.

### `TODO-N.md` — the human half

A `---` frontmatter block carries the technicals; the body carries prose only. `TODO-N.agent.md` has
no frontmatter — `status` has one home, and a second copy of it drifts.

| Key | Required |
|-----|----------|
| `status` | always |
| `type` | always |
| `depends_on` | always (`[]` if none) |
| `risk` | always |

| # | Element | Level | Required |
|---|---------|-------|----------|
| 1 | `TODO-N: <title>` | H1 | always — imperative, ≤ 60 chars |
| 2 | `Outcome` | H2 | always |
| 3 | `New terms` | H2 | only if the TODO adds terms missing from GLOSSARY.md |
| 4 | `Components` | H2 | always |
| 5 | `Surface` | H2 | always — the one diff: every symbol the TODO changes, one ```diff per file |
| 6 | `Autotest` | H2 | always — **both** a `Unit` and an `E2E` sub-block |
| 7 | `Commit` | H2 | always — the `Title` and `Body` of the one commit the increments build |
| 8 | `Deviations` | H2 | never at `todo` — written by `impl` when a user correction contradicts a section above, removed by `revise` |
| 9 | `**Increments:** [TODO-N.agent.md](TODO-N.agent.md)` | line | always — the last line, the one link out |

### `TODO-N.agent.md` — the agent half

| # | Element | Level | Required |
|---|---------|-------|----------|
| 1 | `TODO-N — increments` | H1 | always — no title, no frontmatter |
| 2 | `**Design:** [TODO-N.md](TODO-N.md)` | line | always — the first line, the one link back |
| 3 | `Constraints` | H2 | always — first, because it bounds everything below. One line: the pointer at `CONSTRAINTS.md`, never a table (§ Constraints) |
| 4 | `Changes` | H2 | always — an ordered increment sequence, one H3 per increment, **no ```diff anywhere in it** |
| 5 | `Files` | H2 | always |
| 6 | `Pre-reads (MUST read before editing)` | H2 | always |
| 7 | `Manual test` | H2 | always |
| 8 | `Definition of done` | H2 | always |

Missing any always field/element → invalid. A section in the wrong file is also invalid, and the
`budget-check` hook rejects it: `## Changes` or `## Constraints` in the human half, `## Outcome` /
`## Surface` / `## Commit` in the agent half, a rule table under the agent half's `## Constraints`,
or **any ```diff block outside the human half** — each one means the split was not made.

## The verification chain

A correct TODO is self-explanatory: a human approves it by walking seven elements of `TODO-N.md`
alone, repo closed. The agent half stays shut.

**type → Outcome → New terms → Components → Surface → Autotest → Commit**

| Element | Verifies | Link |
|---------|----------|------|
| `type` (frontmatter) | what kind of change — frames the rest | — |
| Outcome | is this the right capability? (the anchor) | — |
| New terms | right vocabulary, consistent with GLOSSARY.md? | grounds Outcome |
| Components | which `package.Class` symbols are created, modified, or deleted, and which one holds the main part? | locates Outcome |
| Surface | what does each of those symbols *become* — the exact types, fields, and signatures a caller will see? | commits Outcome |
| Autotest | do the unit **and** e2e tests prove the Outcome? | verifies Outcome |
| Commit | does the message the increments build toward state the same change the Outcome promised? | closes Outcome |

Outcome is the anchor; Components, Surface, Autotest, and Commit are checked *against* it. Consistent
chain → correct TODO.

**Components and Surface are one pair, and the gate needs both.** Components without Surface approves
a list of names; Surface without Components approves a diff with no stated reach. Read them together:
every Components row's symbol appears in Surface, and every symbol in Surface belongs to a row.

**Two links are checked later, not at the gate**, and both for the same reason — the gate is a design
read, and these two are answerable only against code:

- **`## Constraints`** — do the settled decisions actually bound this slice? The human *made* those
  decisions during the grill, so re-reading them here checks nothing; what matters is whether an
  increment violates one, which `verify` audits against `CONSTRAINTS.md` and the `reviewer` gate
  re-derives from the diff.
- **`## Changes`** — do the increments deliver the Outcome, in an order that builds? The human walks
  it while it is applied, at the grain the spec's `approve` key sets (`impl:sub-impl.md` step 5 and
  its § Approval), where the answer is the
  real diff rather than a prediction. The gate already approved *what the code becomes* in § Surface;
  what is left is the route, and the route is judged against the code it produces.

What `verify` checks before any of that — both sections' shape, and that neither sits in the wrong
half: `code:sub-verify.md` § B.

**The `trace` skill is not a link in the chain — it is what you run to break one.** The chain asks
whether the seven elements agree with each other. A trace answers a different question: whether any
of them *had* to be that way. A reviewer who accepts the Outcome never runs it; a reviewer who wants
to argue with the Outcome, a Components split, a `Surface` shape, or an `E2E: none` runs it against
that anchor and gets back the decision that produced it, cited to the note or document holding the
why. Keeping it out of the chain — and out of the files — is what keeps the gate a design read
instead of a research session.

**Components is where the gate meets the increments.** It is the last human-read link that names
symbols, and it is the map `## Changes` walks: every row is named by at least one increment in the
agent half, and no increment there names a row missing from the table. A human who approves the
Components table has approved the *reach* of the change without reading a diff.

**Commit is the human's last read.** The increments are gone once the commit lands, and this text is
all that stays — the only place the *why* is written for a reader who has just the repo.

## Section rules

> The first four are `TODO-N.md` frontmatter keys (`status`, `type`, `depends_on`, `risk`); the rest
> are body headings. Which half each heading lives in: § Required elements.

### status
The TODO's lifecycle phase — `todo → impl → verify → done`, `blocked` off the path. Machine + who sets each transition: `ref-write.md` § Status. `todo` authors it at `todo` (or `blocked` if a `depends_on` TODO is not yet `done`); never author a TODO straight to `impl`/`done`.

### type
The **change shape**, one of `behavior | state machine | data shape`. It never names a brick — the brick is the **Type** column of the `## Components` row, and it is the brick of the `main` row that picks the sketch shape for a `type: behavior` TODO. The mapping from both to the `## Changes` **Behavior** snippet lives in the `flow-scetch` skill § Variants.

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
- GLOSSARY.md names verbatim. Two to five sentences: the first is the capability, and the rest give a
  reader without context the trigger, the state change, and the failure. Past five, the TODO is too
  big — split it.
- **Banned:** file paths, function/struct names, routes, package names, libraries, "add a field", "wire up".
- Don't restate the spec Goal — scope to *this* TODO's slice.

Good: *"A `User` can issue `RotateToken`; on success the `Session` emits `TokenRotated` and the prior refresh token becomes invalid."*
Bad: *"Add a `/auth/refresh` handler in `pkg/auth/handler.go`"* (paths/infra) · *"Introduce a `RefreshRequest` struct"* (types, not capability).

Pure refactor with no new capability → say so: *"No new capability; reshapes the `Session` aggregate so future `RotateToken` variants share a path."* Still in Terms, not paths.

### New terms
Any domain term not in GLOSSARY.md gets a row here, immediately after Outcome. The row also reaches
GLOSSARY.md, but the pair's author does not put it there — it is returned and the caller merges it
(§ Execution step 3), because one shared table written by a wave of forks loses rows:

```markdown
## New terms

| Term | Kind | Description |
|------|------|-------------|
| TokenJar | entity | Per-user container of active refresh tokens; bounded to 5, LRU-evicted |
```

`Kind` ∈ the GLOSSARY.md set. Description is one sentence with the visible contract (TTL, bounds, error semantics). No new terms → omit the section (never write `## New terms\nnone`).

### Constraints

> The rules live in `<notes-dir>/CONSTRAINTS.md`, one file for the whole corpus. Worked example:
> [`examples/constraints.md`](../examples/constraints.md). The agent half carries the pointer at
> that file and never a rule.

**In `TODO-N.agent.md` — the pointer, and nothing else.** One fixed line, first in the file, above
the increments it bounds:

```markdown
## Constraints

Obey [CONSTRAINTS.md](../CONSTRAINTS.md) — every row.
```

- The line is the same in every TODO. It never lists ids, never quotes a rule, never adds a case.
- The section is **always present**, even when the file is empty today: rules are appended as
  decisions settle, and a TODO that dropped the pointer would be implemented against a stale set.
- A rule *this* TODO's tests can check gets a matching case in the human half's **Autotest** — that
  is the one place a constraint reaches into a single row.

**In `CONSTRAINTS.md` — the rule and its origin.** The caller appends, one row per settled decision
**an increment can violate**, never a fork (§ Execution step 3):

```markdown
| # | Constraint | Origin |
|---|------------|--------|
| R1 | A second refresh on the same token returns 409; never two valid pairs | [[003-decision-single-flight]] |
| R2 | Refresh tokens expire 15 minutes after issue | [[002-fact-token-ttl]] |
```

- One sentence per row, imperative or invariant — what the code must do, not what was debated. No
  trade-off prose and no rejected alternatives: those stay in the origin note.
- `#` is `R<n>`, 1-indexed, contiguous, unique in the file, and **append-only**. Renumbering
  silently repoints every reader at a different rule.
- One row per decision. A decision already in the file is not appended again because a second TODO
  also obeys it — that repetition is the whole thing this file removes.
- `Origin` is a live `[[note]]` in `thoughts/`, or a document with its section and read date. A rule
  with no recorded origin is a rule nobody can argue with: write the note first, then append.
- A decision no increment anywhere can violate is not a constraint. It is a fact, and it stays in
  `thoughts/` where the `trace` skill can find it.

### Components

The `package.Class` set this TODO touches, one row each, **main part first**. Every row says what the
TODO does to that symbol (**Touch**) and what the symbol does for the Outcome (**Role**), so a human
reads the create/modify/delete list *instead of* any diff — this table is the whole reach of the
change, stated for a reader who never opens the agent half. It is also the map `## Changes` walks:
every row is named by at least one increment there, and no increment there names a component missing
from this table.

```markdown
## Components

| Component | Touch | Type | Part | Role |
|-----------|-------|------|------|------|
| `pkg/auth.Handler` | modify | server | main | Accepts the rotation request and returns the new pair |
| `pkg/auth.TokenJar` | create | service | supporting | Holds one user's active refresh tokens |
| `pkg/redis.SessionGateway` | modify | gateway | supporting | Stores and deletes the session key |
```

- **Component** — `package.Class` in the project's own notation (`pkg/auth.Handler`, `auth.SessionStore`,
  `blocks/upload/model.UploadState`). A symbol, never a bare file path — paths live in **Files**.
- **Touch** — what this TODO does to the symbol: `create | modify | delete`. It types the symbol, not
  the file: a `create` component may land in a file **Files** marks `modify`, and a `modify` component
  may need a new file. A component this TODO only reads is not touched — it belongs in **Pre-reads**,
  not here. A table whose rows are all `create` is a greenfield slice; one with a `delete` row names
  the replacement row in the same table or the TODO that already shipped it.
- **Type** — the **brick**: one of `command | service | flow | gateway | server | consumer | policy |
  scheduler | wiring`. The roster, with the metric and the common structure of each, is the `arch` skill.
  A component that fits no brick, or fits two, owns more than one responsibility — split it before
  writing the body.
- **Part** — `main` or `supporting`. **Exactly one row is `main`**: the component that carries the
  Outcome's behavior. Two candidates for `main` → the TODO does two things, split it.
- **Role** — one sentence, this TODO's slice of the component's job. Not the component's full purpose.
- Every row maps to at least one path in the agent half's **Files**, and every non-test path there belongs to a row.

### Surface

> Lives in `TODO-N.md`, the human half. The one diff in the pair.

**The whole contract change this TODO makes, written once.** One bullet naming a file, then one
```diff for that file, deepest-first — the same order the increments apply. Every file with a surface
appears; a file that has none carries a plain-fenced contract block instead (below).

**Surface** means what a caller of the changed code can see: types, fields, method and function
signatures, and settings — config keys, flags, defaults — with their real values. New surface is
all-`+` in real syntax, and no field or signature is ever elided.

**Why the human half.** This is the artifact a reviewer approves before any code exists: Components
says *which* symbols move, Surface says *what they become*. Approving one without the other approves
a rename. It is also why the human half's budget is 550 lines rather than a hundred — the diff needs
the room.

**No comments, and no `AGENT:` markers.** A decision that seems to want a comment belongs in a
`thoughts/` note and, restated, in the agent half's `## Constraints`. The implementer writes whatever
comments `CODE_STYLE.md` asks for; a comment predicted here is one they would rewrite.

**A file whose whole content is a body has no surface.** A check script, a migration, a test file, a
generated query: it carries a plain fenced block — invocation, arguments, exit codes, output — not a
```diff. There is no before/after to show, only a contract.

**Sizing.** ≤ 150 changed lines per file. Over that, first check for a body (§ A diff carries the
surface, not a body) — deleting one usually takes the file under on its own. If every line is real
surface and the file still cannot compile below the budget, keep it and add a `**Compile floor:**`
bullet under that diff saying why. The whole section is bounded by the 550-line human budget, and a
Surface that fills it is a ledger row holding two deliverables.

#### A diff carries the surface, not a body

A **body** is anything whose content *is* the implementation: a function or method body, a loop, a
branch chain, a shell script, a SQL query, a regex, a fixture, a table of literal expected values, a
test file's assertions. None of it goes in a `## Surface` diff, and the reason is not length — it is
that a body written here is written twice. The implementer either copies it, in which case the review
happened against a paste; or improves it, in which case the TODO is wrong from the first commit.

**The default is absolute: never put a function body in the diff.** Not to show intent, not because
the body is short, not because it "clarifies" the signature. Show the signature; put the logic in the
increment's **Behavior** sketch, where it is pseudocode nobody can copy.

**The one exception is a human asking for it directly.** When the human explicitly says they want a
body written out for a specific symbol, write it — and mark it, so the next reader can tell an
approved body from a smuggled one:

```
- **Body requested:** `Refresh` — the human asked for the full body on 2026-08-21.
```

That marker sits under the file's diff in `## Surface`. It is the only thing that makes a body legal,
it names the symbol it covers, and it covers nothing else. Absent the marker, a body is a finding —
`verify` reports it and the `budget-check` hook cannot see it, which is why the marker is explicit
rather than inferred. Never add the marker on your own judgment: the human asks, or there is no body.

**The test: could the implementer type this from the sketch?** If yes, the sketch is enough and the
body is noise. `stat -f%z` vs `stat -c%s`, `set -euo pipefail`, the exact `jq` filter, the real
`$REPO` paths, the literal byte counts — every one of those is a choice the implementer makes while
looking at the actual repo, and none is a choice a human approves at the gate.

**A command someone runs is not a body.** The rule is about code that ships in the repo, so it never
reaches a literal invocation: the Autotest **Command**, a **Manual test** step, the arguments in a
contract block. Those are required to be literal — `make run-dev`, `go test ./pkg/auth/...`, the exact
`curl` — because a human or CI types them verbatim and an approximation is useless. The line is
whether the text becomes a file in the repo or gets typed at a prompt.

**When the whole deliverable is a body** — a check script, a migration, a test file, a generated
query — the file has no surface at all. `## Surface` carries its contract as a plain fenced block (how
it is invoked, what it takes, what it exits with, what it prints), and the increment that builds it
carries `Surface: none` plus a **Behavior** sketch naming the checks in order and, above all, **the
edge cases**: the state that must not be reached, the second run that must not refetch, the env var
that must be unset, the count that must match. The edge cases are the part a human can only get from
this file; the mechanics are the part they can only get from the repo.

Worked example of exactly this shape: `examples/todo.md` § Surface (the `scripts/release-check.sh` block)
and `examples/todo-agent.md` § increment 4.

### Changes

> Lives in `TODO-N.agent.md`, and only there. **It carries no diff** — not one ```diff block, not a
> pasted signature. The diff is `TODO-N.md` § Surface, written once.

**An ordered sequence of increments — what to do, in apply order.** One TODO is still one deliverable
and one commit; `## Changes` splits only its *execution*, so the implementer lands a small, verifiable
piece at a time and the human approves each real diff as it appears.

**Increment** = the smallest step worth approving on its own. `### <n>. <imperative title> — `<package.Class>``,
`n` 1-indexed and contiguous. Each increment names exactly one row from `TODO-N.md` `## Components`; a
component may span several increments.

Each increment carries these bullets, in order:

| Bullet | Required | Content |
|--------|----------|---------|
| **Files** | always | the repo-relative paths this increment alone touches — a subset of `## Files` |
| **Surface** | always | which part of `TODO-N.md` § Surface this increment lands, named by symbol — or `none` when it adds no surface (a body-only file, a wiring change) |
| **Do** | always | one to four imperative sentences: the work, in words. What to write, what to migrate, what to delete. **No code, no fenced block, no pasted signature** |
| **Blast radius** | always | the **predicted** reach: the symbols, callers, and consumers a mistake here forces you to retest. Name them; `"low"` is not a blast radius |
| **Behavior** | only where **Do** cannot carry the logic — a real branch structure, an error path that matters, a non-obvious ordering | TS pseudocode per the `flow-scetch` skill, ≤ 40 lines, side effects + error paths visible |
| **Builds** | only when the increment leaves the repo not compiling | `builds: only with increment <n>` |

**Do is prose, and that is the point.** The signature is in § Surface; what an increment adds is the
*instruction* — which call sites to migrate, what order to touch things in, what to delete. A **Do**
that pastes the signature back has put one fact in two files. A **Do** that says "implement the
handler" has said nothing: name the work.

**Every signature change names its call sites in some increment's Do.** A widened signature whose
callers appear in no **Do** is a caller that will be left broken, and § Surface cannot catch it —
Surface shows the new shape, not who has to move to it.

**Ordering — deepest first.** Order increments so the repo builds after each one: the callee before
its caller, the type before its user, the wiring last (same rule as **layer (Ln)**). An increment
that cannot leave the repo compiling says `builds: only with increment <n>`, and that is a last
resort — prefer an order where every step builds.

**Sizing.** > 10 increments → the TODO is too big, split the ledger row. An increment whose **Do** is
one sentence is fine; small is the point. Counted by the `budget-check` hook (§ Budget), along with a
hard rejection of any ```diff block in this file.

> On save the `format-todo` PostToolUse hook (`bin/format-todo.sh`) runs prettier over each ```ts block; unparseable pseudocode is left verbatim. Don't hand-align the block — write it, the hook formats it.

````markdown
### 2. Return a pair from the minter — `pkg/auth.TokenMinter`

- **Files:** `pkg/auth/token.go`
- **Surface:** `mintTokens`
- **Do:** Widen `mintTokens` to the § Surface signature. Mint the refresh token alongside the access token and return both; propagate either signing error unchanged. Migrate both call sites to the new return.
- **Blast radius:** every caller of `mintTokens` — `pkg/auth/handler.go`, `pkg/auth/login.go`
````

**How the increments reach the commit** (executed by `impl:sub-impl.md`, stated here so the human knows
what an approval buys): increment 1 creates the commit; each later approved increment is appended to
that same commit (`git commit --amend --no-edit`), except an increment that corrects work the human
rejected — that one lands as a fixup (`impl:sub-commit.md` § Fixups). The final message is
`TODO-N.md` `## Commit`. A rejected increment stops the TODO — nothing after it is applied.

### Autotest

> Lives in `TODO-N.md`, the human half — it is a link in the verification chain, not scaffolding. What
> the change *proves* is a design question the reviewer answers at the gate: a capability nobody can
> assert is a capability nobody agreed to. The **Target files** and the **Command** are here for the
> same reason the cases are — they say which suite carries the proof, not how to write it.

**Two levels, both required: `Unit` and `E2E`.** One TODO ships the behavior *and* the proof at both
scales — that is what makes it self-contained. Neither level is optional by default.

| Level | Proves | Scope |
|-------|--------|-------|
| `Unit` | the changed unit behaves, in isolation | the new/edited function, type, or component; no network, no DB, no process boundary |
| `E2E` | the **Outcome** holds through the real entry point | the request/command enters where a user or caller enters it and the observable result is asserted |

Each level carries, on its own bullets:
- **Target files** — the test file path (`create` if new).
- **Entry point** — `E2E` only: where the request or command enters, named as a caller enters it
  (`POST /auth/refresh` on the running server), so each case asserts the Outcome as an observer sees
  it rather than as the implementation sees it.
- **Cases** — one-sentence `input → expected` bullets; each traces to the Outcome or to a `CONSTRAINTS.md` row this TODO can violate. Derive the minimal-but-covering set via `test` (pairwise tiering).
- **Command** — one runnable shell command. Never "run the relevant tests".

**Cases, never the test.** This section is the only place a test appears in the pair, and it appears
as sentences. No assertion source, no fixture, no table of literal expected values, no shell — a test
file's body is a body, and § A diff carries the surface, not a body applies to it in full. A test
worth writing out here is a test the implementer would have written from the case; a test that
*cannot* be written from the case means the case is too vague, and the fix is a sharper sentence, not
a paste. When the test file itself is the deliverable, it is an increment with an **Interface** and a
**Behavior** sketch in the agent half — never source in this table.

A level that genuinely cannot exist is written `none — <one-line concrete reason>`; the reason names
what makes it impossible, not that it feels redundant. Auto-reject: "covered by the unit test",
"trivial", "no e2e harness" (name the missing harness and add a TODO for it instead). A pure refactor
with no behavior change may set `E2E: none — no observable behavior changes; unit suite pins the
reshaped API`, but only when the Outcome itself claims no new capability.

For a TODO whose Outcome is not observable end-to-end alone, the `E2E` level names the wave-mate or
later TODO whose e2e test covers it: `none — observable only via TODO-3; its E2E case asserts this
path`. That is the one shape where an e2e gap is legal, and three things bind it:

- **The named TODO must exist in the ledger**, and its `## Autotest` `E2E` must carry a **case that
  asserts this path**. A deferral to a TODO whose E2E never mentions it is not a deferral — it is an
  untested path with a citation.
- **Deferring to a Manual test does not count.** `Manual test` catches what no suite can see; it is
  not the automated cover this level is claiming.
- **The shape is rare, because most of its old users are no longer rows.** An enabler with one
  consumer is increment 1 of that consumer (`ref-write.md` § Merges that fall out of this rule), so
  it has no `E2E` of its own to defer. What is left is the genuinely separate row: another repo, or
  an interface with two or more consumers.

### Commit

**The message of the one commit `## Changes` builds, written here in full and copied — never
re-derived at commit time.** Two fields, both human-read: `Title` and `Body`.

- **Title** — the exact line the implementer commits: `<prefix>: <line>`, ≤ 72 chars, imperative, no
  period. Prefix from the standard set. The ledger entry's `Commit` is this line.
- **Body** — cause, goal, and the decision if a live alternative was rejected, one paragraph each in
  that order. Cause and goal expand the ledger entry's `Why`; the decision comes from the notes
  `## Constraints` cites. Full contract: the `commit-message` skill.

**Write the body for a reader who has only the repo.** No `TODO-N`, no note id, no ticket — the
increments above are gone once the commit lands, and this text is all that stays. A body that could
only be written by someone holding the TODO is the wrong body.

**Check it against the Outcome before any increment is applied.** Same change, stated twice for two
audiences: the Outcome in the actor's terms, the title in the repo's. A capability in one and not the
other means the TODO is wrong — fix it at `todo`, not at commit time. When to commit and what a user
correction lands as: `impl:sub-commit.md`.

### Deviations

**Not yours to write.** `todo` never creates this section; the pair leaves the gate with sections
2–7 and nothing after them. `impl` appends it when the user corrects a shown diff into something a
section above forbids, and only when the correction stays inside this TODO — the fork and its blast
radius test: `impl:sub-impl.md` § When a correction contradicts the pair. `revise` folds every row
into the section it names and deletes the whole block.

Read it as a reader of the pair: the approved text above still says what the human approved, and
this table says where the shipped code went elsewhere and which note holds the reason. One row per
correction, four columns:

- **What** — the section and the symbol, id, or case the correction contradicts: `## Surface: Refresh`,
  `## Autotest Unit: case 3`, `## Outcome`.
- **Shipped instead** — the shape or behavior that actually landed, one line.
- **Why** — the reason the approved version lost, one line.
- **Note** — the `[[NNN-impl-decision-slug]]` holding the full reasoning.

A correction that reaches past this TODO — another TODO's symbol, a ledger row, a settled `decision`
note — is not a deviation: it routes to `revise`.

Worked example: [`examples/todo.md`](../examples/todo.md) § Deviations.

### Manual test
Required even when Autotest covers the behavior — catches integration / UX the suite can't see. `Steps` (literal commands) and `Expected` aligned 1:1. `Skip?` defaults to `no`; to skip, `skip — reason: <specific>`. Keep only cases a test can't prove (UX feel, log shape, real third-party behavior).

### Definition of done
Checklist the implementer ticks before advancing `status` to `verify` and filling the ledger's Commit: Files, Autotest, Manual test, scope discipline, Commit title. Add items only for unusual post-conditions (e.g. "migration applied on staging"). It sits in the agent half, so its Files row points at a section in the same file and its constraints row points at `CONSTRAINTS.md`; the one row it cannot restate is the Commit message, which it cites in the human half by name.

## Implementation decisions

Choices the spec didn't make — file naming, package structure, error strategy, data shape — are
**impl-decisions**. Write each to `thoughts/` before the next section, taking `NNN` from the number
block this row was assigned (§ Execution step 2) — never the next free number, which a wave-mate is
taking at the same moment. Template + when-to-write:
[`examples/note-impl-decision.md`](../examples/note-impl-decision.md).

**Nothing in the pair links to the note.** The pair states the choice as settled fact; the note
holds why it was the choice. The edge from one to the other is walked, not stored — the `trace`
skill searches `thoughts/` from the artifact's own words, which is why every impl-decision note
carries a `description` that states its answer and a `todo:` key naming the row it was written for
(`arch:ref-note-format.md`). A note with a vague description is a note the search cannot return.

## Iteration

Edit in place, same `N` unless order changes — then renumber both halves together and update the ledger. A TODO already `status: done` → don't bump; make a new one.

## Pre-save checklist

### The row

- [ ] Both files exist for this `N` — `TODO-N.md` and `TODO-N.agent.md`, written in the same pass
- [ ] `TODO-N.md` ends with `**Increments:** [TODO-N.agent.md](TODO-N.agent.md)`; `TODO-N.agent.md` opens with `**Design:** [TODO-N.md](TODO-N.md)`
- [ ] Nothing is in two files: no path or increment in the human half; no `Outcome`, `Surface`, `Autotest`, `Commit`, title, or `status` in the agent half; **no rule text and no origin link in either** — both live in `CONSTRAINTS.md`
- [ ] **The agent half contains not one ```diff block.** The diff exists once, in the human half's `## Surface`
- [ ] `TODO-N.agent.md` has no frontmatter — `status` lives only in `TODO-N.md`

### `TODO-N.md` — the human half

- [ ] All `always` elements present and ordered; `New terms` present iff the TODO adds terms
- [ ] **Not over-stated**: no spec Description/Goal/target-picture prose was copied in, and the Outcome is this TODO's slice rather than the spec Goal
- [ ] ≤ 550 lines — over budget means two deliverables, so split the ledger row; it is not a signal to compress prose. Counted by the `budget-check` hook (§ Budget), so a tick that disagrees with the count loses
- [ ] **Outcome** is a capability in GLOSSARY.md terms — no paths, types, routes, libraries
- [ ] `## Components` has exactly one `main` row, each a `package.Class` symbol with a `create | modify | delete` **Touch** and a one-sentence **Role**
- [ ] `## Surface` carries one ```diff per file (or a plain contract block for a file that is all body), deepest-first, ≤ 150 changed lines per file or a declared **Compile floor**
- [ ] **No body in `## Surface`** — no function body, loop, branch chain, shell script, query, regex, fixture, or literal expected-value table; no comments and no `AGENT:` markers. The sole exception is a body the human asked for directly, carrying a `**Body requested:**` bullet that names the symbol
- [ ] Every `## Components` row's symbol appears in `## Surface`, and every symbol in `## Surface` belongs to a Components row
- [ ] **Autotest** has both a `Unit` and an `E2E` sub-block, each with Target files + Cases + one runnable Command — or `none — <concrete reason>`
- [ ] Every Autotest case is a sentence — no assertion source, no fixture, no shell, no table of literal expected values
- [ ] An `E2E: none` that defers names a TODO that **exists in the ledger** and whose own `E2E` carries a case asserting this path; a deferral to a `Manual test` does not count
- [ ] **No `## Deviations`** — that section belongs to `impl`, and one present at `todo` means a correction was written as design
- [ ] `Commit.Title` ≤ 72 chars, imperative, prefixed; `Commit.Body` has a cause and a goal paragraph (plus a decision if one was rejected), names no `TODO-N` or note id, and states the same change as the **Outcome**

### `TODO-N.agent.md` — the agent half

- [ ] **Self-contained**: with `spec.md` and `thoughts/` deleted, the pair plus `CONSTRAINTS.md` still says what to build and what to assert
- [ ] `## Constraints` is present, above `## Changes`, and is the fixed pointer line and nothing else — no table, no id list, no quoted rule
- [ ] Every rule this TODO's increments can violate is a row in `CONSTRAINTS.md` with an origin, and every such row a test can check has a matching case in the human half's `## Autotest`
- [ ] `## Changes` is an ordered increment sequence — `n` contiguous from 1, ≤ 10 increments, each naming one `TODO-N.md` **Components** row, ordered deepest-first so the repo builds after each (or marked `builds: only with increment <n>`)
- [ ] Every increment carries **Files** (a subset of `## Files`), a **Surface** bullet naming the symbols it lands (or `none`), a **Do** of one to four imperative sentences, and a **Blast radius** that names the real symbols/callers to retest
- [ ] **No code in any Do** — no fenced block, no pasted signature. The signature is in `## Surface`; **Do** is the instruction, and "implement the handler" is not one
- [ ] Every symbol whose signature changes in `## Surface` has its call sites named in some increment's **Do** — a widened signature with no migration instruction is a caller left broken
- [ ] Every increment's **Surface** bullet names symbols that actually appear in `TODO-N.md` `## Surface`, and every symbol there is landed by some increment
- [ ] A **Behavior** sketch appears wherever **Do** cannot carry the logic (a real branch structure, an error path that matters, a non-obvious ordering) — ≤ 40 lines of pseudocode, no real imports or paths
- [ ] Every **Components** row is named by at least one increment, and no increment names a component missing from that table
- [ ] Every `create` row's symbol appears as new surface in a `## Changes` diff or **Interface**, and every `delete` row's symbol is gone from the code the diffs leave behind — a Touch the diffs contradict is a wrong Touch
- [ ] Every **Files** / **Pre-reads** path exists (or is marked `create`); every non-test **Files** path maps to a **Components** row
- [ ] **Manual test** Steps/Expected aligned 1:1

### The ledger

- [ ] Matching ledger row exists in `spec.md`, and the TODO sits in exactly one `## Plan` wave whose members' **Files** sets are disjoint from this one's

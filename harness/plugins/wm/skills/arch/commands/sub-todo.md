# code — todo (TODO bodies)

Authors the `todos/TODO-N.md` + `todos/TODO-N.agent.md` **pair** from a reviewed `spec.md` +
`thoughts/`, and appends the settled decisions it finds to `<notes-dir>/CONSTRAINTS.md`. Owns the
TODO element list, the **verification chain**, and the **outcome** rules.

**Open the filled examples first** — [`examples/todo.md`](../examples/todo.md) (human half) and
[`examples/todo-agent.md`](../examples/todo-agent.md) (agent half), plus the corpus file they point
at, [`examples/constraints.md`](../examples/constraints.md). They are the artifact you are
producing; this page is the rules that govern it, and `references/ref-todo-sections.md` is what
goes inside each heading. Reading the shape before the rules is how you tell which rule is
load-bearing.

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
   Follow ${CLAUDE_PLUGIN_ROOT}/skills/arch/commands/sub-todo.md and the section rules it points
   at (references/ref-todo-sections.md) in full — you are past the gate.
   Write exactly two files: <notes-dir>/todos/TODO-N.md and <notes-dir>/todos/TODO-N.agent.md.
   Impl-decision notes: take thoughts/ numbers <lo>-<hi>, no others.
   Write nothing else — not spec.md, not GLOSSARY.md, not CONSTRAINTS.md, not another row's files.
   Return, and only this: your `## New terms` rows (or `none`), your `## Files` paths, the
   impl-decision notes you wrote, every settled decision an increment of this row can violate that
   CONSTRAINTS.md does not already carry — the rule and its origin — and any contradiction in the
   row you could not resolve.
   Do not summarize the files — the caller reads them.")
```

The `budget-check` hook fires inside the fork, where the write happens (§ Budget). It warns; the
count that fails is `code:sub-verify.md` Phase 0, over the finished corpus.

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
> time one of a row's two files, `CONSTRAINTS.md`, or `spec.md` is written, and **warns** with the
> count and the split to make. It also names a section written into the wrong file, and a `[[note]]`
> origin that resolves to no live note. It runs after the write, because an `Edit` call cannot show the resulting file. A
> ticked checklist row is the author grading their own file; this is the same rule counted. Raising a
> budget is never the fix: the number is the size at which the second deliverable becomes visible.
>
> It warns rather than blocks because a pair is written over several calls, and a file counted
> between two of them is over budget for a reason the next write removes. The count that **fails** is
> `code:sub-verify.md` Phase 0, over the finished corpus. Run that one by hand:
> `<plugin>/bin/budget-sweep.sh <notes-dir>` (exit 1 = over budget), or one file with
> `python3 <plugin>/bin/budget-check.py <file>`.

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

Exact keys and headings, this order, in the file named. The examples above carry the artifact and
no rules — every rule about a TODO section is written once, so the two can never drift.

### `TODO-N.md` — the human half

A `---` frontmatter block carries the technicals; the body carries prose only. `TODO-N.agent.md` has
no frontmatter — `status` has one home, and a second copy of it drifts.

| Key | Required |
|-----|----------|
| `status` | always |
| `type` | always |
| `depends_on` | always (`[]` if none) |
| `risk` | always |
| `approve` | always (`inherit` unless this TODO needs its own depth — `arch:ref-write.md` § Approval) |

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
`budget-check` hook reports it: `## Changes` or `## Constraints` in the human half, `## Outcome` /
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
  it while it is applied, at the grain the `approve` key sets (`impl:sub-impl.md` step 5 and
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

What goes inside each heading — one entry per section, frontmatter keys first — is
@../references/ref-todo-sections.md. A fork authoring a pair reads it; the caller running the
fan-out does not.

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

**The hook counts the mechanical rules; this checklist holds only what a reader must judge.**
`budget-check` (§ Budget) already counts the line budgets, every misplaced section, a ```diff or a
frontmatter block outside the human half, a rule table under `## Constraints`, the increment count
and contiguity, and a missing **Do** bullet. Ticking those here would be the author grading their
own file against a rule already counted.

### The row

- [ ] Both files exist for this `N`, written in the same pass, `TODO-N.md` ending with its
      `**Increments:**` link and `TODO-N.agent.md` opening with its `**Design:**` link
- [ ] **No rule text and no origin link in either half** — both live in `CONSTRAINTS.md`

### `TODO-N.md` — the human half

- [ ] All `always` elements present and ordered; `New terms` present iff the TODO adds terms
- [ ] **`approve` is `inherit`** unless this TODO needs a depth of its own — and any other value carries, as a trailing comment, the reason it overrides the spec
- [ ] **Not over-stated**: no spec Description/Goal/target-picture prose was copied in, and the Outcome is this TODO's slice rather than the spec Goal
- [ ] **Outcome** is a capability in GLOSSARY.md terms — no paths, types, routes, libraries
- [ ] `## Components` has exactly one `main` row, each a `package.Class` symbol with a `create | modify | delete` **Touch** and a one-sentence **Role**
- [ ] `## Surface` carries one ```diff per file, deepest-first — or a plain contract block for a file that is all body
- [ ] **No body in `## Surface`** — no function body, loop, branch chain, shell script, query, regex, fixture, or literal expected-value table; no comments and no `AGENT:` markers. The sole exception is a body the human asked for directly, carrying a `**Body requested:**` bullet that names the symbol
- [ ] Every `## Components` row's symbol appears in `## Surface`, and every symbol in `## Surface` belongs to a Components row
- [ ] **No consequence in `## Surface`** — no file whose diff is already fixed by another entry (a migrated call site, an updated import, a forwarded field, a renamed use). It lives in the agent half's **Files**, the deciding increment's **Do**, and its **Blast radius**
- [ ] **Autotest** has both a `Unit` and an `E2E` sub-block, each with Target files + Cases + one runnable Command — or `none — <concrete reason>`
- [ ] Every Autotest case is a sentence — no assertion source, no fixture, no shell, no table of literal expected values
- [ ] An `E2E: none` that defers names a TODO that **exists in the ledger** and whose own `E2E` carries a case asserting this path; a deferral to a `Manual test` does not count
- [ ] **No `## Deviations`** — that section belongs to `impl`, and one present at `todo` means a correction was written as design
- [ ] `Commit.Title` ≤ 72 chars, imperative, prefixed; `Commit.Body` has a cause and a goal paragraph (plus a decision if one was rejected), names no `TODO-N` or note id, and states the same change as the **Outcome**

### `TODO-N.agent.md` — the agent half

- [ ] **Self-contained**: with `spec.md` and `thoughts/` deleted, the pair plus `CONSTRAINTS.md` still says what to build and what to assert
- [ ] Every rule this TODO's increments can violate is a row in `CONSTRAINTS.md` with an origin, and every such row a test can check has a matching case in the human half's `## Autotest`
- [ ] Each increment names one `TODO-N.md` **Components** row, ordered deepest-first so the repo builds after each (or marked `builds: only with increment <n>`)
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

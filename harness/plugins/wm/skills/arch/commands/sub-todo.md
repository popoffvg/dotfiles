# code — todo (TODO bodies)

Authors the `todos/TODO-N.md` + `todos/TODO-N.agent.md` **pair**, plus the `todos/TODO-N.test.md`
test file, from a reviewed `spec.md` + `thoughts/`. Owns the TODO element list, the **verification chain**, and the **outcome** rules.

**Two stages, with a human gate between them** (§ Execution): no agent half exists before the human
approves the row's `TODO-N.md`, `TODO-N.test.md`, and `GLOSSARY.md` entries.

**Open the filled examples first** — [`examples/todo.md`](../examples/todo.md) (human half),
[`examples/todo-agent.md`](../examples/todo-agent.md) (agent half), and
[`examples/todo-test.md`](../examples/todo-test.md) (test file). They are the artifact you are
producing, and each carries the rules for every section as a `>` block under the heading it governs.
The rule set that bounds them is printed, not written: run
`~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts`.
This page is the procedure that produces them; `references/ref-todo-sections.md` is what cuts across
the sections. Reading the shape before the rules is how you tell which rule is load-bearing.

Spec contract + the gate: `ref-write.md`. Vocabulary: `wm:GLOSSARY.md`.

## One ledger row, three files

| File | Read by | Holds | Length |
|------|---------|-------------|--------|
| `TODO-N.md` | the human, repo closed | frontmatter, Outcome, New terms, Components, **Increments (the work and its diff)**, **Flow changes**, Commit | ≤ 550 lines, New terms + Components uncounted |
| `TODO-N.test.md` | the human at the gate, then the implementer and the gates | Autotest — Unit and E2E | **unlimited** |
| `TODO-N.agent.md` | the implementer | Files (each path keyed to its increments), Pre-reads, Manual test, Gotchas | **unlimited** |

The split is by audience, not by size. `TODO-N.md` is the design a human approves — what the system
will be able to do, which symbols move, **the steps that move them and what each symbol becomes**,
**which running paths gain or lose a step or a check**, and what the commit says. `TODO-N.test.md`
is what proves it: the human approves it at the same gate, and it has its own file so that no budget
cuts a case. `TODO-N.agent.md` is where the work happens in the repo: the paths, the reading list,
the manual check, and the rules that bound it.

**The increments are the human's, and each one is self-contained for review.** `## Increments` in the
human half carries the whole contract change, cut into the steps `impl` applies. Each step carries
its own diff, its **Do**, and its blast radius, so a reviewer approves one step from its block alone —
at the gate, and again at `impl` against the real diff. No increment names a file: paths live once,
in the agent half's `## Files`, keyed by increment number. The agent half carries no diff and no
increment text.

**No TODO carries a constraint, and none carries an origin.** A settled decision lives once, as its
`thoughts/` note, and the rule set is generated from those notes on demand —
`~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts` (`ref-todo-sections.md` § Constraints).
No pair file carries a rule or the command; `todos/CLAUDE.md` § Read order names the command once. The *why* behind a rule is not stored in
`todos/` either: the `trace` skill walks to it on demand. A copy of a rule in twenty TODOs is twenty
rules to change when the decision changes; a stored origin link is a link that rots the moment a
note is superseded.

**The human half is written for an ADHD reader.** Every prose line of `TODO-N.md` obeys the
`i-have-adhd` skill — load it before writing the half, not after. The person approving a TODO reads it
once, and a sentence that needs a second pass costs them the decision. The agent half is read by an
implementer and is not bound by it.

**Each pair field has one home.** The title, `status`, Outcome, and increments live in `TODO-N.md`;
paths and pre-reads live in `TODO-N.agent.md`. The ledger outcome is the sole derived copy:
it appears verbatim as the TODO Outcome. Autotest lives in `TODO-N.test.md` alone. `TODO-N.md` ends
with one link to each other file, and each other file opens with one link back.

**The row is atomic after stage 2.** All three files are deleted or renumbered together. A row
without its agent half cannot be implemented or verified.
An agent half is written only for a row the human approved in Step 5.

## Precondition — past the gate

Run `todo` only after a human has reviewed the spec (`ref-write.md` § Stop at the gate). `new` stops before
this deliberately. Before authoring: `spec.md` frontmatter `status: review`, **no `status: open` question
note and no `status: proposed` decision in `thoughts/`** (`~/.claude/scripts/wm-open-questions.sh
<notes-dir>/thoughts` and `~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts --check` both exit 0),
ledger settled, and the human has asked for TODOs. Otherwise stop and run `/code new` first.

## Execution — two stages, one fork per ledger row, wave by wave

| Stage | Writes | Ends with |
|---|---|---|
| 1 — design | `TODO-N.md` (increments included, `increment: 0/<total>`), `TODO-N.test.md`, then the caller's `GLOSSARY.md` merge | the human gate (Step 5) |
| 2 — paths | `TODO-N.agent.md` | the pre-save checklist |

**Where to start.** A row with no `TODO-N.md` starts at stage 1. A row with `TODO-N.md` and no
`TODO-N.agent.md` is waiting at the gate: run Step 5 again before stage 2. Approval in an earlier
session does not count — no file records it. A row with all three files is past stage 2: change it
under § Iteration. A row with `TODO-N.test.md` or `TODO-N.agent.md` but no `TODO-N.md` is
broken: delete its files, then start it at stage 1.

`todo` authors every row in the ledger, and the ledger already says which rows are independent:
`new` compiled the `## Plan` wave table, and a wave is by definition a set of rows with no edge
between them. Author a wave **in parallel — one fork per row**. The run then costs one round trip
per wave instead of one per TODO.

**Why a fork and not a fresh agent.** A fork starts from this conversation, so the corpus is read
once by the caller and inherited by every row: `spec.md`, the `thoughts/` graph, `GLOSSARY.md`, and
the grill that settled them. A `general-purpose` agent would re-read the corpus once per row and
still arrive without the grill — and the grill is where the decisions that become the rules were
made. A fork also inherits the caller's model (`model:` is ignored on a fork),
which is the right one here: cutting `## Increments` is design, not extraction.

**The unit is the row's stage, never one file of it.** A stage-1 fork writes `TODO-N.md` **and**
`TODO-N.test.md` — the cases prove the Outcome and the marked flow steps, so they are written
against them. A stage-2 fork writes `TODO-N.agent.md` against the approved `TODO-N.md`: it finds the
paths behind each approved increment, and the increments are fixed before the paths are looked up.

### Step 1 — read the corpus once (caller)

`spec.md` (ledger + wave table), the `thoughts/` graph, `GLOSSARY.md`. Everything read here is
inherited by every fork; everything skipped here is re-read N times or missed N times.

Enter `thoughts/` through the index, never by reading the directory: run
`~/.claude/scripts/wm-thought-index.py <notes-dir>/thoughts`, read every note's `description`, and
open in full the notes that bear on the rows in this run's waves (`arch:ref-note-format.md` §
Finding the thought for your task). The descriptions are the map the forks inherit — a note whose
description shows it bears on no row in the wave costs nothing to leave closed.

**Done when** you can name, for each row in the run, the notes that bear on it.

### Step 2 — stage 1: fan out the wave (caller)

One fork per row in the current wave, **all `Agent` calls in one assistant message** — calls in
separate messages run serially, not in parallel. Each prompt names the row and its number block and
nothing more; the context is already there. A number block is 10 numbers; the first block starts after the
highest `NNN` in `thoughts/`, and the blocks of one run never overlap. Stage 2 hands out new blocks
the same way.

```
Agent(subagent_type="fork", prompt=
  "[TODO-N stage 1] Author the design for ledger row N: <the row's outcome, verbatim>.
   Follow ${CLAUDE_PLUGIN_ROOT}/skills/arch/commands/sub-todo.md, the `>` rule blocks in
   examples/todo.md and examples/todo-test.md, and references/ref-todo-sections.md in full — you
   are past the spec gate, before the TODO gate.
   Write exactly two files: <notes-dir>/todos/TODO-N.md (with `increment: 0/<total>`) and
   TODO-N.test.md.
   Impl-decision notes: take thoughts/ numbers <lo>-<hi>, no others.
   Write nothing else — not TODO-N.agent.md, not spec.md, not GLOSSARY.md, not another row's files.
   Return, and only this: your `## New terms` rows (or `none`), the `## Components` symbols, the
   impl-decision notes you wrote, and any contradiction in the row you could not resolve.
   Do not summarize the files — the caller reads them.")
```

The `budget-check` hook fires inside the fork, where the write happens (§ Budget). It warns; the
count that fails is `code:sub-verify.md` Phase 0, over the finished corpus.

**Done when** every fork of the wave returned, and each of its rows has `TODO-N.md` and
`TODO-N.test.md` on disk.

### Step 3 — merge what a fork may not write (caller)

A fork owns its pair and nothing shared. Each artifact below is one file that every row in the wave
would otherwise write at once:

| Shared artifact | Who writes | Why not the fork |
|---|---|---|
| `GLOSSARY.md` | caller, from the returned `## New terms` rows, `Status: new`, before the gate | Parallel writes to one file lose entries — and only the caller can see two forks minting two names for one concept. |
| `spec.md` — ledger, wave table | caller only | A row a fork finds wrong is a spec problem, not a pair problem: the caller fixes the ledger row, or stops and runs `revise`. |
| `thoughts/NNN-*.md` | the fork, inside its assigned block | The number is the collision: two forks both take the next free `NNN` and write the same file. The block is handed out in the prompt. |
| the notes `jj commit` | caller, once per wave | `code:ref-subcommand-rules.md` § Log to notes-dir. |

Then run the three checks that are cross-row by construction, and so belong to nobody inside a fork:

- **Two rows in one wave share a `## Components` symbol** → the wave was wrong. Fix the wave table in
  `spec.md`, or merge the rows; shipping the overlap puts two implementers in one file.
- **A fork's real `depends_on` is an edge the wave table does not carry** → move the row to a later
  wave and re-check the one it left.
- **Two rows named one concept differently, or a row names a concept an entry already holds** →
  one term wins in `GLOSSARY.md`, the other becomes its Forbidden name, and the row that loses is
  edited to match before the next wave reads it.

**Done when** every returned `## New terms` row is an entry in `GLOSSARY.md` with `Status: new`,
`Code: none`, and its Forbidden names, no two entries name one concept, and
`${CLAUDE_PLUGIN_ROOT}/bin/glossary-lint.py <notes-dir>` reports no finding the wave added.

### Step 4 — stage 1: the next wave

Fan out `W2` only once `W1`'s human halves are on disk and merged. A `W2` row's Components and
increments are written against the symbols a `W1` row introduces, and those symbols are in that
row's `## Increments` diffs. Wall clock is the number of waves, not the number of rows.

**Done when** every ledger row has `TODO-N.md` and `TODO-N.test.md`, and Step 3 ran after each
wave.

A fork that dies, or returns nothing → re-spawn that row. The caller never authors a row itself.

**A single row is not a fan-out.** Re-authoring one row's files (§ Iteration), or a ledger holding
one row, is written inline. The glossary merge and Step 5 still run. The fork is for a wave.

### Step 5 — the TODO gate (caller)

Run this step when every row has its `TODO-N.md` and `TODO-N.test.md` and the glossary merge is
done.

1. Commit the notes (`code:ref-subcommand-rules.md` § Log to notes-dir), so the human reads a fixed
   version.
2. Hand the human the list to read: every `TODO-N.md` and `TODO-N.test.md`, and the `GLOSSARY.md`
   entries this run added. The read order is § The verification chain.
3. Stop and ask for approval per row. Do not write an agent half in the same turn.
4. A row the human corrects → the caller edits its human half and `GLOSSARY.md` in place
   (`Status` stays `new`), then asks again for that row and for every later-wave row that names a
   symbol the correction changed. A correction that changes the ledger → stop and run `revise`.

**Done when** the human approved every row by name, or said "all approved". A row without approval
stays at stage 1.

### Step 6 — stage 2: the agent halves (caller)

Fan out the approved rows wave by wave, the same way as Step 2 and Step 4. A wave starts only when
every row in it and in the earlier waves is approved. A `W2` agent half names
the files and pre-reads a `W1` row creates, so `W1`'s agent halves are on disk first.

```
Agent(subagent_type="fork", prompt=
  "[TODO-N stage 2] Author the agent half for ledger row N. TODO-N.md and TODO-N.test.md are
   approved — do not edit them.
   Follow ${CLAUDE_PLUGIN_ROOT}/skills/arch/commands/sub-todo.md, the `>` rule blocks in
   examples/todo-agent.md, and references/ref-todo-sections.md in full.
   Write <notes-dir>/todos/TODO-N.agent.md and nothing else, except impl-decision notes in
   thoughts/ numbers <lo>-<hi>.
   Return, and only this: your `## Files` paths, the impl-decision notes you wrote, and any place
   where the approved design cannot be built as written.")
```

Then run the cross-row check of Step 3 again over `## Files`: two rows in one wave that share a path
→ fix the wave table. A fork that reports the approved design cannot be built → do not edit the human
half yourself. Show the human the problem and go back to Step 5 for that row.

**Done when** every approved row has all three files, every increment has at least one `## Files`
line, and the row passes the pre-save checklist.

## Audience — a context-free Sonnet implementer

No project context, no judgment, no permission to improvise. If the implementer must *infer*
anything — a path, a name, a test command, a decision — the TODO is broken. Rewrite it.

**Self-contained means: the pair plus the generated rule set is enough.** The implementer reads
the three files of the row and the rules the agent half's command prints, and never opens
`spec.md` or a thought note to know *what* to build. Test the draft by asking: with `spec.md` deleted and no
thought note opened, could an implementer still write the code and both tests? If not, the TODO is
not finished.

**The rules are read, not restated.** The generated table is short — one line per settled decision —
so the implementer reads all of it and obeys the rows that bite. A rule copied into the agent half is
the second copy that drifts, and choosing *which* rows to copy is a judgment the pair's author makes
once and every later reader inherits blind.

**Self-contained is not exhaustive.** The spec's Description, Goal, and target picture are the human
reviewer's context, not the implementer's, and they never appear in a TODO body. Neither does the
discussion behind a rule: that lives in `thoughts/`, and the `trace` skill fetches it when someone
wants to argue with the rule rather than obey it.

## Budget

The human half is ≤ 550 lines, not counting `## New terms` and `## Components`; the agent half and the
test file have no line budget.

`TODO-N.md` at 550 lines is a ceiling, not a nudge. The prose sections — Outcome, Flow changes, Commit —
run to well under a hundred lines on a real row; the rest of the room is for `## Increments`, which
is why the number is this large. Hitting the ceiling therefore means the contract change itself is too
big for one row: split the ledger row. The budget is not the tool for tightening a wordy Outcome;
§ Not over-stated in the pre-save checklist is.

**`## New terms` and `## Components` are unlimited, and `budget-check.py` counts neither.** Both are
rosters, not prose: one row per term the TODO adds, one row per symbol it creates, modifies, or
deletes. A row is a fact about the change, so cutting rows to fit a budget hides part of the change
from the human approving it — and a TODO that legitimately touches thirty symbols is one deliverable,
not two. The `## Components` rules that do bind are elsewhere: exactly one `main` row, every row a
`package.Class` symbol, and every row named by an increment. `## Increments` is where a wide row hits
a ceiling: ten increments, 150 changed lines per diff.

`TODO-N.test.md` is as long as the cases need: one case per promise the Outcome makes and per marked
step in `## Flow changes`. It is out of the human half so that a budget never cuts a case.

`TODO-N.agent.md` is as long as its paths and pre-reads need, and carries **no ```diff block at
all**. Never drop a pre-read to make it shorter.

What is counted in `## Increments` besides lines: ≤ 10 increments, `n` contiguous from 1, and each
diff ≤ 150 changed lines (or a declared **Compile floor**). **More than 10 increments is the real
"too big" signal**: it is per-increment, so it does not grow because a row is legitimately detailed.
Never compress a diff or merge two increments to fit the 550 lines — split the ledger row.

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
> counts every budget on this page — the human half's lines, its increments and diff lines, and
> `spec.md`'s lines — each
> time one of a row's two files or `spec.md` is written, and **warns** with the
> count and the split to make. It also names a section written into the wrong file. It runs after the
> write, because an `Edit` call cannot show the resulting file. A
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
5. **The surface ships as a diff; the logic ships as a sketch.** Every changed type, field, signature, and setting is a unified diff in the increment that lands it, never prose the implementer translates. Every body — the code behind those signatures — is pseudocode (the `flow-sketch` skill) the implementer writes from. Neither substitutes for the other, and a body pasted as a diff is the one shape both rules reject (§ A diff carries the surface, not a body).
6. **No outward links** — reference other TODOs only via `Depends on`.
7. **Pre-reads are mandatory** — every file to understand before editing.
8. **New terms are defined, not assumed** — a domain term missing from `GLOSSARY.md` gets a `## New terms` row (see § New terms below).
9. **Components come before changes** — name the `package.Class` set and mark the one holding the main part, then split the work into ordered increments over those components (`examples/todo.md` § Components, § Increments).
10. **The commit is approved in small increments, not in one read.** `## Increments` is an ordered sequence: each increment is one small diff a human approves alone from its own block — first at the gate as a prediction, then at `impl` against the real diff — and each approved increment is appended to the same commit. One TODO stays one deliverable; only its *review* is split.

## File location

`<notes-dir>/todos/CLAUDE.md` — the pair guide the folder already carries — is written by `new` Step 0
and is never rewritten here. Missing → copy [`examples/todos-claude.md`](../examples/todos-claude.md)
verbatim without its `>` block, as the caller, before the fan-out.

`<notes-dir>/todos/TODO-N.md` and `<notes-dir>/todos/TODO-N.agent.md`, `N` 1-indexed and contiguous,
one pair per ledger entry. The rules both halves obey are stored in no file: they are generated from
`<notes-dir>/thoughts/`.
`TODO-N.md` restates that entry's outcome verbatim at the top. Resolve `<notes-dir>` from the active
phase — never hardcode `.notes/`.

## Required elements — in order

Exact keys and headings, this order, in the file named. The rule for each one is written once, in the
`>` block under that heading in the example — this list says which headings exist and where, never
what goes inside them.

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
| `where` | always (`inherit` unless this TODO needs its own checkout — `arch:ref-write.md` § Where the work happens) |
| `increment` | always — authored as `0/<total>`, `<total>` = the count of `## Increments` H3s (`arch:ref-write.md` § Progress) |

| # | Element | Level | Required |
|---|---------|-------|----------|
| 1 | `TODO-N: <title>` | H1 | always — imperative, ≤ 60 chars |
| 2 | `Outcome` | H2 | always |
| 3 | `New terms` | H2 | only if the TODO adds terms missing from GLOSSARY.md |
| 4 | `Components` | H2 | always |
| 5 | `Increments` | H2 | always — one H3 per increment in apply order, each self-contained: Landed, Change, Do, Blast radius, Behavior, Builds, and the **Surface** diff it lands; no file path |
| 6 | `Flow changes` | H2 | always — one H3 per running path the TODO changes, its steps as a tree in run order, each changed step marked (`+ step`, `+ check`, …); or `none — <reason>` |
| 7 | `Commit` | H2 | always — the `Title` and `Body` of the one commit the increments build |
| 8 | `Deviations` | H2 | never at `todo` — written by `impl` when a user correction contradicts a section above, removed by `revise` |
| 9 | `**Tests:** [TODO-N.test.md](TODO-N.test.md)` | line | always — the link to the test file |
| 10 | `**Agent:** [TODO-N.agent.md](TODO-N.agent.md)` | line | always — the last line |

### `TODO-N.test.md` — the test file

| # | Element | Level | Required |
|---|---------|-------|----------|
| 1 | `TODO-N — tests` | H1 | always — no frontmatter |
| 2 | `**Design:** [TODO-N.md](TODO-N.md)` | line | always — the first line, the one link back |
| 3 | `Autotest` | H2 | always — **both** a `Unit` and an `E2E` sub-block |

### `TODO-N.agent.md` — the agent half

| # | Element | Level | Required |
|---|---------|-------|----------|
| 1 | `TODO-N — agent` | H1 | always — no title, no frontmatter |
| 2 | `**Design:** [TODO-N.md](TODO-N.md)` | line | always — the first line, the one link back |
| 3 | `Files` | H2 | always — each path with `create`/`modify` and the increments that touch it |
| 4 | `Pre-reads (MUST read before editing)` | H2 | always |
| 5 | `Manual test` | H2 | always |
| 6 | `Gotchas` | H2 | only after a trap is found — `todo` writes no Gotchas section; `impl` creates it with the first trap, so the traps survive a compact or a handoff |

Missing any always field/element → invalid. A section in the wrong file is also invalid, and the
`budget-check` hook reports it: `## Constraints` or `## Files` in the human half, `## Outcome` /
`## Increments` / `## Commit` in the agent half, `## Autotest` outside the test file, a `## Constraints` section in any file,
or **any ```diff block outside `## Increments`** — each one means the split was not made.

## The verification chain

A correct TODO is self-explanatory: a human approves it by walking the elements of `TODO-N.md` and
`TODO-N.test.md`, repo closed. The agent half stays shut.

**type → Outcome → New terms → Components → Increments → Flow changes → Autotest → Commit**

| Element | Verifies | Link |
|---------|----------|------|
| `type` (frontmatter) | what kind of change — frames the rest | — |
| Outcome | is this the right capability, and what lands to deliver it? (the anchor) | — |
| New terms | right vocabulary, consistent with GLOSSARY.md? | grounds Outcome |
| Components | which `package.Class` symbols are created, modified, or deleted, and which one holds the main part? | locates Outcome |
| Increments | in which steps does the change land, and what does each symbol *become* — the exact types, fields, and signatures a caller will see? Each step read alone. | commits Outcome |
| Flow changes | which running paths gain, lose, or change a step or a check, and in what order do the steps run? | routes Outcome |
| Autotest (`TODO-N.test.md`) | do the unit **and** e2e tests prove the Outcome and every marked flow step? | verifies Outcome |
| Commit | does the message the increments build toward state the same change the Outcome promised? | closes Outcome |

Outcome is the anchor; Components, Increments, Flow changes, Autotest, and Commit are checked *against* it. Consistent
chain → correct TODO.

**Components and Increments are one pair, and the gate needs both.** Components without increments
approves a list of names; increments without Components approve diffs with no stated reach. Read them
together: every Components row is named by an increment, and every increment names one row.

**Two questions are checked later, not at the gate**, and both for the same reason — the gate is a
design read, and these two are answerable only against code:

- **The generated rules** — do the settled decisions actually bound this slice? The human *made* those
  decisions during the grill, so re-reading them here checks nothing; what matters is whether an
  increment violates one, which `verify` audits against the generated rules and the `rules` gate
  checks against the diff as `D<NNN>` rules.
- **Does the real code match each increment?** The gate approves each increment as a prediction. The
  human walks them again while they are applied, at the grain the `approve` key sets
  (`impl:sub-impl.md` step 5 and its § Approval), where each block is compared with its real diff.

What `verify` checks before any of that — both sections' shape, and that neither sits in the wrong
half: `code:sub-verify.md` § Phase 0 — static gate.

**The `trace` skill is not a link in the chain — it is what you run to break one.** The chain asks
whether the seven elements agree with each other. A trace answers a different question: whether any
of them *had* to be that way. A reviewer who accepts the Outcome never runs it; a reviewer who wants
to argue with the Outcome, a Components split, an increment's diff, or an `E2E: none` runs it against
that anchor and gets back the decision that produced it, cited to the note or document holding the
why. Keeping it out of the chain — and out of the files — is what keeps the gate a design read
instead of a research session.

**Components is the map the increments walk.** Every row is named by at least one increment, and no
increment names a row missing from the table. A human who approves the Components table has approved
the *reach* of the change before reading a diff.

**Commit is the human's last read.** The increments are gone once the commit lands, and this text is
all that stays — the only place the *why* is written for a reader who has just the repo.

## Section rules

What goes inside each heading is the `>` block under that heading in @../examples/todo.md,
@../examples/todo-agent.md, and @../examples/todo-test.md. What cuts across the sections — the prose rule, where the generated rules
come from, the two diff doctrines, and what an approval buys — is
@../references/ref-todo-sections.md. A fork authoring a row reads all four; the caller running the
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

Edit in place, same `N` unless order changes — then renumber all three files together and update the ledger. An edit to an approved `TODO-N.md` sends the row back to Step 5, and stage 2 rewrites its agent half's `## Files` when the increments changed. A TODO already `status: done` → don't bump; make a new one.

## Pre-save checklist

**The hook counts the mechanical rules; this checklist holds only what a reader must judge.**
`budget-check` (§ Budget) already counts the line budgets, every misplaced section, a ```diff or a
frontmatter block outside the human half, a `## Constraints` section, the increment count
and contiguity, and a missing **Do** bullet. Ticking those here would be the author grading their
own file against a rule already counted.

### The row

- [ ] The human approved this row's `TODO-N.md` and `TODO-N.test.md` in this session (§ Execution, Step 5) before `TODO-N.agent.md` was written
- [ ] Every `## New terms` row is an entry in `GLOSSARY.md` with `Status: new`, written before that approval
- [ ] All three files exist for this `N`, `TODO-N.md` ending with its
      `**Tests:**` and `**Agent:**` links, and `TODO-N.agent.md` and `TODO-N.test.md` each
      opening with its `**Design:**` link
- [ ] **No rule text and no origin link in either half** — a rule lives in its `thoughts/` note and reaches the implementer through the generator

### `TODO-N.md` — the human half

- [ ] All `always` elements present and ordered; `New terms` present iff the TODO adds terms
- [ ] **`approve` is `inherit`** unless this TODO needs a depth of its own — and any other value carries, as a trailing comment, the reason it overrides the spec
- [ ] **`where` is `inherit`** unless this TODO needs a checkout of its own — same rule: any other value carries the reason as a trailing comment
- [ ] **Not over-stated**: no spec Description/Goal/target-picture prose was copied in, and the Outcome is this TODO's slice rather than the spec Goal
- [ ] **Outcome** is 2–7 bullets, each a capability in GLOSSARY.md terms followed by what lands (plain-words kind on a symbol) — no paths, routes, libraries
- [ ] **Every prose line passes `i-have-adhd`** — Outcome, `Meaning`, `Role`, `Change`, flow steps, Autotest cases, `Commit.Body`: one idea per sentence, short sentences, literal words, no restatement, and each section decided by its first sentence alone
- [ ] `## Components` has exactly one `main` row, each a `package.Class` symbol with a `create | modify | delete` **Touch** and a one-sentence **Role** and **Change**
- [ ] **Each increment is self-contained for review**: its block alone says what changes, why, what it can break, and the exact new shape — no "as above", no "see increment <n>", and every symbol its **Do** names as new or changed is in its own diff
- [ ] **No file path in any increment** — symbols only; paths are in the agent half's `## Files`, keyed by increment
- [ ] Each increment names one **Components** row, ordered deepest-first so the repo builds after each (or marked `builds: only with increment <n>`); every row is named by at least one increment
- [ ] Every increment carries **Landed:** `no`, a **Change** (one of the nine kinds in `impl:ref-change-types.md`), a **Do** of one to four imperative sentences, a **Blast radius** that names the real symbols and callers to retest, and a **Surface** — one ```diff, a plain contract block for a body-only deliverable, or `none — <reason>`
- [ ] The frontmatter `type:` is the kind of the TODO's **main** work, and the increment **Change** spread agrees with it — every increment `wiring` under a `type: new behavior` TODO means one of the two is wrong
- [ ] **No code in any Do** — no fenced block, no pasted signature; the signature is in the increment's diff, and "implement the handler" is not an instruction
- [ ] Every symbol whose signature changes has its call sites named in that increment's **Do**
- [ ] A **Behavior** sketch appears wherever **Do** cannot carry the logic (a real branch structure, an error path that matters, a non-obvious ordering) — ≤ 40 lines of pseudocode, no real imports or paths
- [ ] Every `create` row's symbol appears as new surface in an increment diff, and every `delete` row's symbol is gone from the code the diffs leave behind — a Touch the diffs contradict is a wrong Touch
- [ ] **No body in a diff** — no function body, loop, branch chain, shell script, query, regex, fixture, or literal expected-value table; no comments and no `AGENT:` markers. The sole exception is a body the human asked for directly, carrying a `**Body requested:**` bullet that names the symbol
- [ ] **No consequence in a diff** — no migrated call site, updated import, forwarded field, or renamed use whose shape another diff already fixes. It lives in the deciding increment's **Do** and **Blast radius**
- [ ] **No interface method in a diff** under the type that implements it — that type shows one `var _ Interface = (*Type)(nil)` line per interface, its constructor, and only the public methods no interface declares
- [ ] **`## Flow changes`** has one H3 per running path the TODO changes, its steps as one fenced tree in run order, sub-steps and paths nested under the step that runs them, every changed step opening with its marker — or the single line `none — <concrete reason>`
- [ ] Every step a flow marks names only `## Components` symbols, and no body code
- [ ] **No `## Deviations`** — that section belongs to `impl`, and one present at `todo` means a correction was written as design
- [ ] `Commit.Title` ≤ 72 chars, imperative, prefixed; `Commit.Body` has a cause and a goal paragraph (plus a decision if one was rejected), names no `TODO-N` or note id, and states the same change as the **Outcome**

### `TODO-N.test.md` — the test file

- [ ] No frontmatter; the first line is the `**Design:**` link; `## Autotest` is the only H2
- [ ] Every `+ check` and `+ branch` in `TODO-N.md` `## Flow changes` has an error case, and every `+ step` and `~ step` has a case
- [ ] **Autotest** has both a `Unit` and an `E2E` sub-block, each with **Under test** + Target files + Cases + one runnable Command — or `none — <concrete reason>`
- [ ] **Under test** opens each level, above **Target files**, naming the symbols and the one behaviour the whole block proves
- [ ] Every Autotest case sits in the fenced block under `**Happy path**` or `**Error cases**` — no flat case — as `Case <what it proves>:` with its steps indented under it
- [ ] A multi-step case writes **one line per step**, in run order, then `Then` and `And` outcome lines — never a chain joined by `;` or `→`
- [ ] Every Autotest case is a sentence — no assertion source, no fixture, no shell, no table of literal expected values
- [ ] An `E2E: none` that defers names a TODO that **exists in the ledger** and whose own `E2E` carries a case asserting this path; a deferral to a `Manual test` does not count

### `TODO-N.agent.md` — the agent half

- [ ] **Self-contained**: with `spec.md` deleted and no thought note opened, the pair plus the generated rules still says what to build and what to assert
- [ ] Every settled decision this TODO's increments can violate is an approved `decision` or `impl-decision` note whose `description` states the rule, and every such rule a test can check has a matching case in `TODO-N.test.md` `## Autotest`
- [ ] Every **Files** / **Pre-reads** path exists (or is marked `create`); every non-test **Files** path maps to a **Components** row
- [ ] Every **Files** line names the increments that touch it, and every increment has at least one line
- [ ] **Manual test** Steps/Expected aligned 1:1

### The ledger

- [ ] Matching ledger row exists in `spec.md`, and the TODO sits in exactly one `## Plan` wave whose members' **Files** sets are disjoint from this one's

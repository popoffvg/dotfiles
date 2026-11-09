# code — todo (TODO bodies)

Authors the `todos/TODO-N.md` + `todos/TODO-N.agent.md` **pair**, plus the `todos/TODO-N.test.md`
test file, from a reviewed `spec.md` + `adr/`. Owns the TODO element list, the **verification chain**, and the **outcome** rules.

**Two stages, with a human gate between them** (§ Execution): no agent half exists before the human
approves the row's `TODO-N.md`, `TODO-N.test.md`, and `GLOSSARY.md` entries.

**Open the filled examples first** — [`examples/todo.md`](../examples/todo.md) (human half),
[`examples/todo-agent.md`](../examples/todo-agent.md) (agent half), and
[`examples/todo-test.md`](../examples/todo-test.md) (test file). They are the artifact you are
producing, and each carries the rules for every section as a `>` block under the heading it governs.
The rule set that bounds them is printed, not written: run
`~/.claude/scripts/wm-constraints.py <notes-dir>/adr`.

Spec contract + the gate: `ref-write.md`. Vocabulary: `wm:GLOSSARY.md`.

## One ledger row, three files

| File | Read by | Holds | Length |
|------|---------|-------------|--------|
| `TODO-N.md` | the human, repo closed | frontmatter, Outcome, New terms, Components, **Flow changes**, **Increments (the work, its diffs, and its commits)** | ≤ 200 lines, New terms + Components + Increments uncounted |
| `TODO-N.test.md` | the human at the gate, then the implementer and the gates | Autotest — Unit and E2E | **unlimited** |
| `TODO-N.agent.md` | the implementer | Files (each path keyed to its increments), Pre-reads, Manual test, Gotchas | **unlimited** |

The split is by audience, not by size. The human approves `TODO-N.test.md` at the same gate as `TODO-N.md`.

**The increments are the human's, and each one is self-contained for review.** `## Increments` in the
human half carries the whole contract change, cut into the steps `impl` applies. Each step carries
its own diff, its summary, and its **Surprises**, so a reviewer approves one step from its block alone —
at the gate, and again at `impl` against the real diff. Each approved increment is appended to commit `c`: the increments split the *review*, and the `### Commit` sections split the *history*. No increment names a file: paths live once,
in the agent half's `## Files`, keyed by increment number. The agent half carries no diff and no
increment text.

**No TODO copies an ADR rule, and none carries an origin.** A strategic decision lives once, as its
ADR, and the rule set is generated from the ADR Properties on demand —
`~/.claude/scripts/wm-constraints.py <notes-dir>/adr` (`ref-todo-sections.md` § Constraints).
No pair file carries a rule or the command; `todos/CLAUDE.md` § Read order names the command once. The *why* behind a rule is not stored in
`todos/` either: the `trace` skill walks to it on demand.

**The human half is written for an ADHD reader.** Every prose line of `TODO-N.md` obeys the
`i-have-adhd` skill — load it before writing the half, not after. The agent half is not bound by it.

**Each pair field has one home.** The title, `status`, Outcome, and increments live in `TODO-N.md`;
paths and pre-reads live in `TODO-N.agent.md`. The ledger outcome is the sole derived copy:
it appears verbatim as the TODO Outcome. Autotest lives in `TODO-N.test.md` alone. `TODO-N.md` ends
with one link to each other file, and each other file opens with one link back.

**The row is atomic after stage 2.** All three files are deleted or renumbered together. A row
without its agent half cannot be implemented or verified.

## Precondition — past the gate

Run `todo` only after a human has reviewed the spec (`ref-write.md` § Stop at the gate). `new` stops before
this deliberately. Before authoring: `spec.md` frontmatter `status: review`, **no open question in `QUESTIONS.md`**
(`~/.claude/scripts/wm-open-questions.sh <notes-dir>` and
`~/.claude/scripts/wm-constraints.py <notes-dir>/adr --check` both exit 0),
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
between them. Author a wave **in parallel — one fork per row**.

**Use a fork, not a fresh agent.** A fork inherits the corpus the caller read in Step 1 and the grill
that settled the decisions; a `general-purpose` agent re-reads the corpus per row and never sees the
grill. A fork also inherits the caller's model, which cutting `## Increments` needs: it is design,
not extraction.

**The unit is the row's stage, never one file of it.** A stage-1 fork writes `TODO-N.md` **and**
`TODO-N.test.md` — the cases prove the Outcome and the marked flow steps, so they are written
against them. A stage-2 fork writes `TODO-N.agent.md` against the approved `TODO-N.md`: it finds the
paths behind each approved increment, and the increments are fixed before the paths are looked up.

### Step 1 — read the corpus once (caller)

`spec.md` (ledger + wave table), the ADRs in `adr/`, `GLOSSARY.md`.

Enter `adr/` through the index, never by reading the directory: run
`~/.claude/scripts/wm-adr-index.py <notes-dir>/adr`, read every title, and open in full the ADRs
that bear on the rows in this run's waves (`arch:ref-adr-format.md` § Find the ADRs for a task).

**Done when** you can name, for each row in the run, the ADRs that bear on it.

### Step 2 — stage 1: fan out the wave (caller)

One fork per row in the current wave, **all `Agent` calls in one assistant message** — calls in
separate messages run serially, not in parallel. Each prompt names the row and
nothing more; the context is already there.

```
Agent(subagent_type="fork", prompt=
  "[TODO-N stage 1] Author the design for ledger row N: <the row's outcome, verbatim>.
   Follow ${CLAUDE_PLUGIN_ROOT}/skills/arch/commands/sub-todo.md, the `>` rule blocks in
   examples/todo.md and examples/todo-test.md, and references/ref-todo-sections.md in full — you
   are past the spec gate, before the TODO gate.
   Write exactly two files: <notes-dir>/todos/TODO-N.md (with `increment: 0/<total>`) and
   TODO-N.test.md.
   Write nothing else — not TODO-N.agent.md, not spec.md, not GLOSSARY.md, not another row's files.
   Return, and only this: your `## New terms` rows (or `none`), the `## Components` symbols, and any contradiction in the row you could not resolve.
   Do not summarize the files — the caller reads them.")
```

**Done when** every fork of the wave returned, and each of its rows has `TODO-N.md` and
`TODO-N.test.md` on disk.

### Step 3 — merge what a fork may not write (caller)

A fork owns its pair and nothing shared. Each artifact below is one file that every row in the wave
would otherwise write at once:

| Shared artifact | Who writes | Why not the fork |
|---|---|---|
| `GLOSSARY.md` | caller, from the returned `## New terms` rows, `Status: new`, before the gate | Parallel writes to one file lose entries — and only the caller can see two forks minting two names for one concept. |
| `spec.md` — ledger, wave table | caller only | A row a fork finds wrong is a spec problem, not a pair problem: the caller fixes the ledger row, or stops and runs `revise`. |
| `adr/NNNN-*.md` | the fork, inside its assigned block | The number is the collision: two forks both take the next free `NNNN` and write the same file. The block is handed out in the prompt. |
| the notes `jj commit` | caller, once per wave | `code:ref-jj-notes.md` § Recording. |

Then run the three checks that are cross-row by construction, and so belong to nobody inside a fork:

- **Two rows in one wave share a `## Components` symbol** → the wave was wrong. Fix the wave table in
  `spec.md`, or merge the rows; shipping the overlap puts two implementers in one file.
- **A fork's real `depends_on` is an edge the wave table does not carry** → move the row to a later
  wave and re-check the one it left.
- **Two rows named one concept differently, or a row names a concept an entry already holds** →
  one term wins in `GLOSSARY.md`, the other becomes its Forbidden name, and the row that loses is
  edited to match before the next wave reads it.

**Done when** every returned `## New terms` row is an entry in `GLOSSARY.md` with `Status: new`,
`Code: none`, its Forbidden names, a place in a cluster, and its **Links**, no two entries name one concept, and
`${CLAUDE_PLUGIN_ROOT}/bin/glossary-lint.py <notes-dir>` reports no finding the wave added.

### Step 4 — stage 1: the next wave

Fan out `W2` only once `W1`'s human halves are on disk and merged. A `W2` row's Components and
increments are written against the symbols a `W1` row introduces, and those symbols are in that
row's `## Increments` diffs.

**Done when** every ledger row has `TODO-N.md` and `TODO-N.test.md`, and Step 3 ran after each
wave.

A fork that dies, or returns nothing → re-spawn that row. The caller never authors a row itself.

**A single row is not a fan-out.** Re-authoring one row's files (§ Iteration), or a ledger holding
one row, is written inline. The glossary merge and Step 5 still run. The fork is for a wave.

### Step 5 — the TODO gate (caller)

Run this step when every row has its `TODO-N.md` and `TODO-N.test.md` and the glossary merge is
done.

1. Commit the notes (`code:ref-jj-notes.md` § Recording), so the human reads a fixed
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
   Write <notes-dir>/todos/TODO-N.agent.md and nothing else.
   Return, and only this: your `## Files` paths and any place
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
`spec.md` or an ADR to know *what* to build. Test the draft by asking: with `spec.md` deleted and no
ADR opened, could an implementer still write the code and both tests? If not, the TODO is
not finished.

**Self-contained is not exhaustive.** The spec's Description, Goal, and target picture are the human
reviewer's context, not the implementer's, and they never appear in a TODO body.

## Budget

The human half is ≤ 200 lines, not counting `## New terms`, `## Components`, and `## Increments`; the
agent half and the test file have no line budget.

`TODO-N.md` at 200 lines is a ceiling, not a nudge. Hitting it means the row does two things:
split the ledger row. Tighten a wordy Outcome with *Not over-stated* in the pre-save checklist, not
with the budget.

**`## New terms` and `## Components` are unlimited, and `budget-check.py` counts neither.** Both are
rosters: one row per term the TODO adds, one node per symbol it creates, modifies, or deletes. Never
cut a row to fit a budget — it hides part of the change from the human approving it.

**`## Increments` is counted by shape, not by lines:** ≤ 4 commits, ≤ 10 increments per commit, `c`
and `i` contiguous from 1, and each diff ≤ 150 changed lines (or a declared **Compile floor**). A big
deliverable is cut into commits, not compressed: each commit adds room. **More than 4 commits, or more
than 10 increments in one commit, is the real "too big" signal** — split the ledger row. Never
compress a diff or merge two increments to fit.

`TODO-N.test.md` is as long as the cases need: one case per promise the Outcome makes and per marked
step in `## Flow changes`.

`TODO-N.agent.md` is as long as its paths and pre-reads need, and carries **no ```diff block at
all**. Never drop a pre-read to make it shorter.

**Split the case, not the stack.** A capability over budget is split by *narrowing what it accepts*,
never by *removing a layer*. Narrow it to one input, one format, one type, one path — hardcode what
this row is not about, and name the row that widens it. Every half still reaches the real entry
point, so every half still has a real `E2E`.

Remove a layer instead and both halves stop being capabilities: neither has an entry point, both
write `E2E: none`, and every design gap moves to the last wave — which is the one place a gap is
most expensive to find. **The test of a split: if it turns either half's `E2E` into `none`, it is the
wrong split.** Narrow is not the same as shallow; a thin slice through every layer is the first row,
and later rows widen it.

Which work is a row at all — and why an enabler with one consumer is the first increments of its consumer
rather than a row of its own — is `ref-write.md` § Merges that fall out of this rule.

> **The budget is counted, not trusted.** The `budget-check` PostToolUse hook (`wm:bin/budget-check.sh`)
> counts every budget on this page — the human half's lines, its increments and diff lines, and
> `spec.md`'s lines — each time one of a row's two files or `spec.md` is written, and **warns** with
> the count and the split to make. It also names a section written into the wrong file. Raising a
> budget is never the fix: the number is the size at which the second deliverable becomes visible.
>
> The count that **fails** is `code:sub-verify.md` Phase 0, over the finished corpus. Run that one by
> hand: `<plugin>/bin/budget-sweep.sh <notes-dir>` (exit 1 = over budget), or one file with
> `python3 <plugin>/bin/budget-check.py <file>`.

## Operating principles

1. **Concrete over abstract.** Real paths, commands, signatures. No "etc.", "as needed".
2. **Strong verbs.** *rename X to Y, add field Z to type T, delete function F* — never *improve, handle, refactor stuff, clean up*.
3. **Every section is a checklist to tick off.** Prose → bullets, a table, or a code block.
4. **One TODO = one deliverable = one or more commits.** One outcome a user can observe; group the edits that deliver it, nothing else. Each commit has a clear border: it builds, its tests pass, and its message states one cause. An `L` row — over 8 files or over 6 increments — is asked about before it is written.
5. **The surface ships as a diff; the logic ships as a sketch.** Every changed type, field, signature, and setting is a unified diff in the increment that lands it, never prose the implementer translates. Every body — the code behind those signatures — is pseudocode (the `flow-sketch` skill) the implementer writes from. Neither substitutes for the other, and a body pasted as a diff is the one shape both rules reject (`ref-todo-sections.md` § A diff carries the surface, not a body).
6. **No outward links** — reference other TODOs only via `Depends on`.
7. **Pre-reads are mandatory** — every file to understand before editing.
8. **New terms are defined, not assumed** — a domain term missing from `GLOSSARY.md` gets a `## New terms` row (`examples/todo.md` § New terms).
9. **Components come before changes** — name the `package.Class` set and mark the one holding the main part, then split the work into ordered increments over those components (`examples/todo.md` § Components, § Increments).

## File location

`<notes-dir>/todos/CLAUDE.md` — the pair guide the folder already carries — is written by `new` Step 0
and is never rewritten here. Missing → copy [`examples/todos-claude.md`](../examples/todos-claude.md)
verbatim without its `>` block, as the caller, before the fan-out.

`<notes-dir>/todos/TODO-N.md` and `<notes-dir>/todos/TODO-N.agent.md`, `N` 1-indexed and contiguous,
one pair per ledger entry. Resolve `<notes-dir>` from the active
phase — never hardcode `.notes/`.

## Required elements — in order

Exact keys and headings, this order, in the file named. The rule for each one is written once, in the
`>` block under that heading in the example — this list says which headings exist and where, never
what goes inside them.

### `TODO-N.md` — the human half

A `---` frontmatter block carries the technicals; the body carries prose only.

| Key | Required |
|-----|----------|
| `status` | always |
| `type` | always |
| `depends_on` | always (`[]` if none) |
| `risk` | always |
| `size` | always — the PR band, off the file and increment counts (`arch:examples/todo.md`) |
| `approve` | always (`inherit` unless this TODO needs its own depth — `arch:ref-write.md` § Approval) |
| `where` | always (`inherit` unless this TODO needs its own checkout — `arch:ref-write.md` § Where the work happens) |
| `increment` | always — authored as `0/<total>`, `<total>` = the count of `## Increments` H3s (`arch:ref-write.md` § Progress) |

| # | Element | Level | Required |
|---|---------|-------|----------|
| 1 | `TODO-N: <title>` | H1 | always — what the TODO brings (the gain once it lands, not the work), ≤ 60 chars |
| 2 | `Outcome` | H2 | always |
| 3 | `New terms` | H2 | only if the TODO adds terms missing from GLOSSARY.md |
| 4 | `Components` | H2 | always |
| 5 | `Flow changes` | H2 | always — one H3 per running path the TODO changes, its steps as one ` ```python ` pseudocode block in run order, each changed line ending in its marker comment (`# +`, `# ~ was:`, …); or `none — <reason>` |
| 6 | `Increments` | H2 | always — one `### <c>.<i>.` H3 per increment in apply order, each self-contained and in one component: a summary paragraph, Landed, Change, Extends, Surprises, and the **Surface** diff it lands; no file path. Each commit group ends with a `---` line and a `### Commit <c>` H3: Title, Body, Proves |
| 7 | `Deviations` | H2 | never at `todo` — written by `impl` when a user correction contradicts a section above, removed by `revise` |
| 8 | `**Tests:** [TODO-N.test.md](TODO-N.test.md)` | line | always — the link to the test file |
| 9 | `**Agent:** [TODO-N.agent.md](TODO-N.agent.md)` | line | always — the last line |

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
`## Increments` in the agent half, `## Autotest` outside the test file, a `## Constraints` section in any file,
or **any ```diff block outside `## Increments`** — each one means the split was not made.

## The verification chain

A correct TODO is self-explanatory: a human approves it by walking the elements of `TODO-N.md` and
`TODO-N.test.md`, repo closed. The agent half stays shut.

**type → Outcome → New terms → Components → Flow changes → Increments → Autotest → Commits**

| Element | Verifies | Link |
|---------|----------|------|
| `type` (frontmatter) | what kind of change — frames the rest | — |
| Outcome | is this the right capability, and what lands to deliver it? (the anchor) | — |
| New terms | right vocabulary, consistent with GLOSSARY.md? | grounds Outcome |
| Components | which `package.Class` symbols are created, modified, or deleted, and which one holds the main part? | locates Outcome |
| Flow changes | which running paths gain, lose, or change a step or a check, and in what order do the steps run? | routes Outcome |
| Increments | in which steps does the change land, and what does each symbol *become* — the exact types, fields, and signatures a caller will see? Each step read alone. | commits Outcome |
| Autotest (`TODO-N.test.md`) | do the unit **and** e2e tests prove the Outcome and every marked flow step? | verifies Outcome |
| Commits | does each `### Commit` section state one cause, and do the titles together state the change the Outcome promised? Does each **Proves** line name the cases that pass from that commit on? | closes Outcome |

Outcome is the anchor; Components, Flow changes, Increments, Autotest, and Commits are checked *against* it. Consistent
chain → correct TODO.

**Components and Increments are one pair, and the gate needs both.** Components without increments
approves a list of names; increments without Components approve diffs with no stated reach. Read them
together: every component is named by an increment, and every increment names one component.

**Two questions are checked later, not at the gate**, and both for the same reason — the gate is a
design read, and these two are answerable only against code:

- **The generated rules** — do the settled decisions actually bound this slice? The human *made* those
  decisions during the grill, so re-reading them here checks nothing; what matters is whether an
  increment violates one, which `verify` audits against the generated rules and the `rules` gate
  checks against the diff as `ADR-NNNN/Pn` rules.
- **Does the real code match each increment?** The gate approves each increment as a prediction. The
  human walks them again while they are applied, at the grain the `approve` key sets
  (`impl:sub-impl.md` step 5 and its § Approval), where each block is compared with its real diff.

What `verify` checks before any of that — both sections' shape, and that neither sits in the wrong
half: `code:sub-verify.md` § Phase 0 — static gate.

**The `trace` skill is not a link in the chain.** A reviewer who wants to argue with the Outcome, a
Components split, an increment's diff, or an `E2E: none` runs it against that anchor and gets back
the ADR that produced it. Keep it out of the chain and out of the files, so the gate stays a design
read.

**The `### Commit` sections are the human's last read.** The increments are gone once the commits land, and this text is
all that stays — the only place the *why* is written for a reader who has just the repo.

## Section rules

What goes inside each heading is the `>` block under that heading in @../examples/todo.md,
@../examples/todo-agent.md, and @../examples/todo-test.md. What cuts across the sections — the prose rule, where the generated rules
come from, the two diff doctrines, and what an approval buys — is
@../references/ref-todo-sections.md. A fork authoring a row reads all four; the caller running the
fan-out does not.

## Implementation decisions

Choices the spec did not make — file naming, package structure, error strategy, data shape — are tactical, and a tactical choice is never an ADR. The `adr` skill decides what is an ADR; its table *Where a tactical decision goes* gives the home of the rest:

| Choice | Home |
|---|---|
| A choice inside this TODO | `TODO-N.md`, in the Flow H3 or the increment it shapes, with its reason in one line |
| A shape that later TODOs repeat | `PATTERNS.md`, one rule per shape |
| A choice that binds every TODO and passes the tests of the `adr` skill | Stop. Run the `adr` skill; the pair waits until the operator approves the ADR |

Do not add a Property to a live ADR to hold a tactical choice. A Property passes the Property gate of the `adr` skill or it is not written.

## Concurrency — events and owners, not primitives

A TODO with a goroutine, a thread, a task, or a background loop states its concurrency as events and owners. The implementer picks the primitive.

- **Name no sync primitive.** No mutex, channel, atomic, `WaitGroup`, or lock in a Surprise, a Gotcha, or a Pre-read note. "Keep the state in fields under one mutex" is a primitive. Write who owns the state instead.
- **Give each piece of mutable state one owner**: the goroutine or the call that writes it. Every other party reads it through an event or a call, and never through a shared field.
- **List the lifecycle events of each background loop**: its start, each terminal event (done, lost, failed, canceled), who sends each one, and who waits on it. An event that happens once and never goes back is an event, not a field. Example: "the renewer signals `lease lost` once; every later write sees it and fails with `errLeaseLost`".
- **Say "wait" or "refuse" for two operations that meet on one resource**, with the reason. Do not pick "refuse at once" because a flag makes it easy.

## Every new algorithm is drawn for the human

The human reviews `## Flow changes`, not the agent half. An algorithm that is not drawn there is first seen in code review, when it is expensive to change. Three triggers make an algorithm visible. When one fires, the flow is required.

- **`new-body-gets-a-flow`:** a flow line calls a symbol that is new in this TODO, and its body has a loop, a wait, a retry, a timer, or a goroutine. That symbol gets its own H3, also when it is private and the caller shows it as one `with` line. Example: `with withLease(instance_id):` hides the take loop, the renewal, and the release, so `withLease` gets an H3.
- **`goroutine-is-a-running-path`:** each goroutine or background loop that the TODO starts is a running path, with its own H3. Its pseudocode shows who starts it, what stops it, which events it sends, and who waits on each one.
- **`no-design-in-agent-half`:** the agent half holds paths, pre-reads, and traps only. A sentence there that chooses how the code works ("keep X under one mutex", "loops on", "starts a goroutine that") is a design. Move it to a Flow H3, or to an ADR when it is a choice between two valid approaches.

**A work split does not remove the flow.** When an earlier TODO says "this row starts no goroutine; TODO-M starts it", TODO-M draws that goroutine.

**A trigger overrides the line budget.** When the drawn flows break the 200-line ceiling, the TODO goes to size `L`, and the human agrees to it before the pair is written. Never cut a flow to fit the budget.

## Iteration

Edit in place, same `N` unless order changes — then renumber all three files together and update the ledger. An edit to an approved `TODO-N.md` sends the row back to Step 5, and stage 2 rewrites its agent half's `## Files` when the increments changed. A TODO already `status: done` → don't bump; make a new one.

## Pre-save checklist

**The hook counts the mechanical rules; this checklist holds only what a reader must judge.**
`budget-check` (§ Budget) already counts the line budgets, every misplaced section, a ```diff or a
frontmatter block outside the human half, a `## Constraints` section, the increment count
and contiguity, a missing summary, and a missing **Extends** or **Surprises** bullet. Ticking those here would be the author grading their
own file against a rule already counted.

### The row

- [ ] The human approved this row's `TODO-N.md` and `TODO-N.test.md` in this session (§ Execution, Step 5) before `TODO-N.agent.md` was written
- [ ] Every `## New terms` row is an entry in `GLOSSARY.md` with `Status: new`, written before that approval
- [ ] All three files exist for this `N`, `TODO-N.md` ending with its
      `**Tests:**` and `**Agent:**` links, and `TODO-N.agent.md` and `TODO-N.test.md` each
      opening with its `**Design:**` link
- [ ] **No ADR rule text and no origin link in either half** — an ADR rule reaches the implementer through the generator; a tactical choice of this TODO sits in `TODO-N.md` (§ Implementation decisions)

### `TODO-N.md` — the human half

- [ ] All `always` elements present and ordered; `New terms` present iff the TODO adds terms
- [ ] **Each H2 of `TODO-N.md` and each Autotest level opens with its `> **Check:**` line**, copied from the example, plus at most one sentence naming this TODO's riskiest point in that section
- [ ] **`size`** is the band both counts land in — the `## Files` paths and the increments — with the two numbers as the trailing comment, and an `L` the human agreed to before the pair was written
- [ ] **`approve` is `inherit`** unless this TODO needs a depth of its own — and any other value carries, as a trailing comment, the reason it overrides the spec
- [ ] **`where` is `inherit`** unless this TODO needs a checkout of its own — same rule: any other value carries the reason as a trailing comment
- [ ] **Not over-stated**: no spec Description/Goal/target-picture prose was copied in, and the Outcome is this TODO's slice rather than the spec Goal
- [ ] **Outcome** is 2–7 bullets, each a capability in GLOSSARY.md terms followed by what lands (plain-words kind on a symbol) — no paths, routes, libraries
- [ ] **Every prose line passes `i-have-adhd`** — Outcome, `Meaning`, `Role`, flow steps, Autotest cases, each commit **Body**: one idea per sentence, short sentences, literal words, no restatement, and each section decided by its first sentence alone
- [ ] `## Components` draws one tree per package — each root a package path carrying `# OWNS`, each component a bare symbol with the `+` / `~` / `-` mark of `## Flow changes` in the first column and the comment `<brick> · <part> — <role>`, and exactly one `main`
- [ ] **Each increment is self-contained for review**: its block alone says what changes, what will surprise the reader, and the exact new shape — no "as above", no "see increment <c>.<i>", and every symbol its summary names as new or changed is in its own diff
- [ ] **No file path in any increment** (`arch:examples/todo.md` rule *Symbols, not paths*)
- [ ] **Each increment names one Components component and changes that component only** — a caller in another component moves in its own `call-site migration` or `wiring` increment, right after the change that breaks it; ordered deepest-first; every component is named by at least one increment
- [ ] Every increment carries **Landed:** `no`, a **Change** (one of the nine kinds in `impl:ref-change-types.md`), an **Extends** (the existing symbol it grows, or `new` with the symbols checked), a **Surprises** list, and a **Surface** — one ```diff, a plain contract block for a body-only deliverable, or `none — <reason>`
- [ ] **Every `new` in an Extends bullet survived a search**: the symbols it names are the ones a reader would try first — the state machine, gateway, or table the repo already has for this subject — and every need `PATTERNS.md` § Need → use lists is met through its row
- [ ] The frontmatter `type:` is the kind of the TODO's **main** work, and the increment **Change** spread agrees with it — every increment `wiring` under a `type: new behavior` TODO means one of the two is wrong
- [ ] **Each summary is one to three sentences, no code** — what the increment brings; a change to existing behavior reads `Before, … Now, …`. "Implement the handler" is not a summary
- [ ] **Each Surprises item names a symbol, a value, or a case** a reader would otherwise find only in the code — an edge case, a refused input, a changed default, an order that matters, a caller that stops compiling. A restated summary is not a surprise
- [ ] Every symbol whose signature changes has its callers named in that increment's **Surprises**, and moved by the increment that follows
- [ ] Every `+` component's symbol appears as new surface in an increment diff, and every `-` component's symbol is gone from the code the diffs leave behind — a mark the diffs contradict is a wrong mark
- [ ] **No body in a diff** — no function body, loop, branch chain, shell script, query, regex, fixture, or literal expected-value table; no comments and no `AGENT:` markers. The sole exception is a body the human asked for directly, carrying a `**Body requested:**` bullet that names the symbol
- [ ] **No consequence in a diff** — no migrated call site, updated import, forwarded field, or renamed use whose shape another diff already fixes. It lives in the migration increment of the caller's component, as its summary
- [ ] **No interface method in a diff** under the type that implements it — that type shows one `var _ Interface = (*Type)(nil)` line per interface, its constructor, and only the public methods no interface declares
- [ ] **`## Flow changes`** has one H3 per running path the TODO changes, its steps as one ` ```python ` pseudocode block in run order, sub-steps and paths indented under the `if` / `for` / `with` line that runs them, every changed line ending in its marker comment — or the single line `none — <concrete reason>`
- [ ] Every step a flow marks names only `## Components` symbols, and no body code
- [ ] **Every new algorithm has its own Flow H3**: each new symbol with a loop, a wait, a retry, a timer, or a goroutine in its body, and each goroutine the TODO starts, with its events ([Every new algorithm is drawn for the human](#every-new-algorithm-is-drawn-for-the-human))
- [ ] **No `## Deviations`** — that section belongs to `impl`, and one present at `todo` means a correction was written as design
- [ ] Every `### Commit <c>` sits after a `---` line that closes its increments; its **Title** ≤ 72 chars, imperative, prefixed; its **Body** has a cause and a goal paragraph (plus a decision if one was rejected) and names no `TODO-N`, increment number, or ADR number; the titles together state the same change as the **Outcome**
- [ ] **Each commit has a clear border**: a signature change and the migration it forces sit in one commit, so the repo builds and the tests pass at every commit; a second cause starts a new commit
- [ ] Every **Proves** line names `TODO-N.test.md` cases by name, every Autotest case is named by exactly one commit — the first at which it can pass — or the line is `none — <concrete reason>`

### `TODO-N.test.md` — the test file

- [ ] No frontmatter; the first line is the `**Design:**` link; `## Autotest` is the only H2
- [ ] Every new `if`, `elif`, `else`, and `raise` line (`# +`) in `TODO-N.md` `## Flow changes` has a case that takes it, and every other `# +` and `# ~` line has a case
- [ ] **Autotest** has both a `Unit` and an `E2E` sub-block, each with **Under test** + Target files + Cases + one runnable Command — or `none — <concrete reason>`
- [ ] **Under test** opens each level, above **Target files**, naming the symbols and the one behaviour the whole block proves
- [ ] Every Autotest case sits in the fenced block under `**Happy path**` or `**Error cases**` — no flat case — as `Case <what it proves>:` with its steps indented under it
- [ ] A multi-step case writes **one line per step**, in run order, then `Then` and `And` outcome lines — never a chain joined by `;` or `→`
- [ ] Every Autotest case is a sentence — no assertion source, no fixture, no shell, no table of literal expected values
- [ ] An `E2E: none` that defers names a TODO that **exists in the ledger** and whose own `E2E` carries a case asserting this path; a deferral to a `Manual test` does not count

### `TODO-N.agent.md` — the agent half

- [ ] **Self-contained**: with `spec.md` deleted and no ADR opened, the pair plus the generated rules still says what to build and what to assert
- [ ] Every ADR rule this TODO's increments can violate, and that a test can check, has a matching case in `TODO-N.test.md` `## Autotest`
- [ ] **No design in the agent half**: no sentence there chooses how the code works; each such choice is a Flow H3 in `TODO-N.md` or an ADR
- [ ] **No sync primitive is named** (mutex, channel, atomic, `WaitGroup`, lock), and every background loop has its owners and its lifecycle events listed ([Concurrency — events and owners, not primitives](#concurrency--events-and-owners-not-primitives))
- [ ] Every **Files** / **Pre-reads** path exists (or is marked `create`); every non-test **Files** path maps to a **Components** component
- [ ] Every **Files** line names the increments that touch it, and every increment has at least one line
- [ ] **Manual test** Steps/Expected aligned 1:1

### The ledger

- [ ] Matching ledger row exists in `spec.md`, and the TODO sits in exactly one `## Plan` wave whose members' **Files** sets are disjoint from this one's

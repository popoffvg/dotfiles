# code — impl

Execute **exactly one** TODO end-to-end, then stop and hand back. One TODO ships one deliverable as
one commit plus its fixups, built increment by increment (`arch:examples/todo.md` § Increments).
How much of it the user approves, which model writes it, and what its tests must cover is the
**ruleset**: the `approve` and `risk` keys, resolved by `bin/impl-ruleset.py` (step 1). `squash`
collapses the fixups back into the one commit.

Obeys the shared subcommand rules — see `code:ref-subcommand-rules.md`.

**The first implementation of every increment (step 5.1) goes to a subagent** — call @implementer with the model the ruleset names and `background: true`, one increment per message. The ruleset says whether each increment gets a new @implementer or the same one. This session never writes that first pass itself, however small the increment. **This session runs the increment loop and the gate wave itself — never a fork.** A fork runs on the parent model, ignores `model`, and cannot start @implementer or a gate agent, so it writes every increment and judges every gate on opus. The session keeps the work after it: the gate fixes and the user corrections. **Name the checkout path in every delegation** — the one step 3 resolved. A background agent starts in the session cwd, so a `where: worktree` TODO whose prompt carries no path is implemented in the wrong tree.

**Every approval happens in this session, not in the background agent** — a background agent cannot
ask the user anything. Bring each diff the ruleset shows back here for approval.

## Steps

1. **Read context, staged — never the whole citation list up front.** First run `${CLAUDE_PLUGIN_ROOT}/bin/impl-ruleset.py <notes-dir> TODO-N` (add `--auto` under `/code auto`) and obey every line it prints: the resolved `approve` and `risk`, which level set `approve`, and the rules each one adds to the steps below. Never resolve the keys by hand. Read **both halves of the pair** in full: `<notes-dir>/todos/TODO-N.md` (frontmatter, Outcome, Components, **Increments** — the ordered steps, each with the exact shape its changed symbols must end up with — **Flow changes**, the steps each running path must end up with — Commit), `<notes-dir>/todos/TODO-N.test.md` (Autotest), and `<notes-dir>/todos/TODO-N.agent.md` (Files — the paths each increment touches — Pre-reads, and `## Gotchas`, the traps an earlier session of this TODO already found). Read `<notes-dir>/GOTCHAS.md` when it exists — the traps earlier TODOs already met (`capture-gotcha` skill). Run `~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts --todo TODO-N` and obey every rule it prints — read the whole table, never a `grep` of it: that table is where every rule the code must satisfy lives. Each increment's **Surface** diff is the shape it must land. The pair plus that printed table is self-contained; together they alone say what to build. **Leave `thoughts/` closed** — the table is what lets it stay closed: it carries every rule as text, while the notes behind it hold only why each rule was chosen, never a requirement, and reading them spends context on notes the work does not need. The `trace` skill opens it when a decision turns out to be wrong. Of the files they cite, read only what the increment you are about to apply needs — the `## Files` lines keyed to that increment, and the **Pre-reads** those files name. Every later increment's pre-reads are read in step 5, when you reach it. A TODO's Pre-reads list can span many files in several repos; reading all of them before increment 1 spends the whole session's context on files increment 1 never touches. The hard rules every subcommand obeys: `code:ref-subcommand-rules.md`. Read `increment: <approved>/<total>` too (`arch:ref-write.md` § Progress): it is the resume point. `<approved>` increments are already in the commit, so step 5 starts at increment `<approved> + 1` and re-applies nothing — and the `**Landed:**` markers in `## Increments` name which ones those are, so a resume points at the next increment instead of counting to it. Read the spec frontmatter while you are there: if `status` is `review`, advance it to `impl` (implementation has begun).
2. **Dependency gate** — if any `depends_on` TODO is not yet `status: done`, set this TODO's `status: blocked`, report, and stop. Never implement past an unmet dependency.
3. **Start, in the checkout the pair names** — resolve `where` (`arch:ref-write.md` § Where the work happens): `TODO-N.md` frontmatter wins, and its `inherit` — or a missing key — falls back to `spec.md`, whose own missing key is `in-place`. Under `in-place` stay in the current checkout. Under `worktree`, enter a worktree **before any edit** — the `worktrunk:wt-switch-create` skill, steps 1–3 — so every increment, commit, and autotest below happens there, on the branch § Where the work happens names. Already inside that worktree on that branch? Stay; a second worktree for one TODO splits the commit across two trees. Carry the resolved path into every later step — each @implementer prompt, each test run, each `git` call. Then set the TODO frontmatter `status: todo → impl`. Leave `increment` alone: step 5.5 owns it, and raising it here claims an increment the commit does not hold.
4. **Replan guard** — if the TODO's assumptions no longer hold (the code moved, a dependency changed), stop and report instead of forcing the plan.
5. **Land the skeleton, then implement increment by increment.** The **skeleton** is every new symbol of the TODO with no body: the all-`+` lines of every increment's **Surface** diff — new types, fields, function and method signatures, transition and table rows — with each new body a stub that fails when called (Go `panic("not implemented")`, Python `raise NotImplementedError`). A changed signature (`-`/`+`) stays in its increment. Before increment 1, send the skeleton to the @implementer as increment `0`, then run 5.2–5.5 on it as on an increment, with no progress stamp: review target `TODO-N/inc-0`, and the skeleton creates the TODO commit. It must build. A new symbol in it that no **Surface** diff declares is a replan (step 4) — the shape the human approved is the only shape that lands. Skip the skeleton when no **Surface** diff adds a symbol. On resume at `increment: 0/<total>`, the skeleton has landed when `git log` holds the `## Commit` title. Then walk `TODO-N.md` `## Increments` in order and, for **each** increment, do these in this order. The ruleset says which of 5.2–5.4 run per increment and what runs after the last one instead:
   1. **Read, then do — in the @implementer** (a new one, or the reused one, as the ruleset says) — send it the checkout path, the pair's paths, and this increment's number in `## Increments`, then wait for its report. The subagent reads the `## Files` lines keyed to this increment and the **Pre-reads** that name them (step 1 deliberately left them unread), then carry out its **Do**. **Files** is where to start, not a border: change a file outside it when the **Do** needs it, and name each such file when you report the increment. Never stop to ask which files outside **Files** you may edit — this rule is the answer. The increment's **Surface** diff is the shape of every symbol it names; write the bodies behind those signatures yourself — from the increment's **Behavior** sketch where it has one, and the repo's own idiom otherwise. **After the skeleton, an increment fills bodies and changes the signatures its diff names; it adds no new type, function, or method** — one it needs is a replan (step 4). **Do** names the call sites to migrate; migrate all of them. A symbol no increment diff covers, or a **Do** that cannot be carried out against the real code, is a replan (step 4), not a guess. Each trap found here — by the subagent or by this session in 5.2 and 5.4 — is appended to `TODO-N.agent.md` `## Gotchas` before the next edit (`arch:examples/todo-agent.md` § Gotchas): a compact or a handoff keeps only what is in a file.
   2. **Gate the increment before any human reads it** — run the review the ruleset names and fix what it rejects, until every gate is green (§ Gate review).
   3. **Show** the diff as the ruleset says.
   4. **Wait for approval** as the ruleset says. A correction the pair forbids goes through § When a correction contradicts the pair before any edit lands.
   5. **Append to the commit** — the skeleton, or increment 1 when no skeleton ran, creates the commit (`TODO-N.md` `## Commit` message); every later increment is appended to that same commit with `git commit --amend --no-edit`. Exception: an increment that exists **because the user rejected or corrected a shown diff** is a user correction — commit it per `sub-commit.md` § Fixups, never amend it away. Then **stamp the progress**, in two places: flip this increment's `**Landed:** no` to `yes` in `TODO-N.md` § Increments, and raise `TODO-N.md` frontmatter `increment: <approved>/<total>` by one. Both after the commit or amend, never before — they are facts about the commit, and a marker or number ahead of it sends the next session's resume past an increment nobody applied. Both in the same step, so `spec-lint.py` check B11 never sees them disagree. This substep runs under every ruleset.

   Never re-order the increments: the sequence is deepest-first so the repo builds after each. Bug fix? Follow the `red-green-refactor` skill (Red → Green → Refactor); never skip the failing test — the failing test is its own first increment.
6. **Glossary** — if the change introduces or renames a domain term, get the user's approval and write the row into `<notes-dir>/GLOSSARY.md` in the same commit (`code:ref-subcommand-rules.md` § Glossary). For each entry whose **Code** identifier this commit lands, fill **Code** and set `Status: existing`. Run `${CLAUDE_PLUGIN_ROOT}/bin/glossary-lint.py <notes-dir> --code <checkout>`; a finding this TODO added is fixed before step 8.
7. **Autotest** — run **both** commands in `TODO-N.test.md` `## Autotest`: `Unit` and `E2E`. Both green before committing (a level written `none` is skipped with its reason quoted in the report). The Cases are sentences, not test source — write each test from its case. Then run each `TODO-N.agent.md` `## Manual test` step this checkout can run and compare it to its **Expected**; a step only a human can run goes to the step 9 report. The ruleset says what the tests must cover.
8. **Finalize the commit** — the commit already exists, built by step 5. On green, make its message match the `commit-message` skill (`TODO-N.md` `## Commit` is the primary message) and fold in any test/glossary edits with `git commit --amend`. Check `increment` reads `<total>/<total>` before advancing — a lower number means an increment never landed, and the TODO is not finished. Then advance the TODO frontmatter `status: impl → verify` and fill the ledger row's Commit. The ruleset says what sets `done`.
9. **Report** — open with **the outcome in plain words**: one or two sentences saying what the system does now that it did not do before, written for the person who asked for the TODO. Use the domain words from `TODO-N.md` § Outcome and `<notes-dir>/GLOSSARY.md`; keep out symbol names, file paths, type names, and the word *increment*. "Exports now carry the run they came from, so two runs no longer look like one" — not "`write_columns` takes `run_id` and stamps it into the spec". A reader who cannot see the diff must be able to tell from this line whether the TODO delivered what they asked for. Then state what shipped, the resolved `approve` and which level set it (copy the ruleset header), how many increments landed, how many gate rounds the reviews spent in total, the TODO's new `status`, the test command + its real output, each Manual test step with its real result or marked for the human, plus what the ruleset adds to the report, and stop. When `where` resolved to `worktree`, name the worktree path, the branch, and which level set it, and say the branch is unmerged — `/code squash` is the command that collapses the fixups and merges it, and it is the human's to run. One TODO per invocation.

A correction the user does make, under any ruleset, routes through § When a correction contradicts the pair.

## Change table

A subagent writes the typed table of changes from the diff alone: its prompt carries the diff and
`impl:ref-change-types.md`, and the session names no path in it. The subagent finds each change and
assigns one kind; the session shows the table it returns. Shape: `impl:examples/change-table.md`.
The human reads it first: it separates the `new behavior` and `signature change` rows they must read
line by line from the `wiring`, `call-site migration`, `rename`, `move`, `deletion`, `test`, and
`generated` rows they only skim.

## Gate review

**Every human gate reads a gate-clean diff.** The ruleset names the review — the increment review or
the TODO review — with its speed, diff, and report target (`review:SKILL.md` § Speed). The gates own
the judging; this skill owns the fix, because it is the only skill that edits source.

1. **Run the review** with the speed, diff, and target the ruleset names. A gate that reads more
   than its diff judges the increments before it a second time.
2. **Fix every Failure, then re-run the review.** A fix can break what another gate already cleared, so no verdict
   survives an edit (§ Any FAIL restarts the whole chain). A gate whose input the fix did not
   change is skipped as PASS (§ A gate whose input did not change passes without running). From round 2,
   give @rule-reducer the `settled:` lines (§ From round 2, the reducer's brief carries what
   earlier rounds settled). A test the TODO review's test gate writes is amended into the commit.
   Nits are reported to the human with the diff and block nothing.
3. **Stop at three rounds per gate** (`review:ref-gates.md` § The gate budget). A gate that spends
   its budget stops the increment, or the TODO in the TODO review: set `status: blocked`, report
   the last findings and the round count, and apply nothing after it. Never show a human a diff a gate still rejects — a blocked
   increment is reported, not approved.

**A fix here is part of the increment, not a fixup.** It lands before 5.5 and is amended in with the
rest of the increment. A TODO review fix is amended into the one commit. `sub-commit.md` § Fixups covers user corrections — a human rejecting a shown
diff — and no gate is a human.

## When a correction contradicts the pair

The user corrects a shown diff, and the correction cannot be carried out without breaking a section
of the pair — an increment's signature, a rule the constraint generator prints, an Autotest case, the Outcome itself.
Never carry it out silently, and never redesign the pair yourself. **Ask the user which route to
take** — one question, inline, `AskUserQuestion`, because the increment stops until it is answered
(`code:ref-subcommand-rules.md` § Put a batch of questions in a file the human edits) — and say
which one you recommend and why:

| Route | Take it when the correction… | What happens |
|---|---|---|
| **revise** *(recommended for a big blast radius)* | reaches past this TODO — another TODO's symbol or Files list, a ledger row or wave, a settled `decision` / `fact` note other TODOs cite, or the Outcome of this TODO | Stop implementing. Set `status: blocked`, hand the correction to `arch:sub-revise.md`, and resume only against the revised pair. Nothing after the corrected increment is applied. |
| **deviation** | stays inside this TODO — a symbol only this TODO owns, an Autotest case only this TODO asserts, a choice the spec left open | Record it (below) and keep implementing. The spec `status` does not move. |

Measure the blast radius before you recommend: grep the other TODOs' `## Increments` and `## Files` for
the symbol, and run the `trace` skill against what the correction breaks — a chain rooted in a
`decision` or `fact` note is a spec-level choice, one rooted in an `impl-decision` note written for
this TODO is not. A correction that contradicts a printed rule is always spec-level. Unsure → recommend `revise`. A deviation is cheap to record and expensive to be wrong about:
it leaves every other TODO obeying a decision the code no longer keeps.

**Recording a deviation**, in this order, before the next increment:

1. Write `thoughts/NNN-impl-decision-<slug>.md` with `todo: TODO-N` — Context is what the pair said,
   Decision is what ships instead, Alternatives holds the pair's version and why it lost. Format:
   `arch:ref-note-format.md`; shape: `arch:examples/note-impl-decision.md`.
2. Append one row to `TODO-N.md` `## Deviations` — the section, what shipped, why, and the note.
   The sections above stay untouched: they are what the human approved at the gate.
3. Commit the correction as a fixup (`sub-commit.md` § Fixups) — a user correction is never amended
   into the increment's commit.

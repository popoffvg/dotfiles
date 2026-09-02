# code — impl

Execute **exactly one** TODO end-to-end, then stop and hand back. One TODO ships one deliverable as
one commit plus its fixups, built increment by increment (`arch:sub-todo.md` § Changes). How much of
it the user approves — each increment's diff, the TODO's diff once, or nothing — is the `approve` key,
read off `TODO-N.md` and off `spec.md` behind it (`arch:ref-write.md` § Approval). `squash` collapses the fixups back into
the one commit.

Obeys the shared subcommand rules — see `code:ref-subcommand-rules.md`.

Always call @implementer with background: true for implementation.

**Every approval (step 5) happens in this session, not in the background agent** — a background
agent cannot ask the user anything. Delegate one increment's edit to @implementer at a time and
bring its diff back here for approval, or apply small increments directly.

## Steps

1. **Read context, staged — never the whole citation list up front.** Read **both halves of the pair** in full: `<notes-dir>/todos/TODO-N.md` (frontmatter, Outcome, Components, **Surface** — the exact shape every changed symbol must end up with — Autotest, Commit) and `<notes-dir>/todos/TODO-N.agent.md` (the increments, Files, Pre-reads — the order to do the work in). Read `<notes-dir>/CONSTRAINTS.md` in full too: it is short, and it is where every rule the code must satisfy lives. Keep § Surface open throughout: it is the one diff, and every increment lands part of it. The pair plus that file is self-contained; together they alone say what to build. **Leave `thoughts/` closed** — it holds why each rule was chosen, never a requirement, and reading it spends context on notes the work does not need. The `trace` skill opens it when a decision turns out to be wrong. Of the files they cite, read only what the increment you are about to apply needs — that increment's **Files**, and the **Pre-reads** those files name. Every later increment's pre-reads are read in step 5, when you reach it. A TODO's Pre-reads list can span many files in several repos; reading all of them before increment 1 spends the whole session's context on files increment 1 never touches. The hard rules every subcommand obeys: `code:ref-subcommand-rules.md`. Read the `approve` key too — it says how much of step 5 the user sees (`increment` / `todo` / `none`): `TODO-N.md` wins, and its `inherit` (or a missing key) falls back to `spec.md`, whose own missing key is `increment`. Read the spec frontmatter while you are there: if `status` is `review`, advance it to `impl` (implementation has begun).
2. **Dependency gate** — if any `depends_on` TODO is not yet `status: done`, set this TODO's `status: blocked`, report, and stop. Never implement past an unmet dependency.
3. **Start** — set the TODO frontmatter `status: todo → impl`.
4. **Replan guard** — if the TODO's assumptions no longer hold (the code moved, a dependency changed), stop and report instead of forcing the plan.
5. **Implement increment by increment** — walk `TODO-N.agent.md` `## Changes` in order and, for **each** increment, do all four in this order:
   1. **Read, then do** — read this increment's **Files** and the **Pre-reads** that name them (step 1 deliberately left them unread), then carry out its **Do**, touching nothing outside its **Files**. The increment carries no diff: take the shape of every symbol it names from `TODO-N.md` § Surface, and write the bodies behind those signatures yourself — from the increment's **Behavior** sketch where it has one, and the repo's own idiom otherwise. **Do** names the call sites to migrate; migrate all of them. A symbol § Surface does not cover, or a **Do** that cannot be carried out against the real code, is a replan (step 4), not a guess.
   2. **Show** the user the real `git diff` of what landed, next to the increment's predicted **Blast radius**, and above it **the typed list of changes** — one row per changed file, saying which of the nine kinds each diff is: `impl:ref-change-types.md`. The list is what the human reads first: it separates the `new behavior` and `signature change` rows they must read line by line from the `wiring`, `call-site migration`, `rename`, `move`, `deletion`, `test`, and `generated` rows they only skim. Say when the increment has no `new behavior` and no `signature change` row — it is mechanical, and the approval is one glance. Say when the real diff exceeds the predicted radius — that is the signal the plan is wrong. Under `approve: todo` or `none`, hold the diff instead of showing it here — see § Approval below.
   3. **Wait for approval.** Approved → continue. Rejected → stop, report which increment was rejected and why, set `status: blocked`; apply nothing after it. A correction the pair forbids goes through § When a correction contradicts the pair before any edit lands. Under `approve: todo` or `none`, this substep does not run per increment — § Approval says what runs instead.
   4. **Append to the commit** — increment 1 creates the commit (`TODO-N.md` `## Commit` message); every later approved increment is appended to that same commit with `git commit --amend --no-edit`. Exception: an increment that exists **because the user rejected or corrected a shown diff** is a user correction — commit it per `sub-commit.md` § Fixups, never amend it away.

   Never re-order the increments: the sequence is deepest-first so the repo builds after each. Under `approve: increment`, never batch two of them into one approval either. Bug fix? Follow the `red-green-refactor` skill (Red → Green → Refactor); never skip the failing test — the failing test is its own first increment.
6. **Glossary** — if the change introduces or renames a domain term, get the user's approval and write the row into `<notes-dir>/GLOSSARY.md` in the same commit (`code:ref-subcommand-rules.md` § Glossary).
7. **Autotest** — run **both** commands in `TODO-N.md` `## Autotest`: `Unit` and `E2E`. Both green before committing (a level written `none` is skipped with its reason quoted in the report). The Cases are sentences, not test source — write each test from its case.
8. **Finalize the commit** — the commit already exists, built by step 5. On green, make its message match the `commit-message` skill (`TODO-N.md` `## Commit` is the primary message) and fold in any test/glossary edits with `git commit --amend`. Then advance the TODO frontmatter `status: impl → verify` and fill the ledger row's Commit. `done` is set by the `review:sub-todo.md` chain on PASS; FAIL → `blocked`.
9. **Report** — open with **the outcome in plain words**: one or two sentences saying what the system does now that it did not do before, written for the person who asked for the TODO. Use the domain words from `TODO-N.md` § Outcome and `<notes-dir>/GLOSSARY.md`; keep out symbol names, file paths, type names, and the word *increment*. "Exports now carry the run they came from, so two runs no longer look like one" — not "`write_columns` takes `run_id` and stamps it into the spec". A reader who cannot see the diff must be able to tell from this line whether the TODO delivered what they asked for. Then state what shipped, the `approve` loop you ran, which level set it, and how many increments were approved under it, the TODO's new `status`, the test command + its real output, and stop. Under `approve: todo` or `none`, put the **start point** and the main changes in the report too (`impl:ref-change-types.md` § The start point): under `none` it is the only place a human is told where the TODO changed the system. One TODO per invocation.

## Approval — what step 5 shows

The `approve` key (`arch:ref-write.md` § Approval) picks one of three loops. **Resolve it before
step 5**: read `TODO-N.md` frontmatter first, and fall back to `spec.md` only when the TODO says
`inherit` or carries no key at all. A `spec.md` with no key is `increment`.

| `approve` | Step 5.2 + 5.3 | What replaces them |
|---|---|---|
| `increment` | run for every increment | — |
| `todo` | do not run per increment | After the last increment, show the **start point** — the one `file:line` where the new behavior begins — then the main changes outward from it and the rest counted by kind (`impl:ref-change-types.md` § The start point), then one `git diff` of the whole TODO next to the **Blast radius** of every increment in it, and wait once. Rejected → name the increment the user rejects, `status: blocked`, and stop — the commit stays as it is until `revise` or a fixup settles it. |
| `none` | do not run | Nothing shown here. Go straight to step 6; the `review:sub-todo.md` chain is the only review. The start point and the main changes still reach the human — in the step 9 report. |

Two things hold at every setting: the commit is still built increment by increment (step 5.4), and a
correction the user does make still routes through § When a correction contradicts the pair. A
setting the user did not ask for is never assumed — read both keys, and say in the step 9 report which
loop you ran and which level set it.

## When a correction contradicts the pair

The user corrects a shown diff, and the correction cannot be carried out without breaking a section
of the pair — a `## Surface` signature, a `CONSTRAINTS.md` rule, an Autotest case, the Outcome itself.
Never carry it out silently, and never redesign the pair yourself. **Ask the user which route to
take** — one question, inline, `AskUserQuestion`, because the increment stops until it is answered
(`code:ref-subcommand-rules.md` § Put a batch of questions in a file the human edits) — and say
which one you recommend and why:

| Route | Take it when the correction… | What happens |
|---|---|---|
| **revise** *(recommended for a big blast radius)* | reaches past this TODO — another TODO's symbol or Files list, a ledger row or wave, a settled `decision` / `fact` note other TODOs cite, or the Outcome of this TODO | Stop implementing. Set `status: blocked`, hand the correction to `code:sub-revise.md`, and resume only against the revised pair. Nothing after the corrected increment is applied. |
| **deviation** | stays inside this TODO — a symbol only this TODO owns, an Autotest case only this TODO asserts, a choice the spec left open | Record it (below) and keep implementing. The spec `status` does not move. |

Measure the blast radius before you recommend: grep the other TODOs' `## Surface` and `Files` for
the symbol, and run the `trace` skill against what the correction breaks — a chain rooted in a
`decision` or `fact` note is a spec-level choice, one rooted in an `impl-decision` note written for
this TODO is not. A correction that contradicts a `CONSTRAINTS.md` row is always spec-level. Unsure → recommend `revise`. A deviation is cheap to record and expensive to be wrong about:
it leaves every other TODO obeying a decision the code no longer keeps.

**Recording a deviation**, in this order, before the next increment:

1. Write `thoughts/NNN-impl-decision-<slug>.md` with `todo: TODO-N` — Context is what the pair said,
   Decision is what ships instead, Alternatives holds the pair's version and why it lost. Format:
   `arch:ref-note-format.md`; shape: `arch:examples/note-impl-decision.md`.
2. Append one row to `TODO-N.md` `## Deviations` — the section, what shipped, why, and the note.
   The sections above stay untouched: they are what the human approved at the gate.
3. Commit the correction as a fixup (`sub-commit.md` § Fixups) — a user correction is never amended
   into the increment's commit.

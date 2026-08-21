# spec — write (the contract)

The single source for the spec contract: artifacts, layout, the **status** metadata (spec phase
+ TODO lifecycle), **the gate**, TODO ordering, and readiness.
Vocabulary: `wm:GLOSSARY.md`.

## Role

Architector, not executor. Write and edit only under `<notes-dir>/` (`CLAUDE.md`, `RULES.md`,
`spec.md`, `GLOSSARY.md`, `PATTERNS.md`, `thoughts/`, `todos/`). Read any file for planning. "add X" / "fix Y" → capture as a ledger row,
never as a code edit.

## Artifacts

```
<notes-dir>/
├── CLAUDE.md       # how to work with this corpus — map, read order, write rules (template: tpl-notes-claude.md)
├── RULES.md        # what to discuss directly at each step (template: tpl-rules.md)
├── spec.md         # the target picture + the ledger
├── GLOSSARY.md     # project ubiquitous language (template: tpl-glossary.md)
├── PATTERNS.md     # implementation patterns + reference files the implementer follows (template: tpl-patterns.md)
├── thoughts/       # NNN-{question,decision,fact,impl-decision}-slug.md — the thought graph
│   └── archived/   # answered questions + superseded thoughts — out of the live graph, kept for the trail
└── todos/          # TODO-N.md — one body per ledger row (authored by `todo`, past the gate)
```

- **`CLAUDE.md`** and **`RULES.md`** are written once, by `new` Step 0, and are never rewritten by a later subcommand. `CLAUDE.md` tells any agent entering the folder how to read and write it; `RULES.md` says which choices go to the human at each step. Every subcommand reads `RULES.md` before it starts and obeys it over its own defaults — a rule there never lowers a hard gate (the `review→impl` read, destructive-git confirmation).
- A thought that stops being live moves to `thoughts/archived/` — a question once answered (`ref-note-format.md` § Resolution), a decision once superseded (§ Superseding). Never deleted, never left in the live graph; the `thoughts-archive.sh` hook performs the move.

- **`spec.md`** is read by humans + the audit — the **target picture** plus the **ledger** plus the **Plan**. No bodies, no checkboxes, no file paths.
- **Decisions and open questions are not spec sections.** Every choice, every fact, every unresolved question is a note in `thoughts/` — `spec.md` has no `Design Decisions` and no `Open Questions` section, and the Plan carries no decision-trail table. One place per thought; `spec.md` says what the world will look like, `thoughts/` says why.
- **ledger** = the TODO List, an index of **outcomes** (one `#### TODO-N` entry each, with `Layer` / `Outcome` / `Concretely` / `Commit` lines). The outcome is the discussion object — the user aligns on outcomes here before any body exists. Unclear or contested outcome → the spec is not ready. An outcome the user cannot *read* is contested by default, which is what `Concretely` exists to prevent (§ spec.md template).
- **`PATTERNS.md`** is read by the implementer, not the human — the patterns and reference files a TODO's increments follow. Nothing in it needs human agreement, which is why it is not a spec section: `spec.md` mentions `@PATTERNS.md` and carries none of the content.
- **`todos/TODO-N.md`** is read by a context-free Sonnet implementer — self-contained, restating its ledger outcome verbatim at the top. Owned by `todo` (`sub-todo.md`).
- **thought** — one note per question asked and one per answer given, linked by `[[wikilinks]]`. Format + templates: `ref-note-format.md`.
- History lives in the notes' jj repo (`jj log`) — `code:ref-jj-notes.md`.

## Status — metadata, not prose

Every `status` lives in **YAML frontmatter**, never as a body header line. `spec.md` and each
`todos/TODO-N.md` open with a `---` block; the body below it is human prose only. Two machines:

### Spec phase — `spec.md` frontmatter `status`

```
init (research)  →  review (spec + ledger)  →  impl
                         ▲                       │
                         └──────── revise ───────┘
```

- `init` — research; spec is a stub.
- `review` — spec + ledger authored, under human review. `todo`, `verify`, `revise` run here.
- `impl` — TODOs implemented, one commit each. Any `revise` returns the spec `status` to `review`.

Set by: `new` (`init → review`), `impl` (`review → impl`), `revise` (`→ review`).

### TODO lifecycle — `todos/TODO-N.md` frontmatter `status`

Forged like the spec's, one per TODO:

```
todo  →  impl  →  verify  →  done
  ▲        │         │
  │        └── blocked ──┘   (dep unmet, or verify DEVIATES)
  └──────────────┘           (revise reopens a diverged TODO)
```

- `todo` — body authored past the gate; not started.
- `impl` — the implementer is executing it (set at `impl` start once every `depends_on` TODO is `done`).
- `verify` — committed + autotest green; awaiting the review gate (`reviewer` / `verifier`).
- `done` — review passed; the ledger entry's Commit is filled.
- `blocked` — a `depends_on` TODO is not `done`, **or** the review returned FAIL / DEVIATES. Routes back to `impl`.

Set by: `todo` (writes `todo`, or `blocked` if a dep is unmet), `impl` (`todo → impl`, then `→ verify` on green; `→ blocked` if a dep is unmet), the review gate (`verify → done` on PASS, `→ blocked` on FAIL), `revise` (`→ todo` when it reopens a diverged TODO).

**The gate** sits at the spec's `review→impl` boundary. `new` produces a reviewable spec and stops; a
human reads Goal, `thoughts/`, GLOSSARY.md, the ledger, and the Plan; only then does `todo` author bodies.
Bodies are never auto-written — a wrong spec authored into TODOs becomes wrong code.

**One half of the gate is enforced, not trusted.** The `guard.sh` PreToolUse hook reads every
`Edit`/`Write` on a `spec.md`. When the new text sets `status: impl` and the sibling `thoughts/` still
holds a `status: open` question, the hook denies the edit and prints the open questions — so
implementation cannot start on an unanswered spec, whatever the agent believes. Answer the question
first: write the answer as a new `decision` or `fact` note, which archives the question
(`ref-note-format.md` § Resolution). The other half — the human
actually reading the spec — no hook can check.

## Reading chain — what the understanding must capture

Not a recipe for reading order — investigate however the code forces. It is the criterion the
resulting spec is graded on: capture these six, in order, so a reader follows the chain from
entry to trace **without reopening the codebase**. Tests (front) and the one-sentence **trace**
(end) are completeness gates — miss either and the understanding is incomplete.

| # | Element | spec.md section | Must show |
|---|---------|-----------------|-----------|
| 1 | **Entry point** | Description / Goal | The exact line the request enters — handler, dispatch, subscriber — not the top of the file. |
| 2 | **Tests** *(front gate)* | Goal + `thoughts/` | The happy-path test stating the contract, and the intent each test pins. No test on the path → mark **UNTESTED**. |
| 3 | **Follow data** | GLOSSARY.md | One value's lifecycle — born, mutated, transformed, exits. The flow falls out of the data. |
| 4 | **Skip noise** | What we're NOT doing | What was walked past (rate limiters, audit logs) — stated so gaps read as intentional. |
| 5 | **Failure path** | GLOSSARY.md + `thoughts/` | One failure path the spec depends on: does the response leak cause (different message or timing)? |
| 6 | **One-sentence trace** *(end gate)* | Goal → feeds ordering | Entry→exit in one line. Can't state it in one sentence → the flow wasn't understood. |

If `<notes-dir>/research/` exists, consume those artifacts — they already encode this chain (owned by `explore`) — rather than re-deriving.

## spec.md template

One audience: the human at the gate. Description, Goal, What we're NOT doing, the ledger, the
Plan — everything the reviewer reads to judge whether the target picture is right, the ledger
included, since the outcomes are the discussion object the user aligns on.

A section belongs here only if a human must verify it. What only an agent consumes is not a spec
section: the implementation patterns and reference files live in the sibling `PATTERNS.md`
(template: `tpl-patterns.md`), which the spec mentions and does not restate.

```markdown
---
status: init          # init → review → impl  (phase machine + rules: ref-write.md § Status)
branch: <git branch at init>   # the branch this spec belongs to; set once at init. See § Spec ownership by branch
drives: <one sentence — what this work delivers, user-facing>
---

# Spec

## Description
<what this work is about, 2–5 sentences>

> Terms live in the sibling `GLOSSARY.md` (template: `references/tpl-glossary.md`), current every phase.
> Implementation patterns live in the sibling `@PATTERNS.md` — the implementer reads it; this spec does not restate it.

## Goal

Plain-language user-visible outcome once this spec is done. 2–5 sentences. No IDs, no checkboxes, no TODO references.

> Example: "Users with an expired session keep working without re-logging in: the SDK silently refreshes on the first 401, and the server invalidates the previous refresh token on every rotation, behind the existing `auth.v2` flag."

## What we're NOT doing

> Explicit out-of-scope list — the scope-creep guard a reviewer checks by exclusion. One line each.

- <out-of-scope item> — <why deferred / where it belongs>

> Decisions live in `thoughts/` as `NNN-decision-*.md`, open questions as `NNN-question-*.md` — never as sections here. A choice made while writing this spec that has no note yet is an unrecorded thought: write the note, then continue.

## TODO List (the ledger)

> Index only — outcomes, not bodies. Each row is a discussion object the user aligns on before any body is drafted. Rows are sorted deepest layer first (a legal order); the `## Plan` wave table below says what actually runs together. Bodies live in `todos/TODO-N.md`, restating the outcome verbatim.

#### TODO-1
**Layer:** L0 — leaf
**Outcome:** <observable result after this TODO, user/system-facing>
**Concretely:** Today <what the code does now>. This <what the work does to it>. Done when <the check that settles it>.
**Commit:** `<commit subject, ≤ 72 chars, imperative>`
**Why:** <commit body — the problem or constraint that forced this commit, and what breaks without it>

> Outcome rules — post-condition, ≤ 25 words, GLOSSARY.md terms only, no implementation nouns. Full rules and examples: `sub-todo.md` § Outcome. If a row hides an "and", split it; if two rows share an outcome, merge them.

> **`Concretely` is the plain-language twin of `Outcome`, and it is not optional.** The name avoids
> `Changes`, which in a TODO body means the ordered increment sequence (`sub-todo.md` § Changes) — a
> different thing entirely. `Outcome` is written
> for *correctness* — abstract, glossary-bound, checkable against the Goal. That same discipline makes
> it unreadable to anyone who does not already hold the design: "An objective is three named parts"
> tells a reviewer nothing about what will happen to the repo. `Concretely` is written for
> *comprehension*, in three fixed beats:
>
> - **Today …** — the current behaviour, concretely. This is the beat that makes the row legible: a
>   reader who knows what it does now can judge whether the change is right.
> - **This …** — what the work does to that, in a verb a non-author would use (*moves, deletes,
>   teaches, throws away, puts the choice in the user's hands*) — never *improves, handles, wires up*.
> - **Done when …** — the observable check. A pure refactor's is often *"output is byte-identical
>   before and after"*; that is a real check and the strongest one such a row can have.
>
> Implementation nouns are **allowed here** — module and symbol names are what make "today" concrete.
> The ban on them applies to `Outcome` only. Keep it to 2–4 sentences; longer means the row is two rows.
> A `Concretely` that could be written without opening the repo is wrong: it is a paraphrase of
> `Outcome`, not a description of the change.

## Plan

<target picture in 3–5 sentences, one per major branch of the work>

### Waves — parallel execution

| Wave | TODOs | Runs together because |
|------|-------|-----------------------|
| W1 | TODO-1, TODO-2 | no `depends_on` between them; **Files** sets disjoint |
| W2 | TODO-3 | `depends_on: [TODO-1]` |

> Widest wave first. The wave table is the execution order; `Ln` only proves the dependency edges are legal (§ TODO ordering and waves).
```

Rules:
- spec.md ends after the Plan.
- TODO numbers match `todos/TODO-N.md` filenames 1-to-1.

## Write it for a reader who does not hold your context

The gate is a human read. A spec that is correct and unreadable fails the gate for the same reason a
wrong one does: the reviewer cannot tell whether it is right. These four rules come from real gate
failures — each one is a place a reviewer stopped and asked "what does this mean?".

- **Name a symbol in words at first use.** `α`/`β`, `w_struct`, `k`, `top-k` mean nothing to a reader
  who has not read the atom that minted them. Write what the quantity *is* — "how well the fold
  tolerates the edits (`α`) and how human it became (`β`), both defaulting to `1.0`, so they count
  equally" — then use the symbol. A bullet whose meaning lives in a cited line number is a bullet the
  reviewer will skip.
- **Turn rationale prose into an ordered list.** Three or more reasons chained through "and … so …
  because" is unreadable at review speed. One numbered line per step, each with its own reason, beats
  one dense paragraph containing the same words. If the order matters, the list *shows* the order.
- **State the parameter surface as a table when the work adds one.** `| Parameter | Default | What it
  moves |`. Then say what is **not** added and why — an absent knob is a design decision, and a
  reviewer cannot check a decision that was never written down.
- **Draw the change when it is structural.** A pipeline gaining a step, a new branch, a moved
  boundary: one mermaid diagram with the new parts marked, plus one sentence naming **what does not
  move**. The unchanged part is the half a reviewer needs in order to bound the blast radius, and it is
  the half prose always omits.

**The test.** Hand the spec to someone who has not read `thoughts/`. Every row should let them say what
will happen to the repo and how they would know it worked. If they cannot, the spec is not ready — and
no amount of citation density fixes it.

## Spec ownership by branch

The frontmatter `branch` ties a spec to the work it was written for. Set it once, at init, to the
current git branch (`git rev-parse --abbrev-ref HEAD`); never rewrite it afterward.

On any `new` where `spec.md` already exists, decide iteration vs. a fresh spec by the branch match:

- **Current branch shares part of `branch`** (either contains the other as a substring — e.g. meta `feat/auth-refresh` and current `feat/auth-refresh-fix`) → same work, **iterate** the existing spec.
- **No shared part** → the notes belong to unrelated work; treat this as a **new spec** — author a fresh minimal spec and set `branch` to the current branch. The prior spec is not lost: it stays in the notes jj history (`code:ref-jj-notes.md`).

Rationale: `.notes/` is git-ignored and travels with the working tree, so switching to an unrelated branch leaves a stale spec behind. The branch match is the signal for "is this still the same work?".

## TODO ordering and waves

Sort so each commit touches only its own **layer** and layers below it. Dependency edges point
upward (callers depend on callees); commits land the same direction — leaf → trunk → wiring.

1. Sketch the call graph from entry to deepest dependency (use the Description / research artifacts).
2. Assign each touched component a depth `Ln`: `L0` = leaf (talks to DB/RPC/OS/IdP, or an interface nothing in the change set calls); `Ln` = calls one or more `L<n`; `Lmax` = startup / `main.go` / wiring.
3. Group outcomes into commits per layer; sort the ledger by ascending depth.
4. A TODO never precedes the TODO introducing a lower-layer component it depends on. If it must, merge them.

The `Ln` prefix makes the ordering invariant machine-checkable.

**Why deepest first:** a leaf commit compiles and tests in isolation (no stubs); upper layers never rewrite when a leaf detail changes; the diff reads in narrative order (new thing → what uses it → how it starts up); reverting the topmost TODO still compiles.

**Merges that fall out of this rule:**
- A type split + the call site depending on the new types = **one** TODO. Two would force a dead intermediate state where the type exists but nothing populates it.
- Wiring that branches on one config flag = **one** TODO. The branch is mechanism, not outcome.
- An **enabler** with exactly one consumer — a shared package, an asset, a fixture, a taxonomy — is **not its own ledger row**. It is increment 1 of the slice that consumes it, by the same rule: alone it is a dead intermediate state, it cannot state an Outcome as a capability, and its `E2E` can only be `none`. Two exceptions keep it a row: it lives in **another repo**, so it cannot share the one commit; or it has **two or more consumers**, where a `W1` interface row with its implementations in `W2` removes an edge (§ Waves step 4).

**Reject:** ordering by "easiest first" or "most visible first" — that compiles only after every TODO lands, breaking the per-TODO commit contract.

### Waves — group for maximum parallelism

The layer sort gives a legal order; the **wave** grouping gives the fastest one. Two TODOs run in
the same wave when nothing forces them apart:

1. Compute the edges: TODO-B depends on TODO-A if B's **Files** include a file A creates, B calls a symbol A introduces, or B's test cannot pass until A lands. Record each edge as `depends_on` in B's frontmatter — that list, not the `Ln` order, defines the waves.
2. `W1` = every TODO with `depends_on: []`. `Wn` = every TODO whose deps are all in earlier waves.
3. Two TODOs in one wave must have **disjoint Files sets**. Overlapping files in one wave = two implementers editing one file; split the wave or merge the TODOs.
4. Write the wave table into `## Plan`. Widest wave first is the goal, not an accident: prefer a split that removes an edge (e.g. add the interface in `W1`, both implementations in `W2`) over one that adds a chain.

**Maximize wave width when splitting.** A chain of four TODOs each depending on the last is the
worst shape — it serializes the whole spec. If two outcomes touch different packages, they are two
TODOs in the same wave, even when one is small. Only a real edge from step 1 justifies a later wave.

`Ln` stays: it proves each edge points downward (a TODO never precedes the TODO introducing a
lower-layer component it uses). Waves say what can run at once; layers say the edges are legal.

## Stop at the gate

`new` (and its condensed variant for ≤3 TODOs) writes the ledger and stops. It does not write
bodies and does not chain into `todo`. Why split: spec.md must be reviewable on its own — the
outcome list is, full bodies bury the discussion in implementer-grade detail. Body authoring has
its own audience and bar, owned by `todo`. The user decides when the outcomes are right.

## Spec-Readiness Checklist

The definition of READY. `verify` Phase 0 runs these; `new`/`revise` self-check against them.

- [ ] `spec.md` opens with a `---` frontmatter block (`status`, `branch`, `drives`); no `Status`/phase-rules prose in the body
- [ ] `## Plan` carries the target-picture summary (absent only while `status: init`)
- [ ] `spec.md` body has Description, Goal, What we're NOT doing, the ledger, and the Plan — nothing else. No `Design Decisions`, no `Open Questions` section, no `Implementation Guidelines`, no decision-trail table
- [ ] Implementation patterns sit in `PATTERNS.md`; `spec.md` mentions `@PATTERNS.md` and carries no pattern content
- [ ] `spec.md` is ≤ 200 lines — over budget → move detail to `thoughts/` or split the spec, never shrink the ledger. The `budget-check` hook counts this on every write and blocks (`arch:sub-todo.md` § Budget)
- [ ] `GLOSSARY.md` exists (sibling), covers every entity/command/event in the spec, and is current
- [ ] `CLAUDE.md`, `RULES.md`, and `PATTERNS.md` exist in the notes dir; `RULES.md` carries the four answered knobs, no `<…>` placeholder left
- [ ] Every answered question and superseded thought sits in `thoughts/archived/` — marked, and moved by the hook; no live note links to an archived one
- [ ] **No `status: open` question note in `thoughts/`** (hard block) — `~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts` exits 0. The `guard.sh` hook re-checks this the moment an edit sets `spec.md` to `status: impl`, and denies the edit
- [ ] Every decision made while writing the spec has a `thoughts/NNN-decision-*.md` note
- [ ] The ledger is a list of `#### TODO-N` entries, each with `**Layer:**` / `**Outcome:**` / `**Concretely:**` / `**Commit:**` / `**Why:**` lines — no bodies, no checkboxes, no file paths
- [ ] Every `Commit` is a ≤ 72-char imperative subject and every `Why` states the reason the commit exists
- [ ] Every `Concretely` has all three beats — **Today …** (current behaviour, concretely), **This …** (the change, in a verb a non-author would use), **Done when …** (the observable check) — and names something that required opening the repo. A `Concretely` that paraphrases its own `Outcome` is not one
- [ ] No bare symbol (`α`, `β`, `w_struct`, `top-k`) appears without its meaning in words at first use; no parameter is added without a `| Parameter | Default | What it moves |` row and a line on what was deliberately **not** added; a structural change carries a diagram naming what does **not** move (§ Write it for a reader who does not hold your context)
- [ ] `## Plan` carries the wave table; every TODO appears in exactly one wave; TODOs sharing a wave have disjoint **Files** sets and no `depends_on` between them
- [ ] Every outcome is a post-condition (what is true after), ≤ 25 words, no implementation nouns, GLOSSARY.md terms verbatim
- [ ] No outcome hides two behind "and"; no two entries share an outcome
- [ ] No row is an **enabler with one consumer** — a shared package, asset, fixture or taxonomy whose only reader is one other row belongs to that row as its increment 1 (§ Merges that fall out of this rule). It stays a row only for another repo, or for two or more consumers
- [ ] Not every row defers its `E2E`: at least one row in the **first wave** proves a capability end-to-end, so the design gaps surface in `W1` rather than the last wave
- [ ] Entries are contiguous from 1, sorted by ascending `Ln` depth; no TODO depends on a component a later TODO introduces
- [ ] Nothing was written under `todos/` during this spec pass
- [ ] Description + Goal convey the target picture in plain language
- [ ] Format/protocol decisions have a `thoughts/NNN-decision-*.md` note, not deferred into bodies

## Interpreting user input

| User says | You do |
|-----------|--------|
| "add X" / "fix Y" | Update Description / Goal + GLOSSARY.md, write the thought note for any choice it forces, **and** add or revise a ledger row (+ its wave). No body file — that's `todo`. |
| "the outcome of TODO-N should be Z" | Edit entry N; confirm it follows the outcome rules. |
| "split TODO-N" / "merge N and M" | Rewrite the rows, renumber contiguously, recompute the `## Plan` waves. |
| "use approach Z" | Write a `thoughts/NNN-decision-*.md` note (and restate it in the `## Constraints` of each TODO whose increments can violate it — not in every TODO the note touches). |
| "looks good" | Signal readiness. |
| Option selection ("option A") | Execute immediately, don't re-ask. |

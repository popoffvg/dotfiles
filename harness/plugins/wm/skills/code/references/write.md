# spec — write

## CRITICAL RULES

**You are a planner, not an executor.**

- **DO NOT** write code, edit files, run tests, or make any changes outside `<notes-dir>/`.
- User says "add X" → add as TODO. User says "fix Y" → add as TODO.
- You may create/edit files under `<notes-dir>/` ONLY (`spec.md`, `worklog.md`, `todos/*.md`).
- You may READ any file for planning purposes.

## Contract

Spec structure is defined entirely by this skill. There is no separate constraint layer — every rule below is the contract.

- `<notes-dir>/spec.md` contains: Description, Terms, Implementation Guidelines, Goal, Design Decisions, **TODO List**. The TODO List is an index — `TODO-N | Outcome | Commit` rows only, **no bodies**.
- **Outcome = the discussion object.** Each TODO entry in spec.md is a single line stating the observable result that TODO must produce. The outcome is what the user and planner discuss and align on before any TODO body is written. If the outcome is unclear or contested, the spec is not ready.
- `<notes-dir>/todos/TODO-N.md` contains the full body of exactly one TODO. Each TODO file must restate the **same outcome** verbatim from spec.md's TODO List at the top of the file.
- Every TODO has a **Type** and a `## Changes` section described in TS pseudocode — see `flow` skill.
- **spec.md = target picture + outcome ledger.** Description + Goal answer "what does the world look like when this is done"; Terms + Decisions let a human validate the planner's mental model; the TODO List enumerates the discrete outcomes that get there.
- **Outcomes, not steps.** A TODO outcome describes *what is true after* the TODO is done (e.g. "users can refresh expired tokens silently"), not *what the implementer does* (e.g. "add refresh handler"). Outcomes are user-facing or system-observable; implementation belongs in the TODO body.
- **TODO authoring is a separate, user-initiated action.** This skill produces `spec.md` (including the TODO List with outcomes) and stops. It never writes TODO body files under `todos/` and never chains into `todo` — that skill runs only when the user manually starts it.
- Each TODO = one commit, try to keep them small and focused
- **TODO order = call-sequence depth, deepest first.** See *TODO ordering* below.
- Open design decisions live in `spec.md` **Design Decisions** — never hidden inside a TODO.
- **Terms** is one table covering entities, events, and commands — kept short so a human can read it and validate that the planner's mental model matches theirs. No separate sections for events/commands; they share the table via the `Kind` column.

## Spec layout

```
<notes-dir>/
├── spec.md              # target picture: description, terms, guidelines, goal, decisions
├── worklog.md           # timestamped action log
└── todos/
    ├── TODO-1.md        # full instructions for one implementer pass
    ├── TODO-2.md
    └── ...
```

**Why two layers:**
- `spec.md` is read by humans + verifier — target picture plus the TODO List of outcomes. The outcomes are the discussion surface: the user signs off on outcomes here before any body is written.
- `todos/TODO-N.md` is read by a dummy implementer (Sonnet) — must be self-contained, no guessing. Its first line repeats the outcome from spec.md so the implementer always knows what "done" means.
## Phase Flow

```
research → spec → spec-verify → implement → spec (iterate)
```

## Step 1: Assess current state

- **First planning** — no `<notes-dir>/spec.md` and no `<notes-dir>/todos/`.
- **Iteration** — read `<notes-dir>/worklog.md` + user feedback, identify what needs to change. Edit affected TODO files in place; renumber only if order changes.

## Step 2: Read context

Read all `<notes-dir>/*.md` and relevant source files. Collect implementation guidelines (patterns, conventions, project rules). Pre-read every file a TODO will touch.

### Reading chain — what the understanding must capture (artifact criteria)

This is **not** a recipe for how to read — investigate in whatever order the code forces. It is the criterion the resulting understanding is graded on: the spec must capture these six elements, in this order, so a reader can follow the chain from entry point to one-sentence trace **without reopening the codebase**. Each element answers the question the previous one raises. Tests (front) and the one-sentence trace (end) are completeness gates — miss either and the understanding is incomplete.

| # | Element | spec.md section a reader follows it to | What the spec's understanding must show |
|---|---|---|---|
| 1 | **Entry point** | Description / Goal | The exact line the request enters — route handler, command dispatch, event subscriber — not the top of the file. The chain starts here, not at line 1. |
| 2 | **Tests** *(front gate)* | Goal + Design Decisions | The happy-path test that states the contract before any implementation, and the intent each test pins. No test on the path → mark it **UNTESTED**; intent is unverified without it, and the spec's Goal/Outcomes have nothing to respect. |
| 3 | **Follow data** | Terms | One value's lifecycle — born, mutated, transformed, exits. The flow falls out of the data faster than from chasing call after call. |
| 4 | **Skip noise** | What we're NOT doing | What was deliberately walked past — rate limiters, audit logs, validators that don't alter the path — stated so a reader knows the gaps are intentional, not missed. |
| 5 | **Failure path** | Terms (failure events) + Design Decisions | One failure path the spec depends on: does the response differ by cause, does it leak (different message or timing) what it shouldn't? The happy path shows what the code does; the failure path shows what it gets wrong. |
| 6 | **One-sentence trace** *(end gate)* | Goal (feeds TODO ordering) | Entry→exit in one line. If it can't be stated in one sentence, the flow wasn't understood — only looked at. This trace is what the call-graph sketch (TODO ordering, below) and each TODO's Outcome are built on. |

The source-reading chain is also **artifact criteria owned by `explore`** — if `<notes-dir>/research/` exists, consume those artifacts (they already encode it) rather than re-deriving.

## Step 3: Write `<notes-dir>/spec.md` (target picture only)

### spec.md template

```markdown
# Spec

## Description
<what this work is about, 2–5 sentences>

## Terms

| Term | Kind | Notes |
|------|------|-------|
| RefreshToken | entity | Opaque token in Redis, TTL-bound |
| AuthHandler | component | Serves `/auth/*` |
| RotateToken | command | SDK → Session; emits `TokenRotated` or `AuthRefreshFailed` |
| TokenRotated | event | Old token invalidated, new pair persisted |

> Purpose: let a human reading the spec check that the planner's domain model matches their own.
> Kind ∈ `entity | value-object | aggregate | component | service | policy | state | command | event`.
> Commands use imperative names and note who issues them and which events they emit. Events use past-tense names.
> Keep it short — only terms that appear in the Description or Goal.

## Implementation Guidelines

### Skills
- `go-modify` — Go file edits
- `impl-commit` — commit conventions

### Coding Patterns
- <pattern from codebase, e.g. "handlers return structured errors via `pkg/errors.Wrap`">

### References
- `<path/to/example.go>` — reference for <pattern>

> If none found: "No project-specific guidelines — follow language defaults."

## Goal

Plain-language description of the user-visible outcome once this spec is done. 2–5 sentences or bullets. No IDs, no checkboxes, no TODO references.

> Example: "Users with an expired session can keep working without re-logging in: the SDK silently refreshes their token on the first 401, and the server invalidates the previous refresh token on every rotation. The change is rolled out behind the existing `auth.v2` flag."

## What we're NOT doing

> Explicit out-of-scope list. A reviewer verifies scope by what's *excluded*, not only what's included — this is the scope-creep guard. One line each.

- <out-of-scope item> — <why deferred / where it belongs instead>

## Design Decisions

> Record only hard-to-reverse, surprising, or high-cost choices. Routine picks don't belong here.

### <Decision title>
**Decision:** <oneliner — what was decided, one sentence>
**Motivation:** <why this was needed — problem, constraint, goal that made the choice necessary>

> **Writing Motivation — grill the user.** Don't accept surface answers. For each decision, use the grill-me loop: ask ONE question at a time, depth-first. Stop when you reach a root cause that is systemic (not a one-off) and actionable — the thing that, if fixed, prevents the whole class of problem. If the next "why" would repeat a previous answer or go philosophical, you've passed the root. Form is a sentence, but depth is the gate.

**Alternatives:** (omit if none were considered)
- `<Alternative>` — rejected: <reason>
- `<Alternative>` — rejected: <reason>

## Open Questions

> Unresolved decisions that block the spec. The `new` loop drives this list to empty. **A READY spec has zero open questions.** If one surfaces while writing, STOP and resolve it (explore the codebase or ask the user) before finalizing — never finalize a spec with unresolved questions.

- [ ] <question> — <what or who resolves it>

## TODO List
,
> Index only — outcomes, not bodies. Each row is a discussion object: the user
> aligns on these outcomes before any TODO file is drafted. Order = intended
> execution order. Bodies live in `<notes-dir>/todos/TODO-N.md` and must
> restate the same outcome verbatim.

| # | Outcome | Commit |
|---|---------|--------|
| TODO-1 | <observable result after this TODO, user/system-facing, one sentence> | `<commit subject, ≤ 72 chars, imperative>` |
| TODO-2 | <…> | `<…>` |

> Outcome writing rules:
> - Phrase as *post-condition* — what is true once done. ✅ "Expired sessions refresh silently behind the `auth.v2` flag." ❌ "Add token refresh handler."
> - 2–5 sentences. First sentence: capability (`<actor> can <action>`). Remaining sentences: context a reader needs without opening any other file — what triggers it, what changes, what fails silently vs. loudly.
> - No implementation nouns (file names, function names, packages). Use only Terms table vocabulary.
> - Must use terms from the Terms table verbatim where applicable.
> - If two TODOs share an outcome, merge them. If an outcome needs "and", split it.
> - `Commit` is the literal subject line the implementer will use (≤ 72 chars, imperative). Written here so the user sees the commit shape when reviewing outcomes.
```

**Rules:**
- spec.md ends after the TODO List. No TODO bodies, no checkboxes, no file paths in this section.
- TODO numbers in spec.md and in `<notes-dir>/todos/TODO-N.md` filenames must match 1-to-1.

## TODO ordering — call-sequence depth, deepest first

**Rule:** sort TODOs so each commit only touches its own layer and layers below it. The dependency edges in the working tree point **upward** (callers depend on callees), so commits should land in the same direction — leaf → trunk → wiring.

**How to derive the order:**

1. Sketch the call graph for the feature using the Description / flow-map / research artefacts: who calls whom from request entry to deepest dependency.
2. Assign each touched component a depth `Ln`:
   - `L0` = leaf: talks to the external world (DB, RPC, OS, IdP) or implements an interface that no other component in the change set calls.
   - `Ln` = calls one or more `L<n` components.
   - `Lmax` = top: process startup / `main.go` / DI wiring.
3. Group outcomes into commits per layer. Sort the TODO list by ascending depth.
4. **Never** put a TODO that depends on an unwritten lower-layer component before the TODO that introduces it. If you must, mark the lower-layer component as part of the same commit and merge the TODOs.

**Add a `Layer` column** to the TODO List table so the ordering is auditable:

```markdown
| #      | Layer            | Outcome | Commit |
|--------|------------------|---------|--------|
| TODO-1 | L0 — leaf        | <…> | `<subject>` |
| TODO-2 | L1 — domain pkg  | <…> | `<subject>` |
| TODO-3 | L2 — handler     | <…> | `<subject>` |
| TODO-4 | L3 — wiring      | <…> | `<subject>` |
```

The layer label is descriptive (concrete package or role); the `Ln` prefix makes the ordering invariant machine-checkable.

**Why deepest first:**

- A leaf commit compiles and is testable in isolation — no stubs needed.
- Upper-layer commits never have to be rewritten when a leaf detail changes, because the leaf landed first with its final shape.
- Reviewers can read the diff in narrative order: "this is the new thing → this is what uses it → this is how it gets started up."
- Reverts are cheap: revert the topmost TODO and the rest still compiles.

**Common shape merges that fall out of this rule:**

- A type split + the call site that depends on the new types is usually one cohesive shape change → **one TODO**, not two. Two TODOs would force an intermediate state where the new field/type exists but nothing populates it — a dead commit.
- Wiring code that branches on a single config flag (`if cfg.Foo != nil { ... } else { ... }`) is **one TODO**, not one per branch. The branch is mechanism, not outcome.

**Counter-pattern to reject:**

- TODOs ordered by "easiest first" or "most visible first". These produce a working tree that compiles only after every TODO lands, defeating the per-TODO commit contract.

## Step 4: Stop. TODO body authoring is the user's call.

**This skill writes the TODO List (outcomes) in spec.md and stops. It does not write TODO bodies and does not auto-trigger the body-authoring phase.** The TODO List is the discussion surface — the user reviews and refines outcomes here. Whether and when to draft `<notes-dir>/todos/TODO-N.md` body files is decided **by the user**, manually.

Why split:
- spec.md must be reviewable on its own. The outcome list is reviewable; full bodies are not — they bury the discussion in implementer-grade detail.
- TODO body writing has its own checklist, audience (a dummy Sonnet implementer), and quality bar — owned entirely by `todo`.
- The user decides when the outcomes are right. Don't pre-empt that by drafting bodies.

Use the `todo` subcommand (`references/todo.md`) for writing TODO bodies.

## Spec-Readiness Checklist

- [ ] `spec.md` has Description, Terms, Guidelines, Goal, Decisions, TODO List — and nothing else
- [ ] TODO List is a table of `TODO-N | Outcome | Commit` rows — no bodies, no checkboxes, no file paths
- [ ] Every outcome is a post-condition (what is true after), not a step (what to do)
- [ ] Every outcome is one sentence ≤ 25 words and contains no implementation nouns (filenames, function names, packages)
- [ ] No row's outcome contains "and" that hides two outcomes — split it
- [ ] No two rows share an outcome — merge them
- [ ] Outcomes use terms from the Terms table verbatim where applicable
- [ ] TODO numbers are contiguous starting from 1 and listed in intended execution order
- [ ] TODO List has a `Layer` column with `Ln` depth annotations; rows are sorted by ascending depth (deepest first)
- [ ] No TODO depends on a component introduced by a later TODO; same-layer outcomes that would force a dead intermediate state are merged
- [ ] No files were created or edited under `<notes-dir>/todos/` during this spec pass
- [ ] Description + Goal together convey the target picture in plain language
- [ ] Terms table covers entities, commands (imperative), and events (past tense) used in the spec
- [ ] Format/protocol decisions live in `spec.md` Design Decisions (not deferred into TODO bodies)

## Interpreting user input

| User says | You do |
|-----------|--------|
| "add X" / "fix Y" | Capture the intent in spec.md: update Description / Goal / Decisions / Terms as needed, **and** add or revise a row in the TODO List with the outcome. Do NOT write a TODO body file — that's the next action via `todo`. |
| "the outcome of TODO-N should be Z" | Edit row N in the TODO List. Confirm phrasing follows the outcome rules (post-condition, ≤ 25 words, no implementation nouns). |
| "split TODO-N" / "merge TODO-N and TODO-M" | Rewrite the TODO List rows accordingly and renumber contiguously. |
| "use approach Z" | Record in Design Decisions (spec.md) |
| "looks good" | Signal readiness |
| "I did X" / status update | Acknowledge, re-read if needed |
| Option selection ("option A") | Execute immediately, don't re-ask |

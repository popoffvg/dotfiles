---
name: work-plan
description: >
  Plan phase. LLM writes a plan — never executes it. `<notes-dir>/plan.md`
  paints the target picture (description, terms, goal, decisions). TODOs
  are a separate level under `<notes-dir>/todos/TODO-N.md`, each written as
  explicit instructions for a dummy Sonnet implementer. No code changes.
---

# work:plan

## CRITICAL RULES

**You are a planner, not an executor.**

- **DO NOT** write code, edit files, run tests, or make any changes outside `<notes-dir>/`.
- User says "add X" → add as TODO. User says "fix Y" → add as TODO.
- You may create/edit files under `<notes-dir>/` ONLY (`plan.md`, `worklog.md`, `todos/*.md`).
- You may READ any file for planning purposes.

## Contract

Plan structure is defined entirely by this skill. There is no separate constraint layer — every rule below is the contract.

- `<notes-dir>/plan.md` contains: Description, Terms, Implementation Guidelines, Goal, Design Decisions, **TODO List**. The TODO List is an index — `TODO-N: <outcome>` pairs only, **no bodies**.
- **Outcome = the discussion object.** Each TODO entry in plan.md is a single line stating the observable result that TODO must produce. The outcome is what the user and planner discuss and align on before any TODO body is written. If the outcome is unclear or contested, the plan is not ready.
- `<notes-dir>/todos/TODO-N.md` contains the full body of exactly one TODO. Each TODO file must restate the **same outcome** verbatim from plan.md's TODO List at the top of the file.
- Every TODO has a **Type** and a `## Changes` section described in TS pseudocode — see `work-plan-flow` skill.
- **plan.md = target picture + outcome ledger.** Description + Goal answer "what does the world look like when this is done"; Terms + Decisions let a human validate the planner's mental model; the TODO List enumerates the discrete outcomes that get there.
- **Outcomes, not steps.** A TODO outcome describes *what is true after* the TODO is done (e.g. "users can refresh expired tokens silently"), not *what the implementer does* (e.g. "add refresh handler"). Outcomes are user-facing or system-observable; implementation belongs in the TODO body.
- **TODO authoring is a separate, user-initiated action.** This skill produces `plan.md` (including the TODO List with outcomes) and stops. It never writes TODO body files under `todos/` and never chains into `work-todo-prepare` — that skill runs only when the user manually starts it.
- Each TODO = one feature-notable commit.
- Open design decisions live in `plan.md` **Design Decisions** — never hidden inside a TODO.
- **Terms** is one table covering entities, events, and commands — kept short so a human can read it and validate that the planner's mental model matches theirs. No separate sections for events/commands; they share the table via the `Kind` column.

## Plan layout

```
<notes-dir>/
├── plan.md              # target picture: description, terms, guidelines, goal, decisions
├── worklog.md           # timestamped action log
└── todos/
    ├── TODO-1.md        # full instructions for one implementer pass
    ├── TODO-2.md
    └── ...
```

**Why two layers:**
- `plan.md` is read by humans + verifier — target picture plus the TODO List of outcomes. The outcomes are the discussion surface: the user signs off on outcomes here before any body is written.
- `todos/TODO-N.md` is read by a dummy implementer (Sonnet) — must be self-contained, no guessing. Its first line repeats the outcome from plan.md so the implementer always knows what "done" means.

## Phase Flow

```
research → plan → plan-verify → implement → plan (iterate)
```

## Step 1: Assess current state

- **First planning** — no `<notes-dir>/plan.md` and no `<notes-dir>/todos/`.
- **Iteration** — read `<notes-dir>/worklog.md` + user feedback, identify what needs to change. Edit affected TODO files in place; renumber only if order changes.

## Step 2: Read context

Read all `<notes-dir>/*.md` and relevant source files. Collect implementation guidelines (patterns, conventions, project rules). Pre-read every file a TODO will touch.

## Step 3: Write `<notes-dir>/plan.md` (target picture only)

### plan.md template

```markdown
# Plan

## Description
<what this work is about, 2–5 sentences>

## Terms

| Term | Kind | Notes |
|------|------|-------|
| RefreshToken | entity | Opaque token in Redis, TTL-bound |
| AuthHandler | component | Serves `/auth/*` |
| RotateToken | command | SDK → Session; emits `TokenRotated` or `AuthRefreshFailed` |
| TokenRotated | event | Old token invalidated, new pair persisted |

> Purpose: let a human reading the plan check that the planner's domain model matches their own.
> Kind ∈ `entity | value-object | aggregate | component | service | policy | state | command | event`.
> Commands use imperative names and note who issues them and which events they emit. Events use past-tense names.
> Keep it short — only terms that appear in the Description or Goal.

## Implementation Guidelines

### Skills
- `go-modify` — Go file edits
- `work-commit` — commit conventions

### Coding Patterns
- <pattern from codebase, e.g. "handlers return structured errors via `pkg/errors.Wrap`">

### References
- `<path/to/example.go>` — reference for <pattern>

> If none found: "No project-specific guidelines — follow language defaults."

## Goal

Plain-language description of the user-visible outcome once this plan is done. 2–5 sentences or bullets. No IDs, no checkboxes, no TODO references.

> Example: "Users with an expired session can keep working without re-logging in: the SDK silently refreshes their token on the first 401, and the server invalidates the previous refresh token on every rotation. The change is rolled out behind the existing `auth.v2` flag."

## Design Decisions

### <Decision title>
**Decision:** <what>
**Rationale:** <why>
**Trade-offs:** <pros/cons>

## TODO List

> Index only — outcomes, not bodies. Each row is a discussion object: the user
> aligns on these outcomes before any TODO file is drafted. Order = intended
> execution order. Bodies live in `<notes-dir>/todos/TODO-N.md` and must
> restate the same outcome verbatim.

| # | Outcome |
|---|---------|
| TODO-1 | <observable result after this TODO, user/system-facing, one sentence> |
| TODO-2 | <…> |

> Outcome writing rules:
> - Phrase as *post-condition* — what is true once done. ✅ "Expired sessions refresh silently behind the `auth.v2` flag." ❌ "Add token refresh handler."
> - One sentence, ≤ 25 words, no implementation nouns (file names, function names, packages).
> - Must use terms from the Terms table verbatim where applicable.
> - If two TODOs share an outcome, merge them. If an outcome needs "and", split it.
```

**Rules:**
- plan.md ends after the TODO List. No TODO bodies, no checkboxes, no file paths in this section.
- TODO numbers in plan.md and in `<notes-dir>/todos/TODO-N.md` filenames must match 1-to-1.

## Step 4: Stop. TODO body authoring is the user's call.

**This skill writes the TODO List (outcomes) in plan.md and stops. It does not write TODO bodies and does not auto-trigger the body-authoring phase.** The TODO List is the discussion surface — the user reviews and refines outcomes here. Whether and when to draft `<notes-dir>/todos/TODO-N.md` body files is decided **by the user**, manually.

Why split:
- plan.md must be reviewable on its own. The outcome list is reviewable; full bodies are not — they bury the discussion in implementer-grade detail.
- TODO body writing has its own checklist, audience (a dummy Sonnet implementer), and quality bar — owned entirely by `work-todo-prepare`.
- The user decides when the outcomes are right. Don't pre-empt that by drafting bodies.

Rules for this skill:
- Do **write** the TODO List inside plan.md — outcomes only.
- Do **not** create or edit any file under `<notes-dir>/todos/` during the plan phase.
- Do **not** include file lists, pseudocode, or test commands inside the TODO List rows.
- Do **not** invoke or chain into `work-todo-prepare`. When outcomes are settled, stop and **advise** the user that body drafting is the recommended next step — the user runs it themselves.

TODO ordering = row order in the table. Cross-TODO dependencies will be expressed inside each TODO body file (via the `Depends on` field), not in plan.md.

## Plan-Readiness Checklist

- [ ] `plan.md` has Description, Terms, Guidelines, Goal, Decisions, TODO List — and nothing else
- [ ] TODO List is a table of `TODO-N | Outcome` rows — no bodies, no checkboxes, no file paths
- [ ] Every outcome is a post-condition (what is true after), not a step (what to do)
- [ ] Every outcome is one sentence ≤ 25 words and contains no implementation nouns (filenames, function names, packages)
- [ ] No row's outcome contains "and" that hides two outcomes — split it
- [ ] No two rows share an outcome — merge them
- [ ] Outcomes use terms from the Terms table verbatim where applicable
- [ ] TODO numbers are contiguous starting from 1 and listed in intended execution order
- [ ] No files were created or edited under `<notes-dir>/todos/` during this plan pass
- [ ] Description + Goal together convey the target picture in plain language
- [ ] Terms table covers entities, commands (imperative), and events (past tense) used in the plan
- [ ] Format/protocol decisions live in `plan.md` Design Decisions (not deferred into TODO bodies)

## Step 5: Worklog and signal

Append to `<notes-dir>/worklog.md`: `- YYYY-MM-DD HH:MM: <action>`.

When all checks pass, stop and advise the user (do not chain into another skill):
```
Plan is ready for review. The TODO List in plan.md is the discussion object —
review each outcome and tell me what to adjust, merge, split, or drop.
Suggested next step (manual): once outcomes are settled, run `work-todo-prepare`
to draft the TODO body files. I won't start that on my own.
```

If unknowns: `Unknowns found: <list>. Research needed.`

## Interpreting user input

| User says | You do |
|-----------|--------|
| "add X" / "fix Y" | Capture the intent in plan.md: update Description / Goal / Decisions / Terms as needed, **and** add or revise a row in the TODO List with the outcome. Do NOT write a TODO body file — that's the next action via `work-todo-prepare`. |
| "the outcome of TODO-N should be Z" | Edit row N in the TODO List. Confirm phrasing follows the outcome rules (post-condition, ≤ 25 words, no implementation nouns). |
| "split TODO-N" / "merge TODO-N and TODO-M" | Rewrite the TODO List rows accordingly and renumber contiguously. |
| "use approach Z" | Record in Design Decisions (plan.md) |
| "looks good" | Signal readiness |
| "I did X" / status update | Acknowledge, re-read if needed |
| Option selection ("option A") | Execute immediately, don't re-ask |

## Autoresearch rules

**Can change:** plan/TODO templates, description formats, readiness checklist, file naming inside `<notes-dir>/todos/`, outcome phrasing rules
**Cannot change:** read-only enforcement, phase gate logic, two-layer split (plan.md = target picture + outcome list, todos/ = TODO bodies), the rule that every TODO has exactly one outcome and that outcome is the discussion object
**Min sessions before eval:** 5
**Runs per experiment:** 3

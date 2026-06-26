# spec — small

All-in-one pipeline for small changes (≤ 3 TODOs). Runs the same grill loop as `new` to
produce Obsidian notes + spec.md, then auto-writes TODO body files. Single command:
no separate `write` → `new` → `todo` sequence.

Use when the change fits in one or two TODOs and doesn't need a full spec phase.
Use `new` + `todo` separately when the spec has > 3 TODOs or requires deep design exploration.

## When to use small vs new

| Signal | Use `small` | Use `new` |
|--------|-------------|-----------|
| Scope | ≤ 3 TODOs, known scope | > 3 TODOs, scope still forming |
| Decisions | 0-2 open questions, most decisions already clear | 3+ open questions, design exploration needed |
| Terms | Domain terms are known | New domain model emerging |
| Time | 5-10 minute loop | 15-30 minute loop |
| User says | "add a flag", "fix this handler", "small change to X" | "design the auth system", "plan the migration", "spec out notifications" |

## Flow

```
/code small
  ├─ Write minimal spec.md (if no existing spec)
  ├─ Grill loop (condensed) ─── produces thoughts/ notes + populates spec.md
  ├─ Compile plan (same as new exit)
  └─ Auto-write TODO body files (same format as todo)
```

## Step 1: Starting state

If no `<notes-dir>/spec.md` exists:
- Write a minimal spec.md with Description, Goal, and a TODO List seeded from the user's request.
- Skip Implementation Guidelines (derive in TODO bodies later).
- Keep Terms, What we're NOT doing, and Design Decisions sections — they'll be filled during the loop.

If spec.md exists (iteration):
- Read it, identify what needs changing, proceed to grill.

## Step 2: Condensed grill loop

Same operating mode as `new` (`references/new.md`): Ask → Answer → Write note → Update spec.
Same note format: `references/note-format.md` (decision + fact notes in `thoughts/`).

### Grilling scope (condensed order)

For small changes, the loop is narrower:

1. **Goal check** — one question: "The goal is X. Is that right?" If the user says yes, write a fact note capturing the goal. Move on.
2. **Open Questions** — every `- [ ]` gets resolved. For a small change, there should be ≤ 2.
3. **Terms** — scan the TODO outcomes for domain terms. For each: is it defined? If not, propose a definition in one sentence. Write as fact note (if from code) or decision note (if needs user to choose the name).
4. **Spec vs code** — read the files the TODO will touch. Surface ONE contradiction if found. Skip deep audit — for ≤ 3 TODOs, the surface is small.
5. **Design Decisions** — only if a trade-off emerges during the loop. Small changes rarely have hard-to-reverse decisions.

### What to SKIP in the small loop

- **What we're NOT doing** — only add if the user explicitly mentions something out of scope. Don't proactively grill for exclusions.
- **Goal vs TODO List trace** — if there's ≤ 3 TODOs and the user confirmed the goal, the trace is self-evident.
- **Failure path leak questions** — skip unless the user raises error handling as a concern.

### Still required

- One question at a time, depth-first.
- Recommend an answer for every question.
- Write fact notes BEFORE decisions they constrain.
- Update spec.md inline after each resolution.
- Live checklist echo every few questions.
- Stop when Open Questions empty.

## Step 3: Exit contract (same as new)

Same exit as `new` (`references/new.md` § Exit contract):

1. **Back-link all notes** — populate `Affects` back-links and `links` frontmatter.
2. **Confirm spec.md** — Open Questions empty, decisions recorded, terms defined.
3. **Compile plan** — `## Plan` section with decision trail table.
4. **Append worklog** — one line: what was grilled, note count.

## Step 4: Auto-write TODO bodies

This is the difference from `new`. After the plan is compiled, write TODO body files
for every TODO in the TODO List. Follow `references/todo.md` exactly — same format,
same required elements, same quality bar.

### Writing rules

- One file per TODO: `<notes-dir>/todos/TODO-N.md`.
- Restate the **Outcome** verbatim from spec.md's TODO List.
- **Type** must be chosen from the standard set (workflow | state machine | component | event handler | data shape change).
- **Depends on** is `none` unless TODOs must be ordered (same rules as `todo.md`).
- **Risk / blast radius** — score by reach, not effort.
- **Changes** is TS pseudocode per `flow` (`references/flow.md`). One ` ```ts ` block, ≤ 40 lines.
- **Autotest** — single runnable command. Derive cases from the Outcome.
- **Manual test** — steps + expected, aligned 1:1. `Skip?` only with concrete reason.
- **Commit** — prefix + subject line, ≤ 72 chars.
- **Files** — every file touched, repo-relative, no globs.
- **Pre-reads** — every file the implementer must read first, with reasons.

### Quality checklist (same as todo.md pre-save)

- [ ] All `always` elements present and in order
- [ ] Every path in Files exists (or is marked `create`)
- [ ] Every path in Pre-reads exists
- [ ] Changes is one TS snippet ≤ 40 lines
- [ ] Outcome is capability statement in use-case language; no file paths or type names
- [ ] Every domain term is in spec.md Terms or in a `## New terms` section
- [ ] Every interface change has unified-diff block
- [ ] Autotest.Command is single runnable command
- [ ] Manual test Steps and Expected aligned 1:1
- [ ] Commit.Subject ≤ 72 chars, imperative
- [ ] No vague verbs

### Anti-patterns for small

- **Skipping Pre-reads** because "it's a small change" — the implementer still needs context.
- **Vague Autotest** — `go test ./...` when one package is affected. Small scope means precise scope.
- **Skipping Manual test** with "covered by unit tests" — same banned justifications as `todo.md`.
- **Implementing in the TODO body** — the Changes section is pseudocode, not real code. Small changes tempt you to write real code. Don't.
- **Over-grilling** — the small loop is condensed. Don't grill failure paths unless the user cares. Don't ask "what about edge case X" for edge cases that don't change the implementation.

## Step 5: Report

Print to the user:

1. **Plan summary** — 1-2 sentences (shorter than `new` report).
2. **Note count** — N decisions, M facts.
3. **TODO files written** — one line per TODO: `TODO-N: <title> → <note references if relevant>`.
4. **Ready for implement?** — Yes, if the TODO files pass the quality checklist. The user can go straight to `/impl work`.
5. **Alternatively** — the user can run `verify` before implementing, or edit TODO bodies manually.

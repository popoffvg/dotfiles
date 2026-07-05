# spec — small

Condensed spec pipeline for small changes (≤ 3 TODOs). Runs the same grill loop as `new` to
produce Obsidian notes + spec.md, compiles the plan, and **stops**. Like `new`, it does NOT
write TODO bodies — the human reviews the spec, then runs `/code todo`.

Use when the change fits in one or two TODOs and doesn't need a full spec phase.
Use `new` when the spec has > 3 TODOs or requires deep design exploration. Either way,
TODO authoring is the separate `todo` step, gated on human review.

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
  └─ Stop → human reviews spec → /code todo authors TODO bodies
```

## Step 1: Starting state

If no `<notes-dir>/spec.md` exists:
- Write a minimal spec.md with the status header (`Status: init`, `This spec drives:` line, phase-rules block — see `write.md` § spec.md template), Description, Goal, and a TODO List seeded from the user's request.
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
4. **Advance status** — set the header `Status:` field from `init` to `review`.
5. **Append worklog** — one line: what was grilled, note count.

## Step 4: Stop — human review gate

`small` ends after the plan is compiled. **Do not write `todos/TODO-N.md` files** — same gate
as `new`. The spec + thought graph are a reviewable artifact; the human reviews the spec and,
when satisfied, runs `/code todo` to author the TODO bodies. The condensed loop does not lower
the review bar — a small wrong spec still becomes a small wrong TODO.

If the review surfaces gaps, run `/code small` again (iteration) to re-grill.

## Step 5: Report

Print to the user:

1. **Plan summary** — 1-2 sentences (shorter than `new` report).
2. **Note count** — N decisions, M facts.
3. **Remaining unknowns** — should be none.
4. **Next action** — review the spec manually, then run `/code todo` to author TODO bodies.

# spec — note format

Owner of the code skill's **thought**-note *format*. What a thought is — the concept and its rules — lives in the `thought` skill; this file specializes it into concrete files. Four types: `question`, `decision`, `fact`, `impl-decision`. A question is asked as a `question` note and answered by a new `decision` or `fact` note; the answered question is archived (§ Resolution). Notes link via `[[wikilinks]]`.

An **open question** is a thought too: it lives in `thoughts/` as `NNN-question-slug.md`, not as a checklist line in `spec.md`. `spec.md` has no Open Questions section (`ref-write.md` § spec.md template).

Templates (one per type):
- [`tpl-note-question.md`](tpl-note-question.md)
- [`tpl-note-decision.md`](tpl-note-decision.md)
- [`tpl-note-fact.md`](tpl-note-fact.md)
- [`tpl-note-impl-decision.md`](tpl-note-impl-decision.md)

## File naming

```
<notes-dir>/thoughts/
  NNN-type-slug.md
  archived/
    NNN-type-slug.md   # answered or superseded — kept for the trail, out of the live graph
```

- `NNN` — sequential 3-digit ID, zero-padded. Matches frontmatter `id`.
- `type` — `question`, `decision`, `fact`, or `impl-decision`.
- `slug` — kebab-case, ≤ 5 words, captures the topic.

Example: `001-decision-token-rotation.md`, `002-fact-token-ttl.md`, `004-question-refresh-scope.md`.

## Frontmatter

```yaml
---
type: question | decision | fact | impl-decision
id: "NNN"
status: open | approved | declined   # open only on type: question; approved is the default otherwise
date: 2026-06-18T14:30:22
source: grill | explore | codebase   # optional
tags: [topic, subtopic]
---
```

- `type` — drives the section structure below.
- `id` — matches the `NNN` prefix in the filename. Never changes, and no `NNN` is ever reused — not even by the note that answers or supersedes this one.
- `status` — `open` while a question is unresolved, and the only value that keeps a question in the live graph; `approved` on an answered question and on any decision/fact; `declined` when a thought is rejected, moot, or superseded, instead of deleting it.
- `date` — ISO 8601, the moment the note was written. On a question, add `resolved:` with the timestamp of the answer when marking it (§ Resolution).
- `source` — optional, on every type. `explore` for a note from an explore-phase research doc; `codebase` for one derived by reading code; `grill` (or omit) for one the user stated or chose. On a `question` it says where the question surfaced; on the `decision` or `fact` that answers it, where the **answer** came from.
- `source: codebase` on a decision marks an **auto-discovered** choice — the code answered it, nobody was asked. The choice is as binding as any other, but it carries no human approval, so a reviewer reads those rows first. Every auto-discovered decision names the `path:line` that forced it in its `## Why`.
- `tags` — 1–3 topic tags for grouping in Obsidian graph view.

---

## Question note

The answer is not known yet — the question blocks the spec. Sections, rules, worked example: [`tpl-note-question.md`](tpl-note-question.md).

Write one the moment a question surfaces (seeded from the request, raised by a research gap, or opened mid-grill). It is the only thought type that carries `status: open`, and the only one a READY spec must not contain.

### Resolution — answer in a new note, archive the question

**A question is a live thought only while it is open.** The answer is a *different* thought: it is
written as its own note, and the question note leaves the live graph. Never edit a question note
into its own answer. Three steps, in this order:

1. Write the answer as a new note at the next counter (`NNN`+1) — `NNN-decision-slug.md` when the
   answer is a choice, `NNN-fact-slug.md` when it establishes a truth. Keep the question's `slug`;
   the `NNN` is a fresh one. Set `source` to what resolved it (`codebase` when the answer was read
   out of the code, `grill` when the user answered) and `date` to now. Body per that type's
   template (`tpl-note-decision.md` / `tpl-note-fact.md`), and **restate the question's `## Question`
   text verbatim** — that is the audit trail of what was asked, and it is why no live note ever has
   to reach back into `archived/`.
2. In the question note, set `status: approved` (it was answered), add `superseded_by: "<new NNN>"`,
   and put `Answered by [[NNN-type-slug]]` as the first body line under the title. Keep the rest of
   the body untouched — the question as asked is the trail.
3. **The move to `thoughts/archived/` is automatic — never `mv` the file yourself.** The
   `thoughts-archive.sh` PostToolUse hook archives every question note whose `status` is no longer
   `open`, filename and `NNN` unchanged, and neither is ever reused. Dropping out of `thoughts/` is
   also what clears the question from the readiness gate — `wm-open-questions.sh` scans at
   `-maxdepth 1`.

Then re-link (§ Back-linking): repoint every `[[NNN-question-slug]]` wikilink in a live note at the
answer note. A live note must not depend on an archived one; the hook lists the files still pointing
at the question it just archived, and that list is the re-link worklist.

`superseded_by` is the one key for "the live note that replaced this one", whatever the reason — a
question answered, or a decision reversed (§ Superseding). Only the body verb differs: *Answered by*
a question's answer, *Superseded by* a reversal.

**One open question per topic.** Two notes asking the same thing is the thing to avoid — not two
notes on the topic, since the answer is always a second note.

A question that turns out to be moot has no answer note: keep it a `question`, set
`status: declined`, and give the one-line reason in the body. The hook archives it the same way —
`declined` is not `open`, so it is no longer live. Only `open` blocks readiness.

## Superseding — move to `thoughts/archived/`

A reversed thought is superseded, never deleted, and never left in the live graph. Two steps,
in this order:

1. Write the replacement note at the next counter (`NNN`+1), matching template.
2. In the old note, set frontmatter `status: declined`, add `superseded_by: "<new NNN>"`, and put
   `Superseded by [[NNN-type-slug]]` as the first body line under the title.

**The move to `thoughts/archived/` is automatic — never `mv` the file yourself.** The
`thoughts-archive.sh` PostToolUse hook sweeps the live notes after every `Edit`, `Write`, and
`Bash` call and moves out every note carrying a non-empty `superseded_by:`, filename unchanged;
the `NNN` counter is never reused. On a `decision`, `fact`, or `impl-decision`, `superseded_by` is
the whole marker — `status: declined` alone leaves the note live. (A `question` is the exception:
any status but `open` archives it, with or without a replacement — § Resolution.) The hook prints
what it moved, and names any of step 2 you left undone.

Then re-link (§ Back-linking): repoint every `[[old-note]]` wikilink in a live note at the
replacement. A live note must not depend on an archived one — that is a dangling dependency, and
it fails the back-linking check. The hook lists the live files still pointing at the note it just
archived; that list is the re-link worklist.

Why a folder and not a flag: the live graph is what the reader and the audit walk. An archived
note stays readable and stays in the jj history, but stops competing with the thought that
replaced it. `wm-open-questions.sh` scans `thoughts/` at `-maxdepth 1`, so an archived note never
blocks the gate.

Archived notes are read only when auditing history — `jj -R <notes-dir> log` shows when each one
was replaced.

## Decision note

The answer IS a choice. Sections, rules, worked example: [`tpl-note-decision.md`](tpl-note-decision.md).

## Fact note

The answer establishes a truth. Sections, rules, worked example: [`tpl-note-fact.md`](tpl-note-fact.md).

## Implementation decision note

An implementation choice made while authoring a TODO body. Same directory, shared counter. Sections, rules, when-to-write table: [`tpl-note-impl-decision.md`](tpl-note-impl-decision.md).

---

## Back-linking

At loop end (any subcommand that writes or edits thoughts): for each `Depends on` from note B → note A, add `Affects` in A → B. Populate each note's `links` frontmatter with every `[[wikilink]]` in its body. Verify every target file exists in `thoughts/`.

## Notes directory is the audit trail

- `thoughts/` = the traceable thought graph. Each note proves why a decision was made.
- Open work is visible in the same graph: every `status: open` question note is an unresolved blocker. List them with `~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts` (exit 1 = at least one open).
- A reviewer reads `NNN-decision-xxx.md`, follows `Depends on` backward to the facts that constrained it and `Affects` forward to what it enabled.
- A questioned decision shows the alternatives considered and why rejected — the spec is self-documenting.

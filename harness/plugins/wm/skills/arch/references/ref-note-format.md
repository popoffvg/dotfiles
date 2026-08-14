# spec — note format

Owner of the code skill's **thought**-note *format*. What a thought is — the concept and its rules — lives in the `thought` skill; this file specializes it into concrete files. Four types: `question`, `decision`, `fact`, `impl-decision`. One note per question — open as a `question`, flipped in place to `decision` or `fact` when resolved; notes link via `[[wikilinks]]`.

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
    NNN-type-slug.md   # superseded — kept for the trail, out of the live graph
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
- `id` — matches the `NNN` prefix in the filename. Never changes, not even when the note is resolved.
- `status` — `open` while the question is unresolved; `approved` once written as a decision/fact; `declined` when the user rejects a thought (superseded or wrong) instead of deleting it.
- `date` — ISO 8601, the moment the note was written. On resolution, keep it and add `resolved:` with the resolution timestamp.
- `source` — optional, on every type. `explore` for a note from an explore-phase research doc; `codebase` for one derived by reading code; `grill` (or omit) for one the user stated or chose. On a `question` it says where the question surfaced; on a `decision` or `fact` it says where the **answer** came from, so the flip overwrites it.
- `source: codebase` on a decision marks an **auto-discovered** choice — the code answered it, nobody was asked. The choice is as binding as any other, but it carries no human approval, so a reviewer reads those rows first. Every auto-discovered decision names the `path:line` that forced it in its `## Why`.
- `tags` — 1–3 topic tags for grouping in Obsidian graph view.

---

## Question note

The answer is not known yet — the question blocks the spec. Sections, rules, worked example: [`tpl-note-question.md`](tpl-note-question.md).

Write one the moment a question surfaces (seeded from the request, raised by a research gap, or opened mid-grill). It is the only thought type that carries `status: open`, and the only one a READY spec must not contain.

### Resolution — flip in place

A resolved question stays the same note: same `id`, same `NNN`, one file per topic. Never write a second note for an answer to a question already on disk.

1. Rename the file `NNN-question-slug.md` → `NNN-decision-slug.md` (the answer is a choice) or `NNN-fact-slug.md` (the answer establishes a truth). Keep `NNN` and `slug`.
2. Set frontmatter `type:` to the new type and `status: open → approved`; add `resolved: <ISO 8601>`. Set `source` to what resolved it — `codebase` when the answer was read out of the code, `grill` when the user answered — overwriting where the question came from.
3. Rewrite the body into that type's sections (`tpl-note-decision.md` / `tpl-note-fact.md`), keeping the original `## Question` text verbatim as the decision's Question — that is the audit trail of what was asked.
4. Fix every `[[NNN-question-slug]]` wikilink pointing at the old name (`grep -rl` the `thoughts/` dir); a dangling link fails the back-linking check below.

A question that turns out to be moot is not deleted: keep it a `question` note and set `status: declined` with a one-line reason in the body. `declined` does not block readiness; `open` does.

## Superseding — move to `thoughts/archived/`

A reversed thought is superseded, never deleted, and never left in the live graph. Three steps,
in this order:

1. Write the replacement note at the next counter (`NNN`+1), matching template.
2. In the old note, set frontmatter `status: declined`, add `superseded_by: "<new NNN>"`, and put
   `Superseded by [[NNN-type-slug]]` as the first body line under the title.
3. **Move the old file to `<notes-dir>/thoughts/archived/`** — `mkdir -p` it on first use. Keep
   the filename unchanged; the `NNN` counter is never reused.

Then re-link (§ Back-linking): repoint every `[[old-note]]` wikilink in a live note at the
replacement. A live note must not depend on an archived one — that is a dangling dependency, and
it fails the back-linking check.

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

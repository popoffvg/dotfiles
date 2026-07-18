# spec — note format

Owner of the code skill's **thought**-note *format*. What a thought is — the concept and its rules — lives in the `thought` skill; this file specializes it into concrete files. Each grilling resolution writes one standalone Obsidian note. Three types: `decision`, `fact`, `impl-decision`. One note per resolved question; notes link via `[[wikilinks]]`.

Templates (one per type):
- [`tpl-note-decision.md`](tpl-note-decision.md)
- [`tpl-note-fact.md`](tpl-note-fact.md)
- [`tpl-note-impl-decision.md`](tpl-note-impl-decision.md)

## File naming

```
<notes-dir>/thoughts/
  NNN-type-slug.md
```

- `NNN` — sequential 3-digit ID, zero-padded. Matches frontmatter `id`.
- `type` — `decision`, `fact`, or `impl-decision`.
- `slug` — kebab-case, ≤ 5 words, captures the topic.

Example: `001-decision-token-rotation.md`, `002-fact-token-ttl.md`.

## Frontmatter

```yaml
---
type: decision | fact | impl-decision
id: "NNN"
date: 2026-06-18T14:30:22
source: grill | explore | codebase   # optional
tags: [topic, subtopic]
---
```

- `type` — drives the section structure below.
- `id` — matches the `NNN` prefix in the filename.
- `date` — ISO 8601, the moment the note was written.
- `source` — optional. `explore` for facts from explore-phase research docs; `codebase` for facts derived by reading code during the grill; `grill` (or omit) for user-stated facts.
- `tags` — 1–3 topic tags for grouping in Obsidian graph view.

---

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
- A reviewer reads `NNN-decision-xxx.md`, follows `Depends on` backward to the facts that constrained it and `Affects` forward to what it enabled.
- A questioned decision shows the alternatives considered and why rejected — the spec is self-documenting.

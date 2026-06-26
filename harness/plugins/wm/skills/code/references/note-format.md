# spec — note format

Each grilling resolution writes a standalone Obsidian note. Three types: `decision`, `fact`,
and `impl-decision`. One note per resolved question. Notes link to each other via `[[wikilinks]]`.

Templates (one file per type):
- [`note-template-decision.md`](note-template-decision.md)
- [`note-template-fact.md`](note-template-fact.md)
- [`note-template-impl-decision.md`](note-template-impl-decision.md)

## File naming

```
_notes/thoughts/
  NNN-type-slug.md
```

- `NNN` — sequential 3-digit ID, zero-padded. Matches frontmatter `id`.
- `type` — `decision` or `fact`.
- `slug` — kebab-case, ≤ 5 words, captures the topic.

Example: `001-decision-token-rotation.md`, `002-fact-token-ttl.md`

## Frontmatter (both types)

```yaml
---
type: decision | fact
id: "NNN"
date: 2026-06-18T14:30:22
source: grill | explore | codebase   # optional
tags: [topic, subtopic]
---
```

- `type` — `decision` or `fact`. Drives the section structure below.
- `id` — matches the `NNN` prefix in the filename.
- `date` — ISO 8601, the moment the note was written.
- `source` — optional. `explore` for facts harvested from explore-phase research docs; `codebase` for facts derived by reading code during the grill; `grill` (or omit) for user-stated facts.
- `tags` — 1-3 topic tags for grouping in Obsidian graph view.

---

## Decision note

When the answer IS a choice. Template: [`note-template-decision.md`](note-template-decision.md) —
sections, rules, and worked example.

## Fact note

When the answer establishes a truth. Template: [`note-template-fact.md`](note-template-fact.md) —
sections, rules, and worked example.

## Implementation decision note

When authoring a TODO body and making implementation choices. Template:
[`note-template-impl-decision.md`](note-template-impl-decision.md) —
sections, rules, when-to-write table.

---

## Back-linking at loop end

After the grill loop closes, the agent walks all notes and back-fills:

1. **`Affects`** on decision notes — for each `Depends on` reference from note B to note A, add a corresponding `Affects` entry in note A pointing to note B.
2. **`links`** frontmatter — populate the `links` YAML list with every `[[wikilink]]` that appears in the note body so Obsidian's graph view sees them.
3. Verify every link target exists as a file in `thoughts/`.

## Notes directory is the audit trail

- `spec.md` = the compiled plan (decisions + terms + TODO list).
- `thoughts/` = the traceable thought graph. Each note proves why a decision was made.
- A reviewer can read `NNN-decision-xxx.md`, follow `Depends on` links backward to see what facts constrained it, and follow `Affects` links forward to see what downstream decisions it enabled.
- If a decision is ever questioned, the note shows the alternatives considered and why they were rejected — the spec is self-documenting.
- Implementation decisions (made while authoring TODO bodies) also live here as
  `NNN-impl-decision-slug.md` — same directory, shared counter.
  Template: [`note-template-impl-decision.md`](note-template-impl-decision.md).

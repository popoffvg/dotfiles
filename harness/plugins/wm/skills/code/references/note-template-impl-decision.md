---
description: >
  Implementation decision note template. Use when authoring a TODO body and making
  choices the spec didn't decide: file naming, package structure, error handling,
  library usage, data shape. Lives in thoughts/ alongside decision and fact notes.
---

# spec — implementation decision note template

When writing a TODO body, you make choices the spec didn't decide: file naming, package
structure, error handling strategy, library usage, data shape. Every such choice is an
**implementation decision**. Write it to `<notes-dir>/thoughts/` immediately.

## When to write

| Situation | Write? |
|-----------|--------|
| You chose between 2+ valid approaches for the Changes | Yes |
| You picked a pattern the spec didn't mandate | Yes |
| You named a file, function, type, or package not in the Terms table | Yes |
| The decision affects how other TODOs should be written | Yes |
| The spec's Design Decisions already cover it | No — link the TODO instead |

## Sections

```markdown
---
type: impl-decision
id: "<NNN>"
date: <ISO 8601>
tags: [<topic>, <subtopic>]
todo: TODO-N
---

# <Decision title — oneliner, verb-led>

## Context
<What the spec left unspecified. One sentence.>

## Decision
<What you chose and why. One sentence.>

## Alternatives
<What else you considered and why rejected. Table or bullet list.>

## Affects
- <how this shapes other TODOs or the codebase>
```

## File naming

```
<notes-dir>/thoughts/
  NNN-impl-decision-slug.md
```

- `NNN` — sequential 3-digit ID, shared counter with spec decision/fact notes.
- `slug` — kebab-case, ≤ 5 words.
- Example: `005-impl-decision-error-wrapping.md`

## Rules

- Write immediately after making the choice, not at TODO end. Fresh reasoning beats reconstructed.
- One note per decision. Don't bundle multiple decisions into one file.
- If a decision changes while writing later TODOs, edit the existing note — don't create a duplicate.

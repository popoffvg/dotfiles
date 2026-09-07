---
name: defaulted-fields-are-advanced
description: Use when deciding which fields are prominent and which are collapsed in a settings panel, options form, config UI, wizard, or a command's flag help — or when tiering any list of parameters into basic vs advanced. The criterion is whether the field has a default, not how important it feels. Triggers on "which settings go in advanced", "group these options", designing a settings modal, or a reviewer saying the panel has too much on the first screen.
metadata:
  origin: self-improvement
---

# A field with a default is advanced; only required fields are primary

A default is a statement that the thing runs correctly without the user touching this field. Anything
that carries one is therefore not on the path to the action button, and belongs behind a collapsed
section. What remains on the first screen is exactly the set of fields the user *must* supply.

Often that is one field. That is the correct outcome, not an under-designed panel.

## Why this beats an importance ranking

The tempting split is by significance — "this threshold really matters, so it should be visible". That
criterion is unfalsifiable: every field matters to whoever added it, two reviewers tier the same list
differently, and the tiering has to be re-argued every time a field is added. It also grows the first
screen monotonically, because no one ever argues their field is unimportant.

"Has a default" is a property of the field, readable from the schema. It is checkable, stable under new
fields, and produces the same answer for everyone.

**Adjustable is not the same as prominent.** If a project's invariant is that every parameter stays
user-adjustable, collapsing satisfies it — the field is still there, still editable, still documented.
Collapsing hides it from the *first screen*, not from the user.

## Prefer an objective criterion whenever tiering a list

The general form, beyond settings: when splitting a set of items into tiers — visible/hidden columns,
required/optional arguments, core/extended API, must-read/reference docs — look for a property already
recorded on each item before inventing a judgment. Schema-readable properties that usually work:

| Tiering | Objective criterion |
|---|---|
| settings: basic vs advanced | has a default |
| table columns: shown vs hidden | changes what the user does next (name the decision) |
| CLI flags: help vs extended help | required, or has no default |
| API: core vs extended | referenced by the primary flow |

If no such property exists, that is worth noticing: it usually means the items are not actually
different in kind, and the tiering is decoration.

## State the cost of collapsing

Collapsing is not free, and the costs are predictable enough to design against up front:

1. **What shaped the output stops being glanceable.** Someone reading a surprising result cannot see
   which knob caused it. Fix: surface any setting that differs from its default in the result view —
   a summary line, a banner, a run header — so a non-default run is self-explaining.
2. **One collapsed field is usually the top support question.** Whichever field explains "why did it
   skip / omit / ignore my thing" now takes a click to find. Answer that question where the user
   actually looks — in the result, next to the omission — not only in the panel.

Name both when proposing the split. A collapse presented without its cost reads as tidying; presented
with it, it is a design decision the reviewer can weigh.

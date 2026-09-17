---
name: bind-controls-through-a-default-not-into-state
description: Use when adding a field to a settings panel, options form, preferences screen, or config UI whose values are persisted per user, per project, or per document — and existing saved state predates the new field or still holds the field's former name. Covers a control that renders empty on an old record, a checkbox reading an undefined array, and the seeding loop that "fixes" it by writing defaults into persisted state on load. Triggers on "the field shows empty", "add a setting", "default on the UI level", or a settings screen opened against a record saved by an earlier version.
metadata:
  origin: self-improvement
---

**A control binds through a getter that falls back to the default. It never writes the default into
persisted state to make the display right.**

Adding a field to a persisted settings shape leaves every existing record without it. Reads that
serve the *run* usually already handle this — a `?? DEFAULTS.field` where the values are projected
into arguments — so the behaviour is correct. The **control** binds the raw field, gets `undefined`,
and renders empty. The user sees a blank box and reads it as "no value set", while the run is
quietly using the default.

## The seeding loop is the wrong fix

The obvious repair walks the defaults table on load and writes each missing field into the persisted
object. It makes the display right and costs three things:

- **Opening a settings screen mutates saved state.** A read-only act becomes a write.
- **Where that state is a cache key, everything downstream re-runs.** In a pipeline whose arguments
  form the content key, merely opening the panel invalidates the run and recomputes it.
- **It writes values the user never chose,** which then look like deliberate settings forever.

## The shape that works

One helper per defaulted field, a writable computed:

- **getter** — `persisted[field] ?? DEFAULTS[field]`. The control shows the value the system will
  actually use.
- **setter** — writes the operator's own value, and only then.

Nothing reaches persisted state until someone edits something. One defaults table serves the
initializer, the argument projection, and the display, so a field added later gets its control bound
the same way for free.

## Three traps

**A collection field crashes rather than rendering empty.** A checkbox row asking
`persisted.list.includes(x)` throws on an old record, so the panel fails to open at all. Route
collection reads through the same helper — the fallback is what makes the call safe.

**A renamed field is not an added field, and the defaults helper does not cover it.** When a field
is renamed and the run keeps reading the old key — `new ?? legacy ?? DEFAULT` in the argument
projection — a control bound through the plain defaults helper shows `DEFAULT` on a record that
holds only the legacy value. The panel then displays a number the run will not use, and only an
edit clears it. This one has two defensible answers, so settle it explicitly rather than assuming:
either the control mirrors the projection's whole `??` chain, or the house rule is that the panel
never reads legacy keys and the record migrates on first write — in which case the design note and
the manual-test step have to say the panel shows the default, because a reviewer reading them will
otherwise file the mismatch as a bug. What tips it: how long legacy records live, and whether the
displayed number is one an operator would act on.

**Not every empty control is a bug.** A genuinely optional field — a resource override where empty
means "let the system size it" — must keep rendering empty. Only fields with a real default in the
defaults table belong in the helper; check the table, not the control.

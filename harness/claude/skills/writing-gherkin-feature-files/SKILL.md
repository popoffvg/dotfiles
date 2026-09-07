---
name: writing-gherkin-feature-files
description: Use when writing or editing a Gherkin .feature file — adding a scenario, wrapping long step text, filling an Examples table, or fixing a gherkin-lint failure. Covers step formatting, one-phase-per-scenario structure, and the lint check that catches violations.
paths:
  - "**/*.feature"
metadata:
  origin: self-improvement
---

Write every step as one physical line. Do not wrap long step text onto a second
line with indentation — that has no keyword on the continuation line, so
strict Gherkin grammar treats it as a parse error, not a continuation of the
same step.

Keep each scenario to one Given/When/Then phase. A scenario may have many
`Given`, many `And`/`But`, then move to `When`, then to `Then` — but once it
reaches `Then`, no later step may use `Given` or `When` again. A scenario that
checks two independent things (an action, a check, then a second action) must
split into two scenarios, each with its own tag and its own short title. Do not
work around this by relabeling the second `When` as `And` — that hides the
second phase instead of naming it.

Do not use the apostrophe character (`'`). Replace a possessive like
`the block's settings panel` with `the settings panel of the block`.

Every column in an Examples table must be used in at least one step of that
Scenario Outline. An unused column is dead data — either delete it or reference
it in a step with `<columnName>`.

Run `gherkin-lint` on every `.feature` file after writing or editing it, from
the directory holding the file, via `npx --yes gherkin-lint`. It needs a
`.gherkin-lintrc` in that directory — copy one from another `.feature`
directory in the same repo if one already exists there, otherwise write a
minimal one covering `keywords-in-logical-order`, `no-unused-variables`,
`no-trailing-spaces`, `new-line-at-eof`, and `one-space-between-tags`. Fix
every reported finding before treating the file
as done — do not just report the findings back.

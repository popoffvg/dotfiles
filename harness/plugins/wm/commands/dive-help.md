---
name: dive-help
description: Show all /dive subcommands with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/dive <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `docs` *(default)* | Write the markdown research write-ups — 3 phases: find entry point → explore → grill-me loop. One `<ep-slug>.md` per entry point, graded against the 6-step chain. Grill findings fold into the artifact (no question files) + `INDEX.md`. |
| `workflow` | Write the typed TS pseudocode + path bindings — `<ep-slug>.workflow.ts`, `<ep-slug>.bindings.json`, `components/*.d.ts`, `flows.json`. Navigable, reveal-in-editor layer over the `docs` artifacts. |
| `unknowns` | Guided **quadrant walk** with the user — map known knowns / known unknowns / unknown knowns / unknown unknowns one stage at a time, ending with a four-quadrant map (`<slug>.unknowns.md`) in the user's hands. For ambiguous or "know it when I see it" tasks. |
| `research` | Document the codebase as-is via parallel sub-agents → one dated `research/YYYY-MM-DD-*.md`. Documentarian only — no critique. (`model: opus`) |
| `flow-map` | Render a `flows.json` (from `workflow`) as a self-contained interactive HTML — swimlane columns + clickable numbered flows. |
| `explain` | Draw a **single-panel planned architecture** as a self-contained HTML a reviewer reads in 30 seconds — components, edge relations, load-bearing decisions tagged with decision ids. One picture of the intended design, not a before/after. Writes `<slug>.arch.html`. |
| `explain-diff` | Draw a two-panel **architecture diff** comparing two solutions (`current` vs `planned`, or option A vs B) as a self-contained HTML a reviewer reads in 30 seconds — five slots (unchanged/removed/new/changed/why), redundant colour+glyph+label encoding. Writes `<slug>.arch-diff.html`. |

Flow: `docs → workflow → flow-map`. `research` is the standalone documentarian route. `explain` (single planned-arch picture) and `explain-diff` (two-solution before/after diff) are standalone reviewable pictures of a planned change.

Inputs: a list of entry points (file paths, symbols, URLs). Optional `dst:<path>` sets the output dir directly (overrides `<notes-dir>/research` and `--notes-dir`).

Artifacts land in `<notes-dir>/research/` (or the `dst:` path). Run `docs` first — `workflow` mirrors the cited locations from each `<ep-slug>.md`.

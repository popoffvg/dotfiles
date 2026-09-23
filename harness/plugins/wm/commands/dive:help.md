---
name: dive:help
description: Show all /dive subcommands with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/dive <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `docs` *(default)* | Write the markdown research write-ups + question lists. One `<ep-slug>.questions.md` + one `<ep-slug>.md` per entry point, graded against the 6-step chain. Convergence loop + `INDEX.md`. |
| `workflow` | Write the typed TS pseudocode + path bindings into `<notes-dir>/workflows/<flow-name>/` — one folder per flow (`<ep-slug>.workflow.ts`, `<ep-slug>.bindings.json`), plus shared `components/*.d.ts`, `_flow.entities.d.ts`, `tsconfig.json` and `flows.json` at the `workflows/` root. The navigable, reveal-in-editor layer over the `docs` artifacts. |
| `unknowns` | Guided **quadrant walk** with the user — map known knowns / known unknowns / unknown knowns / unknown unknowns one stage at a time, ending with a four-quadrant map (`<slug>.unknowns.md`) in the user's hands. Use when the task is ambiguous, underspecified, or the user will "know it when they see it". |
| `explain` | Draw a **single-panel planned architecture** as a self-contained HTML a reviewer reads in 30 seconds — the components, their edge relations, and the load-bearing decisions (tagged with decision ids). One picture of the intended design, not a before/after. Writes `<slug>.arch.html`. |
| `explain-diff` | Draw a two-panel **architecture diff** comparing two solutions — `current` beside `planned` (or option A beside B) — as a self-contained HTML a reviewer reads in 30 seconds: what changed, removed, new, held, and the one load-bearing why. Writes `<slug>.arch-diff.html`. Use to weigh a refactor/migration or pick between two designs. |

Flow: `docs → workflow`. `explain` (single planned-arch picture) and `explain-diff` (two-solution before/after diff) are standalone reviewable pictures of a planned change.

Inputs: a list of entry points (file paths, symbols, URLs). Optional `dst:<path>` sets the output dir directly (overrides `<notes-dir>/research` and `--notes-dir`).

Artifacts land in `<notes-dir>/research/` (or the `dst:` path); `workflow` writes to `<notes-dir>/workflows/<flow-name>/` instead. Run `docs` first — `workflow` mirrors the cited locations from each `<ep-slug>.md`.

---
name: explore-help
description: Show all /explore subcommands with one-line descriptions.
---

Print the following table verbatim. No preamble, no commentary, no tool calls — output only the markdown below.

## `/explore <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `docs` *(default)* | Write the markdown research write-ups — 3 phases: find entry point → explore → grill-me loop. One `<ep-slug>.md` per entry point, graded against the 6-step chain. Grill findings fold into the artifact (no question files) + `INDEX.md`. |
| `workflow` | Write the typed TS pseudocode + path bindings — `<ep-slug>.workflow.ts`, `<ep-slug>.bindings.json`, `components/*.d.ts`, `flows.json`. Navigable, reveal-in-editor layer over the `docs` artifacts. |
| `research` | Document the codebase as-is via parallel sub-agents → one dated `research/YYYY-MM-DD-*.md`. Documentarian only — no critique. (`model: opus`) |
| `flow-map` | Render a `flows.json` (from `workflow`) as a self-contained interactive HTML — swimlane columns + clickable numbered flows. |

Flow: `docs → workflow → flow-map`. `research` is the standalone documentarian route.

Inputs: a list of entry points (file paths, symbols, URLs). Optional `dst:<path>` sets the output dir directly (overrides `<notes-dir>/research` and `--notes-dir`).

Artifacts land in `<notes-dir>/research/` (or the `dst:` path). Run `docs` first — `workflow` mirrors the cited locations from each `<ep-slug>.md`.

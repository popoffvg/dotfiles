---
name: explore-help
description: Show all /explore subcommands with one-line descriptions.
---

Display this table:

## `/explore <subcommand>` — full list

| Subcommand | Does |
|---|---|
| `docs` *(default)* | Write the markdown research write-ups + question lists — `<ep-slug>.questions.md` + `<ep-slug>.md` per entry point, graded against the 6-step chain. Convergence loop + `INDEX.md`. |
| `workflow` | Write the typed TS pseudocode + path bindings — `<ep-slug>.workflow.ts`, `<ep-slug>.bindings.json`, `components/*.d.ts`, `flows.json`. Navigable, reveal-in-editor layer over the `docs` artifacts. |

Flow: `docs → workflow → /flow-map`.

Inputs: a list of entry points (file paths, symbols, URLs). Optional `dst:<path>` sets the output dir directly (overrides `<notes-dir>/research` and `--notes-dir`).

Artifacts land in `<notes-dir>/research/` (or the `dst:` path). Run `docs` first — `workflow` mirrors the cited locations from each `<ep-slug>.md`.

---
name: explore
description: >
  Research phase before implementation — subcommand router. Given a list of entry points, spawn one
  subagent per entry point in parallel and write refactor-oriented research artifacts into the
  wm notes directory (`<notes-dir>/research/`). Use when the user says "explore",
  "research these entry points", or provides a list of files/symbols to investigate before a task.
  Invoke as `/explore <docs|workflow|research|flow-map>` (default `docs`). `docs` finds the entry
  point (if not given), explores it, then runs a grill-me loop folding findings into the write-up;
  `workflow` writes the typed TS pseudocode + path bindings; `research` documents the codebase
  as-is via parallel sub-agents into a dated write-up; `flow-map` renders flows.json as interactive HTML.
argument-hint: [docs (default), workflow, research, flow-map — full list /explore-help] + entry points (files, symbols, urls)
---

# Explore — subcommand router

`/explore <subcommand>`. Pick the route, read its reference, follow it. Default is `docs`. Artifacts live in `<notes-dir>/research/`.

## Subcommands

| `/explore …` | You need to… | Reference |
|---|---|---|
| `docs` *(default)* | Write the markdown research write-ups. 3 phases: find entry point → explore → grill-me loop. One `<ep-slug>.md` per entry point, graded against the 6-step chain. Grill findings fold into the artifact (no question files) + `INDEX.md`. | `references/docs.md` |
| `workflow` | Write the typed TS pseudocode + path bindings — `<ep-slug>.workflow.ts`, `<ep-slug>.bindings.json`, `components/*.d.ts`, `flows.json`. The navigable, reveal-in-editor layer over the `docs` artifacts. | `references/workflow.md` |
| `research` | Document the codebase as-is. Spawn parallel sub-agents, synthesize findings into a dated `research/YYYY-MM-DD-*.md` write-up. Documentarian only — no critique, no recommendations. (`model: opus`) | `references/research.md` |
| `flow-map` | Render a `flows.json` (from `workflow`) as a self-contained interactive HTML — swimlane columns + clickable numbered cross-package flows. | `references/flow-map.md` |
| `notes-graph` | Graph the wm notes (`spec.md`, `todos/`, `research/`) as a Mermaid graph showing TODO↔spec↔research references, then commit and push the artifact. | `references/notes-graph.md` |

## How they combine

```
docs (prose + questions, 6-step chain) → workflow (TS pseudocode + bindings) → flow-map (HTML)
```

- **docs** is the default and the foundation: it finds the entry point (if not given), explores it into human-readable `.md` write-ups, then runs an autonomous grill-me loop that folds findings into the artifacts until research stops surfacing gaps.
- **workflow** is the navigation layer over those `.md` artifacts: clean typed TS pseudocode where every component and notable branch reveals to its real (possibly non-TS, cross-repo) source. **Run `docs` first** — `workflow` mirrors the cited locations from each `<ep-slug>.md`.
- **flow-map** renders the `flows.json` that `workflow` emits as a self-contained interactive HTML.
- **research** is the standalone documentarian route (wm research phase): parallel sub-agents → one dated `research/*.md`. Independent of the `docs → workflow → flow-map` chain; use it to document the codebase as-is rather than to scope a refactor.

Run `docs` alone for a read-only refactor brief. Add `workflow` when the team wants to navigate the
flows in the editor or render them with `flow-map`.

## Inputs

A list of entry points. Each may be:
- A file path (`src/server/index.ts`)
- A symbol (`HandleRequest`, `userController.create`)
- A URL or doc reference

If the user provides a free-form description, use cocoindex to find relevant entry points.

The user may also pass a **destination folder** inline with a `dst:<path>` token (e.g.
`dst:docs/research/auth`). It sets `$RESEARCH_DIR` directly, overriding the resolved
`<notes-dir>/research` (see "Output location"). A relative `dst:` resolves against the current
working directory.

## Output location

`<notes-dir>` is the wm notes directory for the active task (commonly `.notes/`). It
persists with the rest of the planning context (`spec.md`, `worklog.md`, `todos/`) and ships with the
work, instead of vanishing from `$TMPDIR`. Resolve it from the phase context:

- If a wm flow is active, use its notes dir (typically `.notes/` at repo root).
- If no flow is active, default to `./.notes/` in the current working directory and tell the user.
- The user may override the notes dir with `--notes-dir <path>`.
- A `dst:<path>` token in the input sets `$RESEARCH_DIR` directly and **wins over** both the resolved notes dir and `--notes-dir`. Use it to drop research outside the wm flow (e.g. into a docs folder).

Create the research subdirectory:

```bash
NOTES_DIR="${NOTES_DIR:-.notes}"
# dst:<path> overrides; else <notes-dir>/research
RESEARCH_DIR="${DST:-$NOTES_DIR/research}"
mkdir -p "$RESEARCH_DIR"
```

The previous `$TMPDIR/claude-explore/` location is deprecated.


## Integration with wm

- During the **research phase**, `explore research` saves coarse findings as `<notes-dir>/research-*.md`. `explore docs` complements that with per-entry-point deep dives under `<notes-dir>/research/`.
- During **spec phase**, `code new` may reference `research/<ep-slug>.md#DP-N` or `#EC-N` from a TODO's **Pre-reads** so the implementer doesn't re-derive the analysis.
- `research/` is committed alongside `spec.md` and `todos/` — it travels with the task.

## What this skill is NOT

- Not implementation. No code edits to the target codebase.
- Not a code review.
- Not a planning doc. The workflow.ts files are descriptive, not prescriptive.

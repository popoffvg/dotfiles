---
name: explore
description: >
  Research phase before implementation — subcommand router. Given a list of entry points, spawn one
  subagent per entry point in parallel and write refactor-oriented research artifacts into the
  work-manager notes directory (`<notes-dir>/research/`). Use when the user says "explore",
  "research these entry points", or provides a list of files/symbols to investigate before a task.
  Invoke as `/explore <docs|workflow>` (default `docs`). `docs` writes the markdown write-ups +
  question lists; `workflow` writes the typed TS pseudocode + path bindings. Render flows with
  `explore-flow-map`.
argument-hint: [docs (default), workflow — full list /explore-help] + entry points (files, symbols, urls)
---

# Explore — subcommand router

`/explore <subcommand>`. Pick the route, read its reference, follow it. Default is `docs`. Artifacts live in `<notes-dir>/research/`.

## Subcommands

| `/explore …` | You need to… | Reference |
|---|---|---|
| `docs` *(default)* | Write the markdown research write-ups + question lists. One `<ep-slug>.questions.md` + one `<ep-slug>.md` per entry point, graded against the 6-step chain. Convergence loop + `INDEX.md`. | `references/docs.md` |
| `workflow` | Write the typed TS pseudocode + path bindings — `<ep-slug>.workflow.ts`, `<ep-slug>.bindings.json`, `components/*.d.ts`, `flows.json`. The navigable, reveal-in-editor layer over the `docs` artifacts. | `references/workflow.md` |

## How they combine

```
docs (prose + questions, 6-step chain) → workflow (TS pseudocode + bindings) → /flow-map (HTML)
```

- **docs** is the default and the foundation: it produces the human-readable `.md` write-ups and the explorer question lists, and runs the autonomous convergence loop until research stops surfacing gaps.
- **workflow** is the navigation layer over those `.md` artifacts: clean typed TS pseudocode where every component and notable branch reveals to its real (possibly non-TS, cross-repo) source. **Run `docs` first** — `workflow` mirrors the cited locations from each `<ep-slug>.md`.

Run `docs` alone for a read-only refactor brief. Add `workflow` when the team wants to navigate the
flows in the editor or render them with `/flow-map`.

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

`<notes-dir>` is the work-manager notes directory for the active task (commonly `.notes/`). It
persists with the rest of the planning context (`spec.md`, `worklog.md`, `todos/`) and ships with the
work, instead of vanishing from `$TMPDIR`. Resolve it from the phase context:

- If a work-manager flow is active, use its notes dir (typically `.notes/` at repo root).
- If no flow is active, default to `./.notes/` in the current working directory and tell the user.
- The user may override the notes dir with `--notes-dir <path>`.
- A `dst:<path>` token in the input sets `$RESEARCH_DIR` directly and **wins over** both the resolved notes dir and `--notes-dir`. Use it to drop research outside the work-manager flow (e.g. into a docs folder).

Create the research subdirectory:

```bash
NOTES_DIR="${NOTES_DIR:-.notes}"
# dst:<path> overrides; else <notes-dir>/research
RESEARCH_DIR="${DST:-$NOTES_DIR/research}"
mkdir -p "$RESEARCH_DIR"
```

The previous `$TMPDIR/claude-explore/` location is deprecated.


## Integration with work-manager

- During the **research phase**, `explore-research` saves coarse findings as `<notes-dir>/research-*.md`. `explore` complements that with per-entry-point deep dives under `<notes-dir>/research/`.
- During **spec phase**, `spec` (`write` / `todo` subcommands) may reference `research/<ep-slug>.md#DP-N` or `#EC-N` from a TODO's **Pre-reads** so the implementer doesn't re-derive the analysis.
- `research/` is committed alongside `spec.md` and `todos/` — it travels with the task.

## What this skill is NOT

- Not implementation. No code edits to the target codebase.
- Not a code review.
- Not a planning doc. The workflow.ts files are descriptive, not prescriptive.

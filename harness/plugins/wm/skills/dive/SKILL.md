---
name: dive
description: >
  Research phase before implementation — subcommand router. Given entry points (files, symbols, urls),
  spawn one subagent per entry point in parallel and write refactor-oriented research artifacts into
  `<notes-dir>/research/`. Use when the user says "dive", "explore", "research these entry points", or
  provides a list of files/symbols to investigate before a task. Invoke as
  `/dive <docs|workflow|unknowns|explain|explain-diff>` (default `docs`).
argument-hint: "[docs (default), workflow — full list /dive-help] + entry points (files, symbols, urls)"
---

# Dive — subcommand router

`/dive <subcommand>`. Pick the route, read its reference, follow it. Default is `docs`. Artifacts live in `<notes-dir>/research/` — except the `workflow` route, which writes one folder per flow under `<notes-dir>/workflows/`.

## Subcommands

| `/dive …` | You need to… | Reference |
|---|---|---|
| `docs` *(default)* | Write the markdown research write-ups + question lists. One `<ep-slug>.questions.md` + one `<ep-slug>.md` per entry point, graded against the 6-step chain. Convergence loop + `INDEX.md`. | `dive-docs:SKILL.md` |
| `workflow` | Write the typed TS pseudocode + path bindings into `<notes-dir>/workflows/<flow-name>/` — one folder per flow (`<ep-slug>.workflow.ts`, `<ep-slug>.bindings.json`), plus shared `components/*.d.ts`, `_flow.entities.d.ts`, `tsconfig.json` and `flows.json` at the `workflows/` root. The navigable, reveal-in-editor layer over the `docs` artifacts. | `references/sub-workflow.md` |
| `unknowns` | Guided **quadrant walk** with the user — map known knowns / known unknowns / unknown knowns / unknown unknowns one stage at a time, ending with a four-quadrant map (`<slug>.unknowns.md`) in the user's hands. Use when the task is ambiguous, underspecified, or the user will "know it when they see it". | `references/sub-unknowns.md` |
| `explain` | Draw a **single-panel planned architecture** as a self-contained HTML a reviewer reads in 30 seconds — the components, their edge relations, and the load-bearing decisions (tagged with decision ids). One picture of the intended design, not a before/after. Writes `<slug>.arch.html`. | `references/sub-explain.md` |
| `explain-diff` | Draw a two-panel **architecture diff** comparing two solutions — `current` beside `planned` (or option A beside B) — as a self-contained HTML a reviewer reads in 30 seconds: what changed, removed, new, held, and the one load-bearing why. Writes `<slug>.arch-diff.html`. Use to weigh a refactor/migration or pick between two designs. | `references/sub-explain-diff.md` |

## How they combine

```
docs (prose + questions, 6-step chain) → workflow (TS pseudocode + bindings) → /flow-map (HTML)
```

Run `docs` alone for a read-only refactor brief. Add `workflow` — which mirrors the cited locations from each `<ep-slug>.md`, so **run `docs` first** — when the team wants to navigate the flows in the editor or render them with `/flow-map`.

## Inputs

A list of entry points. Each may be:
- A file path (`src/server/index.ts`)
- A symbol (`HandleRequest`, `userController.create`)
- A URL or doc reference

If the user provides a free-form description, use `mcp__fff__grep` / `mcp__fff__find_files` to find relevant entry points.

The user may pass a **destination folder** inline with a `dst:<path>` token (see "Output location").

## Parallel subagents

Every route that fans out over entry points spawns its subagents the same way. This section is the one home for the rule — a route's procedure says *spawn the fan-out* and points here.

- **Put all `Agent` calls in one assistant message.** Calls in separate messages run serially, not in parallel.
- **Use `subagent_type: "Explore"` with `model: "sonnet"`.** Every default fan-out here is read-only investigation, which sonnet does at a fraction of the cost. Switch to `general-purpose` only for an entry point that needs cross-file design reasoning, and keep `model: "sonnet"` unless the reasoning itself is the hard part.
- **Give each subagent a self-contained prompt.** A subagent cannot see this conversation. Include the entry point's inputs verbatim — for `workflow`, the `<ep-slug>.md` plus the schema — and the absolute output path.

**The `docs` route uses named agents instead.** `explorer` and `explore-critic` both carry `model: sonnet` in their own frontmatter, and both read their contract from a file. Spawn them by name, pass no model, and paste no contract. The one-message rule still applies. See `dive-docs:SKILL.md`.

## Output location

`<notes-dir>` is the wm notes directory for the active task, persisting with the rest of the planning context (`spec.md`, `worklog.md`, `todos/`). Resolve it:

- If a wm flow is active, use its notes dir (typically `.notes/` at repo root).
- If no flow is active, default to `./.notes/` and tell the user.
- `--notes-dir <path>` overrides the resolved dir.
- A `dst:<path>` token (e.g. `dst:docs/research/auth`, relative to cwd) sets `$RESEARCH_DIR` directly and **wins over** both — use it to drop research outside the wm flow.

Create the output subdirectories:

```bash
NOTES_DIR="${NOTES_DIR:-.notes}"
# dst:<path> wins; else <notes-dir>/research
RESEARCH_DIR="${DST:-$NOTES_DIR/research}"   # docs / unknowns / explain artifacts
if [[ -n "${DST:-}" ]]; then
  WORKFLOWS_DIR="$DST/workflows"             # workflow route — one folder per flow
else
  WORKFLOWS_DIR="$NOTES_DIR/workflows"
fi
mkdir -p "$RESEARCH_DIR"
```

The `workflow` route writes to `$WORKFLOWS_DIR/<flow-name>/` — one folder per flow, with the shared
typing files (`components/`, `_flow.entities.d.ts`, `tsconfig.json`) and `flows.json` at
`$WORKFLOWS_DIR/` itself. See `references/sub-workflow.md`.

## Integration with wm

- During the **research phase**, `explore-research` saves coarse findings as `<notes-dir>/research-*.md`. `explore` complements that with per-entry-point deep dives under `<notes-dir>/research/`.
- During **spec phase**, `code new` may reference `research/<ep-slug>.md#DP-N` or `#EC-N` from a TODO's **Pre-reads** so the implementer doesn't re-derive the analysis.
- `research/` is committed alongside `spec.md` and `todos/` — it travels with the task.

## What this skill is NOT

- Not implementation. No code edits to the target codebase.
- Not a code review.
- Not a planning doc. The workflow.ts files are descriptive, not prescriptive.

# dive · workflow route

Write the **typed TS pseudocode + path bindings** — the machine-readable, navigable spec of each
flow. This route is the navigation layer over the `docs` route: it reads the `.md` artifacts and
emits clean, type-checking, reveal-in-editor TS. No prose write-up here.

**Run `docs` first.** This route consumes `<ep-slug>.md` (its Workflow-steps table + decision
points are the source of the cited locations). If no `.md` exists for an entry point, run the
`docs` route for it first or tell the user.

**Every file this route writes is filled in `examples/workflow-flow.md`** — the layout, the
`.workflow.ts`, a `components/*.d.ts`, the `bindings.json`, the `tsconfig.json`, and `flows.json`,
each with the rules for that file as the `>` block under it. Open it before writing: no file's own
rules are written twice, so this file holds only the two rule lists below and the procedure.

Workflow artifacts live in `$WORKFLOWS_DIR` — **not** in `$RESEARCH_DIR` — one folder per flow.

## Rules — the `.workflow.ts`

- **Clean, typed TS.** Parses and type-checks against `components/*.d.ts` + `_flow.entities.d.ts`. No raw paths inside the code, no `/* ... */` blobs hiding logic.
- **Components are typed symbols, not free identifiers.** Anything that maps to a real app component is referenced via an `import` from `../components/<name>.d.ts`. This is what gives autocomplete. Declare the component in its `.d.ts` the first time you use it.
- **Imperative, top-to-bottom.** Happy + error paths in execution order. No `steps[]` graph, no `id`/`calls` indirection.
- **All branches visible.** Every `if`, `switch`, early return, `throw`, async fan-out is shown.
- **Notable branches carry a ULID.** A branch that maps to real branching logic gets a trailing `// <ULID>` comment (generate with `~/.claude/scripts/flow-ulid.mjs`). Map each ULID to its real source in `<ep-slug>.bindings.json`. Plain control-flow scaffolding needs no ULID — only branches worth revealing.
- **All side effects visible.** Show `db.x`, `redis.x`, `emit`, `log`, `fs`, `http` calls — don't hide them inside helpers.
- **One function per file.** Major sub-workflow (≥ ~15 lines) → a second function below, called from the first.
- **≤ ~80 lines total.** If longer, you're documenting too much — split the entry point.
- Use namespaces to show component boundaries and group related functions.

## Rules — `flows.json`

Every `from`/`to` references a package `id`. Every `source` is a verified `path:line`. Derive
`packages[].id` from the cited source files inside each `<ep-slug>` artifact (top-level dir or repo
package of the cited file).

## Verify + autocomplete plumbing

- **Verify every citation.** Open each `@source` and each `bindings.json` `source` before writing it. Then run the lint:
  `~/.claude/scripts/flow-reveal.mjs check $WORKFLOWS_DIR` — it walks the flow folders recursively and fails if any ULID/`@source` points at a missing path or past-EOF line.
- **Reveal in the editor (Zed):** cursor on a notable-`if` line → reveal key opens its real source via the ULID; for a component, `cmd-click` jumps into its `.d.ts`, then the reveal key on that line opens the `@source`. Both run `flow-reveal.mjs reveal`. See `.config/zed/tasks.json` + `keymap.json`.

Cross-reference: the `docs` `.md` artifact's "Workflow steps" table is the human-readable index
(one `path:line` per step); this `.workflow.ts` + its `bindings.json`/`components` are the
machine-readable, navigable spec. They must agree on the cited locations.

## Procedure

1. **Resolve `<notes-dir>`, `$RESEARCH_DIR` and `$WORKFLOWS_DIR`** (router "Output location"). Require existing `<ep-slug>.md` artifacts in `$RESEARCH_DIR` — if missing, run `docs` first.
2. **Create the layout:** `mkdir -p "$WORKFLOWS_DIR/components"`.
3. **Pick entry points.** Default: every `<ep-slug>.md` in `$RESEARCH_DIR` with no `$WORKFLOWS_DIR/<ep-slug>/` folder. User may name a subset.
4. **For each entry point, spawn a subagent in parallel** — see `dive:SKILL.md` § Parallel subagents for the type, the model, and the one-message rule. Brief each with:
   - The `<ep-slug>.md` (the cited locations to mirror) and the absolute `$WORKFLOWS_DIR`
   - **The absolute path of `examples/workflow-flow.md`**, plus "read it first: it is every file you must write, filled for a different flow, and the `>` block under each one states that file's rules. Delete the `>` blocks from what you write — they are rules, not content."
   - "Verify every `@source` and every `bindings.json` `source` by reading the file — do not guess. Prefer absolute paths."
   - "Create `$WORKFLOWS_DIR/<ep-slug>/` and emit `<ep-slug>.workflow.ts` + `<ep-slug>.bindings.json` inside it. Append any new component to `$WORKFLOWS_DIR/components/<name>.d.ts` — shared, one level up. Import shared types and components with `../`."
5. **Wait for all subagents.** Write/refresh `$WORKFLOWS_DIR/_flow.entities.d.ts` and `$WORKFLOWS_DIR/tsconfig.json`.
6. **Lint:** run `~/.claude/scripts/flow-reveal.mjs check $WORKFLOWS_DIR`. Fix any missing/past-EOF citation before continuing.
7. **Aggregate** all per-flow workflows into `$WORKFLOWS_DIR/flows.json`. Deduplicate packages by `id`.
8. **Update** `$RESEARCH_DIR/INDEX.md` — add `[workflow]` links pointing at `../workflows/<ep-slug>/<ep-slug>.workflow.ts` and the `flows.json` line.
9. **Print** the workflows dir path and suggest `/flow-map` against `$WORKFLOWS_DIR/flows.json` for an interactive HTML view.

# dive · workflow route

Write the **typed TS pseudocode + path bindings** — the machine-readable, navigable spec of each
flow. This route is the navigation layer over the `docs` route: it reads the `.md` artifacts and
emits clean, type-checking, reveal-in-editor TS. No prose write-up here.

**Run `docs` first.** This route consumes `<ep-slug>.md` (its Workflow-steps table + decision
points are the source of the cited locations). If no `.md` exists for an entry point, run the
`docs` route for it first or tell the user.

## Output

Per entry point `<ep-slug>`, in `$RESEARCH_DIR/`:

| File | Purpose |
|---|---|
| `<ep-slug>.workflow.ts` | Typed TS pseudocode — clean, no inline paths (schema below) |
| `<ep-slug>.bindings.json` | ULID → real source for the notable `if` branches in the workflow |

Shared across the research dir (write once, append as entry points are processed):

| File | Purpose |
|---|---|
| `components/<name>.d.ts` | Typed declaration of each app component in pseudocode, with `@source` tag to its real (possibly non-TS) source. Powers autocomplete + reveal. |
| `_flow.entities.d.ts` | Shared ambient types used by the workflow files (`Request`, `Response`, domain types, binding shapes) |
| `tsconfig.json` | Includes the workflow files + `components/*.d.ts` + `_flow.entities.d.ts` so the editor's TS server offers autocomplete/diagnostics |

After all entry points are processed:

| File | Purpose |
|---|---|
| `flows.json` | Aggregated flows document — input for `explore-flow-map` |

## Workflow TS schema

Each `<ep-slug>.workflow.ts` is **typed TS pseudocode written as an imperative function** that reads
top-to-bottom like the real code path. It is **clean TypeScript** — no inline `// path:line` clutter.
Real source is bound out-of-band, in two layers, so the file stays readable, type-checks, and
**autocompletes** in the editor, while every step can still be revealed to its real source.

The file exports:
1. A `meta` object with name + description.
2. One pseudocode function per workflow (typically one — the entry point).

```ts
import type { Request, Response, Body } from "./_flow.entities";
import { RunnerController } from "./components/runner-controller";

export const meta = {
  name: "handle-request",        // matches <ep-slug>
  description: "HTTP request lifecycle from router to response.",
};

// Imperative pseudocode. Reads top-to-bottom like the actual code path.
// Components come from typed ./components/*.d.ts (autocomplete + reveal).
// Notable branches carry a trailing ULID that resolves via <ep-slug>.bindings.json.
export function flow(req: Request): Response {
  const body = RunnerController.parseBody(req);
  if (!validate(body)) {                          // 01J9F2K8QFABCDEFGHJKMNPQRS
    return reject(400, "invalid body");
  }

  const handler = RunnerController.dispatch(body.action);
  if (!handler) {                                 // 01KSZ1B5TZK8YD8PEC7X2CDV5N
    return reject(404, "no route");
  }

  try {
    const result = handler(body);
    return write(200, result);
  } catch (e) {                                   // 01J9F2K8QH1234567890ABCDEF
    log.error("handler crashed", { action: body.action, e });
    return reject(500, "internal");
  }
}
```

Rules:
- **Clean, typed TS.** Parses and type-checks against `components/*.d.ts` + `_flow.entities.d.ts`. No raw paths inside the code, no `/* ... */` blobs hiding logic.
- **Components are typed symbols, not free identifiers.** Anything that maps to a real app component (e.g. `RunnerController`) is referenced via an `import` from `./components/<name>.d.ts`. This is what gives autocomplete. Declare the component in its `.d.ts` (below) the first time you use it.
- **Imperative, top-to-bottom.** Happy + error paths in execution order. No `steps[]` graph, no `id`/`calls` indirection.
- **All branches visible.** Every `if`, `switch`, early return, `throw`, async fan-out is shown.
- **Notable branches carry a ULID.** A branch that maps to real branching logic gets a trailing `// <ULID>` comment (generate with `~/.claude/scripts/flow-ulid.mjs`). Map each ULID to its real source in `<ep-slug>.bindings.json`. Plain control-flow scaffolding needs no ULID — only branches worth revealing.
- **All side effects visible.** Show `db.x`, `redis.x`, `emit`, `log`, `fs`, `http` calls — don't hide them inside helpers.
- **One function per file.** Major sub-workflow (≥ ~15 lines) → a second function below, called from the first.
- **≤ ~80 lines total.** If longer, you're documenting too much — split the entry point.
- Use namespaces to show component boundaries and group related functions.

## Path binding

Two binding layers keep the `.ts` clean while every symbol and branch reveals to real source.

### Component declarations — `components/<name>.d.ts`

One declaration file per app component referenced in pseudocode. Declares the API (for autocomplete)
and binds each symbol to its **real source** with a `@source <path:line>` JSDoc tag. The real source
may be **any language** (Go, Rust, …) and **any repo** — the path lives in the tag, not in a TS
declaration map.

**Prefer absolute paths** in `@source` (unambiguous and repo-independent — the component may live in
a different repo than the workflow notes). A relative path is resolved against the open Zed worktree
root.

```ts
/** Runner controller — orchestrates job execution.
 *  @source /Users/me/git/pl/pkg/runner/controller.go:120 */
export declare class RunnerController {
  /** @source /Users/me/git/pl/pkg/runner/parse.go:44 */
  static parseBody(req: Request): Body;
  /** @source /Users/me/git/pl/pkg/runner/dispatch.go:88 */
  static dispatch(action: string): Handler;
}
```

### Notable-if bindings — `<ep-slug>.bindings.json`

Maps each notable-branch ULID to its real source.

```json
{
  "01J9F2K8QFABCDEFGHJKMNPQRS": { "kind": "if", "label": "invalid body", "source": "/Users/me/git/pl/pkg/server/validate.go:10" },
  "01KSZ1B5TZK8YD8PEC7X2CDV5N": { "kind": "if", "label": "no route",     "source": "pkg/server/router.go:104" }
}
```

**Prefer an absolute `source`** (used verbatim). A relative `source` resolves against the open Zed
worktree root (`$ZED_WORKTREE_ROOT`); set `"repo": "<abs-path>"` on an entry to override the base for
that one branch.

### Verify + autocomplete plumbing

- **Verify every citation.** Open each `@source` and each `bindings.json` `source` before writing it. Then run the lint:
  `~/.claude/scripts/flow-reveal.mjs check <research-dir>` — fails if any ULID/`@source` points at a missing path or past-EOF line.
- **`tsconfig.json`** in the research dir makes the editor type-check + autocomplete the workflow files:
  ```json
  { "compilerOptions": { "noEmit": true, "checkJs": false, "module": "esnext", "moduleResolution": "bundler" },
    "include": ["*.workflow.ts", "components/*.d.ts", "_flow.entities.d.ts"] }
  ```
- **Reveal in the editor (Zed):** cursor on a notable-`if` line → reveal key opens its real source via the ULID; for a component, `cmd-click` jumps into its `.d.ts`, then the reveal key on that line opens the `@source`. Both run `flow-reveal.mjs reveal`. See `.config/zed/tasks.json` + `keymap.json`.

Cross-reference: the `docs` `.md` artifact's "Workflow steps" table is the human-readable index
(markdown `path:line` links); this `.workflow.ts` + its `bindings.json`/`components` are the
machine-readable, navigable spec. They must agree on the cited locations.

## Aggregated `flows.json`

After all entry points are processed, combine their workflows into a single document at
`$RESEARCH_DIR/flows.json` that the `explore-flow-map` skill renders as interactive HTML. Schema:

```jsonc
{
  "packages": [
    { "id": "web",    "label": "Web Frontend", "kind": "app",     "path": "apps/web" },
    { "id": "api",    "label": "API Server",   "kind": "service", "path": "services/api" },
    { "id": "db",     "label": "Postgres",     "kind": "store" }
  ],
  "flows": [
    {
      "id": "invite-user",
      "label": "Invite new user",
      "description": "Admin invites a teammate; an email is queued and the user row is pre-created.",
      "edges": [
        { "from": "web", "to": "api", "via": "POST /invites",   "payload": "{ email, role }", "source": "apps/web/src/Invite.tsx:84" },
        { "from": "api", "to": "db",  "via": "INSERT users",    "payload": "{ id, email, status: 'invited' }", "source": "services/api/users.ts:201" },
        { "from": "api", "to": "mail","via": "queue invite-email","payload": "{ token, url }", "source": "services/api/users.ts:230" }
      ]
    }
  ]
}
```

Rules: every `from`/`to` references a package `id`. Every `source` is a verified `path:line`. Derive
`packages[].id` from the cited source files inside each `<ep-slug>` artifact (top-level dir or repo
package of the cited file).

## Procedure

1. **Resolve `<notes-dir>` and `$RESEARCH_DIR`** (router "Output location"). Require existing `<ep-slug>.md` artifacts — if missing, run `docs` first.
2. **Pick entry points.** Default: every `<ep-slug>.md` in `$RESEARCH_DIR` without a `.workflow.ts`. User may name a subset.
3. **For each entry point, spawn a subagent in parallel** (single message, multiple `Agent` calls). Brief each with:
   - The `<ep-slug>.md` (the cited locations to mirror) and the absolute `$RESEARCH_DIR`
   - **The full "Workflow TS schema" + "Path binding" sections verbatim**
   - "Verify every `@source` and every `bindings.json` `source` by reading the file — do not guess. Prefer absolute paths."
   - "Emit `<ep-slug>.workflow.ts` + `<ep-slug>.bindings.json`, and append any new component to `components/<name>.d.ts`."
4. **Wait for all subagents.** Write/refresh `_flow.entities.d.ts` and `tsconfig.json`.
5. **Lint:** run `~/.claude/scripts/flow-reveal.mjs check $RESEARCH_DIR`. Fix any missing/past-EOF citation before continuing.
6. **Aggregate** all per-entry workflows into `$RESEARCH_DIR/flows.json`. Deduplicate packages by `id`.
7. **Update** `$RESEARCH_DIR/INDEX.md` — add `[workflow]` links and the `flows.json` line.
8. **Print** the research dir path and suggest `/flow-map` against `$RESEARCH_DIR/flows.json` for an interactive HTML view.

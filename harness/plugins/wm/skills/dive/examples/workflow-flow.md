> A filled `$WORKFLOWS_DIR` — every file the `workflow` route writes, for one real flow. Copy each
> block, replace the content, delete the `>` lines; each one states the rules for the block above it.
> The procedure that writes them and the rule lists they obey are `sub-workflow.md`.
> The flow below is the line-comment server's incremental-change path, whose research artifact is
> `dive-docs:examples/research-artifact.md`. The `workflow` route mirrors that artifact's cited
> locations, so the two must agree on every `path:line`.
> The prose follows `harness-dev:text-style`.

# workflow — the `anchor-reconcile` flow, filled

## The layout

```
.notes/workflows/                       # $WORKFLOWS_DIR
├── _flow.entities.d.ts                 # shared ambient types
├── tsconfig.json                       # one config for every flow folder
├── flows.json                          # aggregated flows document
├── components/
│   ├── session.d.ts                    # shared component declarations
│   └── anchor.d.ts
├── anchor-reconcile/                   # one folder per flow
│   ├── anchor-reconcile.workflow.ts
│   └── anchor-reconcile.bindings.json
└── did-open/
    ├── did-open.workflow.ts
    └── did-open.bindings.json
```

> **One folder per flow, named after the flow's `<ep-slug>`.** Workflow artifacts live in
> `$WORKFLOWS_DIR`, never in `$RESEARCH_DIR`.
> The four shared files sit at `$WORKFLOWS_DIR` itself and are appended to as flows are processed:
> `_flow.entities.d.ts` (ambient types every flow uses), `tsconfig.json` (one config covering every
> flow folder), `components/*.d.ts` (one declaration per app component, shared), and `flows.json`
> (written last, after every flow folder exists).
> A component declaration duplicated inside a flow folder is wrong — the flow files import it with
> `../`, which is what keeps one component to one declaration.

## `anchor-reconcile/anchor-reconcile.workflow.ts`

```ts
// Shared types + components live one level up, at $WORKFLOWS_DIR/.
import type { Change, Comment, Effect, StoreKey } from "../_flow.entities";
import { Anchor } from "../components/anchor";
import { Session } from "../components/session";

export const meta = {
  name: "anchor-reconcile",
  description: "How a stored line comment finds its line again after the file changes.",
};

export function flow(uri: string, changes: Change[]): Effect[] {
  const key: StoreKey | null = Session.key(uri);
  if (!key) {                                     // 01M22XEKBDETWCF2DCC4HZP9F9
    return [];
  }

  const before: Comment[] = Session.snapshot(key);
  let text = Session.documentText(uri);

  for (const change of changes) {
    if (change.range) {                           // 01M22XEKD6VAT48G3SM0V111NW
      const touched = Anchor.shiftForChange(Session.comments(key), change.range, change.text);
      text = Anchor.applyChange(text, change.range, change.text);
      Anchor.rehash(text, Session.comments(key), touched);
    } else {
      text = Anchor.applyChange(text, null, change.text);
      reanchorByHash(text, Session.comments(key));
    }
    Session.sortByLine(key);
  }

  Session.putDocument(uri, text);
  if (Session.snapshot(key) === before) {         // 01M22XEKD696A3NH3EG8N3GEDQ
    return [];
  }
  return ["PersistStore", "PublishDiagnostics"];
}

function reanchorByHash(text: string, comments: Comment[]): void {
  for (const comment of comments) {
    if (Anchor.lineHash(Anchor.lineAt(text, comment.line)) === comment.hash) {  // 01M22XEKD6NTM56YB9WC785Y6S
      comment.orphaned = false;
      continue;
    }
    const nearest = Anchor.nearestHashMatch(text, comment.hash, comment.line);
    if (nearest === null) {                       // 01M22XEKD6AJR0CE5EZ7VWTSTG
      comment.orphaned = true;
      continue;
    }
    Anchor.cover(comment, nearest, nearest + (comment.lastLine - comment.line));
    comment.orphaned = false;
  }
}
```

> **Typed TS pseudocode written as an imperative function** that reads top-to-bottom like the real
> code path. The file exports a `meta` object (`name` matching the `<ep-slug>`, plus a one-line
> `description`) and one pseudocode function per workflow — typically one, the entry point.
> **Clean, typed TS.** It parses and type-checks against `components/*.d.ts` + `_flow.entities.d.ts`.
> No raw paths inside the code, no `/* … */` blob hiding logic.
> **Components are typed symbols, not free identifiers.** Anything mapping to a real app component
> (`Anchor`, `Session`) is imported from `../components/<name>.d.ts`, which is what gives autocomplete.
> Declare the component in its `.d.ts` the first time you use it.
> **Imperative, top-to-bottom** — happy path and error path in execution order. No `steps[]` graph, no
> `id`/`calls` indirection.
> **Every branch visible**: each `if`, `switch`, early return, `throw`, and async fan-out is shown.
> **Every side effect visible**: `db.x`, `redis.x`, `emit`, `log`, `fs`, `http` calls are written out
> rather than hidden inside a helper.
> **A notable branch carries a trailing `// <ULID>`** — generate with `~/.claude/scripts/flow-ulid.mjs`
> and map each one in the sibling `bindings.json`. Plain control-flow scaffolding needs none; only a
> branch worth revealing earns a ULID.
> **One function per file**, except a major sub-workflow (≥ ~15 lines), which becomes a second function
> below, called from the first — `reanchorByHash` above.
> **≤ ~80 lines total.** Longer means the entry point is too wide; split it.
> Use namespaces to show component boundaries and group related functions.

## `components/anchor.d.ts`

```ts
/** Line anchoring — hashing, position arithmetic, shifting and reconciling.
 *  @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:1 */
export declare class Anchor {
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:8 */
  static lineHash(line: string): string;
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:45 */
  static applyChange(text: string, range: Range | null, newText: string): string;
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:64 */
  static shiftForChange(comments: Comment[], range: Range, newText: string): number[];
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:118 */
  static rehash(text: string, comments: Comment[], touched: number[]): void;
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:151 */
  static nearestHashMatch(text: string, hash: string, near: number): number | null;
  /** @source /Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/store.rs:50 */
  static cover(comment: Comment, line: number, endLine: number): void;
}
```

> **One declaration file per app component** referenced in the pseudocode. It declares the API, which
> is what gives autocomplete, and binds each symbol to its real source with a `@source <path:line>`
> JSDoc tag.
> The real source may be **any language** (Go, Rust, …) and **any repo** — the path lives in the tag,
> not in a TS declaration map.
> **Prefer an absolute path** in `@source`: the component may live in a different repo than the
> workflow notes. A relative path resolves against the open Zed worktree root.
> The class-level tag points at the component's home file; each member's tag points at that member's
> own declaration line.

## `anchor-reconcile/anchor-reconcile.bindings.json`

```json
{
  "01M22XEKBDETWCF2DCC4HZP9F9": { "kind": "if", "label": "not a served document", "source": "/Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/lib.rs:489" },
  "01M22XEKD6VAT48G3SM0V111NW": { "kind": "if", "label": "change carries a range", "source": "/Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/lib.rs:495" },
  "01M22XEKD696A3NH3EG8N3GEDQ": { "kind": "if", "label": "nothing moved", "source": "/Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/lib.rs:526" },
  "01M22XEKD6NTM56YB9WC785Y6S": { "kind": "if", "label": "stored line still matches", "source": "/Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:144" },
  "01M22XEKD6AJR0CE5EZ7VWTSTG": { "kind": "if", "label": "no match anywhere", "source": "/Users/vitaliipopov/git/dotfiles/harness/apps/line-comment/server/src/anchor.rs:157" }
}
```

> **Maps each notable-branch ULID to its real source.** It sits beside its own `.workflow.ts`, inside
> the flow folder — that sibling position is how `flow-reveal.mjs` finds it.
> One entry per ULID in the workflow file, and no entry without one: an orphan on either side is what
> the lint reports.
> **Prefer an absolute `source`** — it is used verbatim. A relative `source` resolves against the open
> Zed worktree root (`$ZED_WORKTREE_ROOT`); set `"repo": "<abs-path>"` on one entry to override the
> base for that branch alone.
> `label` is the branch as a reader would say it out loud, so the reveal list is readable without the
> code beside it.

## `tsconfig.json`

```json
{ "compilerOptions": { "noEmit": true, "checkJs": false, "module": "esnext", "moduleResolution": "bundler" },
  "include": ["*/*.workflow.ts", "components/*.d.ts", "_flow.entities.d.ts"] }
```

> At `$WORKFLOWS_DIR/` itself, and it is what makes the editor type-check and autocomplete every flow
> folder. The three `include` globs are the three kinds of file the route writes; adding a flow folder
> needs no edit here, because the first glob already covers it.

## `flows.json`

```jsonc
{
  "packages": [
    { "id": "server",  "label": "line-comment LSP server", "kind": "service", "path": "harness/apps/line-comment/server" },
    { "id": "zed",     "label": "Zed editor",              "kind": "app" },
    { "id": "store",   "label": ".tmp/line-comment.json",  "kind": "store" }
  ],
  "flows": [
    {
      "id": "anchor-reconcile",
      "label": "Re-anchor comments after a change",
      "description": "An edit shifts every stored anchor, re-hashes the lines it touched, and persists only when something moved.",
      "edges": [
        { "from": "zed",    "to": "server", "via": "textDocument/didChange", "payload": "{ uri, changes[] }",            "source": "harness/apps/line-comment/server/src/lib.rs:488" },
        { "from": "server", "to": "server", "via": "shiftForChange",         "payload": "{ comments, range, newText }",  "source": "harness/apps/line-comment/server/src/anchor.rs:64" },
        { "from": "server", "to": "store",  "via": "PersistStore",           "payload": "{ version, files }",            "source": "harness/apps/line-comment/server/src/store.rs:101" },
        { "from": "server", "to": "zed",    "via": "publishDiagnostics",     "payload": "{ uri, diagnostics[] }",        "source": "harness/apps/line-comment/server/src/lib.rs:527" }
      ]
    }
  ]
}
```

> Written **after every flow folder exists**, at `$WORKFLOWS_DIR/flows.json`, and it is what the
> `explore-flow-map` skill renders as interactive HTML.
> Every `from` and `to` references a `packages[].id`. Every `source` is a verified `path:line`.
> Derive `packages[].id` from the cited source files inside each `<ep-slug>` artifact — the top-level
> directory or the repo package of the cited file — and deduplicate by `id` when flows are combined.
> `kind` says what the package is (`app`, `service`, `store`), and a package with no source directory
> of its own — an external editor, a hosted queue — carries no `path`.

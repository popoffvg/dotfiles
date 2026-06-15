---
name: explore
description: Research phase before implementation. Given a list of entry points, spawn one subagent per entry point in parallel and write refactor-oriented research artifacts into the work-manager notes directory (`<notes-dir>/research/`). Use when the user says "explore", "research these entry points", or provides a list of files/symbols to investigate before starting a task. To render the resulting flows as an interactive HTML, use the `explore-flow-map` skill.
argument-hint: "list of entry points (files, symbols, urls)"
---

## Purpose

Build a shared understanding of unknown code **before** the task is implemented. The user provides N entry points; you spawn N subagents in parallel, each producing artifacts so a downstream agent (or human) can navigate the territory without re-reading the codebase.

Output lives inside the work-manager **notes directory** for the current task so it persists with the rest of the planning context (`spec.md`, `worklog.md`, `todos/`) and ships with the work, instead of vanishing from `$TMPDIR`.

## Inputs

A list of entry points. Each may be:
- A file path (`src/server/index.ts`)
- A symbol (`HandleRequest`, `userController.create`)
- A URL or doc reference

If user provides a free-form description, use cocoindex to find relevant entry points.

## Output location

`<notes-dir>` is the work-manager notes directory for the active task (commonly `.notes/`). Resolve it from the phase context:

- If a work-manager flow is active, use its notes dir (typically `.notes/` at repo root).
- If no flow is active, default to `./.notes/` in the current working directory and tell the user.
- The user may override with `--notes-dir <path>`.

Create the research subdirectory:

```bash
NOTES_DIR="${NOTES_DIR:-.notes}"
RESEARCH_DIR="$NOTES_DIR/research"
mkdir -p "$RESEARCH_DIR"
```

Per entry point `<ep-slug>`, three files in `$RESEARCH_DIR/`:

| File | Purpose |
|---|---|
| `<ep-slug>.questions.md` | Grill-phase questions the explorer must answer |
| `<ep-slug>.md` | Scannable refactor-oriented write-up. **Follow the mandatory structure in "MD artifact structure" below.** Every claim links to `path:line`. |
| `<ep-slug>.workflow.ts` | Typed TS pseudocode — clean, no inline paths (see "Workflow TS schema" below) |
| `<ep-slug>.bindings.json` | ULID → real source for the notable `if` branches in the workflow (see schema) |

Plus, shared across the research dir (write once, append as entry points are explored):

| File | Purpose |
|---|---|
| `components/<name>.d.ts` | Typed declaration of each app component referenced in pseudocode, with a `@source` tag to its real (possibly non-TS) source. Powers autocomplete + reveal. |
| `_flow.entities.d.ts` | Shared ambient types used by the workflow files (`Request`, `Response`, domain types, the binding shapes) |
| `tsconfig.json` | Includes the workflow files + `components/*.d.ts` + `_flow.entities.d.ts` so the editor's TS server offers autocomplete/diagnostics |

Plus, after all subagents finish:

| File | Purpose |
|---|---|
| `flows.json` | Aggregated flows document — input for `explore-flow-map` |
| `INDEX.md` | One-line summary + links per entry point |

The previous `$TMPDIR/claude-explore/` location is deprecated.

## Result criteria — the 6-step chain (MANDATORY)

Every artifact is graded against a 6-step chain. The chain is the **result criteria**, not a reading recipe: the finished `.md` must demonstrably cover all six, in this order. The convergence loop (below) re-spawns any entry point whose artifact leaves a step thin.

| # | Step | Where it lands in the `.md` | Why it matters |
|---|---|---|---|
| 1 | **Entry point** | Title + Scope | Names the exact symbol/file the path starts at. |
| 2 | **Tests** | `## Intent (tests)` | Tests pin *intent* before implementation. Read them first; an artifact with no test trail can't claim it understood what the code is *for*. |
| 3 | **Follow data** | `## 3. Identity / data carriers` | Trace what value carries identity/state through the path. |
| 4 | **Skip noise** | Scope → **Out of scope** | State what was deliberately ignored, so a reader knows the gaps are intentional. |
| 5 | **Failure path** | `## 2. Decision points` + `## 5. Edge cases` | Every branch, throw, partial-failure, rollback. |
| 6 | **One-sentence trace** | `## Trace` (closing line) | One sentence, entry→exit. Forces clarity and **surfaces gaps** — if you can't write it, the artifact is incomplete. |

## MD artifact structure (MANDATORY)

The `.md` is read by humans planning refactors. Prose paragraphs are forbidden as the primary form — use the headings below in this order. Each section is short, scannable, and citation-dense.

Use markdown links for code references: `[packageName|typeName.functionName](path:line)`

```md
# <Title> — <scope one-liner>

**Scope.** What this doc covers. **Out of scope.** What it doesn't — the noise deliberately skipped (step 4).

**source list**:
<repo>:<short commit hash>

## Terms
The table contains terms used in the workflow and the related area.

## Intent (tests)
Tests-first (step 2). Table: | Test | What intent it pins | Source (file:line) |.
One row per test that exercises this path. If no tests cover it, write "None — UNTESTED PATH" and flag it as a refactor risk (§6). Read tests before claiming you understood intent.

## TL;DR
ASCII flow diagram — the whole pipeline at a glance, using `→`, `│`, `▼`, branches with `├─`/`└─`. No prose.

## 1. Workflow steps
Numbered table: | # | Step | File:line |. One row per atomic operation in happy-path order.
If there are parallel paths (e.g. prerun + main), use a second sub-table per path.

## 2. Decision points
Each decision is `DP-N` with:
- **Condition** (the exact predicate / field check)
- **Branches** as a small table or bullets, each with effect + file:line
- Cross-link to relevant EC-N if a branch has a known edge case

## 3. Identity / data carriers (when relevant)
Table: what value carries identity at each layer, how equality is defined, which fields are mutated vs immutable.

## 4. Per-variant shapes (when relevant)
Table of shape + conflict key + conflict resolution for each polymorphic case (dataset type, resource kind, message variant, …).

## 5. Edge cases
Numbered `EC-N` table: | # | Case | Effect | Source (file:line) |.
Be adversarial: empty inputs, races, partial failure, encoder ambiguity, duplicate keys, deleted resources, iteration-order non-determinism, cache staleness.

## 6. Refactor risks (hotspots)
Table: | Hotspot | Why it bites |. One row per surface that future changes will trip on — coupling, hidden invariants, non-deterministic ordering, missing rollback, silent overwrites, undocumented contracts.

## 7. File map
Table: | File | Role |. Every file referenced anywhere above.

## Grill answers
Numbered answers to every question from `<ep-slug>.questions.md`, in the same order. This is the verification trail.

## Trace
One-sentence trace (step 6), entry→exit: "<entry> <verb>s <data> through <key steps>, branching on <decision>, returning <result> / failing to <failure>." If you cannot write this in one sentence, the artifact is incomplete — go back.
```

**Rules.**
- Tables over prose. Prose only inside "Scope", the closing Trace, and per-row clarifiers.
- Every `path:line` must be verified — open the file before you cite it.
- Decision points and edge cases are numbered (`DP-1`, `EC-1`, …) so other docs and TODOs can reference them.
- If a section is genuinely empty (e.g. no decisions), write "None." rather than omitting the heading.
- All 6 chain steps must be covered (see "Result criteria"). A thin step is a gap the convergence loop will catch and re-spawn.

## Workflow TS schema

Each `<ep-slug>.workflow.ts` is **typed TS pseudocode written as an imperative function** that reads top-to-bottom like the real code path. It is **clean TypeScript** — no inline `// path:line` clutter. Real source is bound out-of-band, in two layers, so the file stays readable, type-checks, and **autocompletes** in the editor, while every step can still be revealed to its real (possibly non-TS) source.

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
- **Clean, typed TS.** Parses and type-checks against the `components/*.d.ts` + `_flow.entities.d.ts`. No raw paths inside the code, no `/* ... */` blobs hiding logic.
- **Components are typed symbols, not free identifiers.** Anything that maps to a real app component (e.g. `RunnerController`) is referenced via an `import` from `./components/<name>.d.ts`. This is what gives autocomplete. Declare the component in its `.d.ts` (below) the first time you use it.
- **Imperative, top-to-bottom.** Happy + error paths in execution order. No `steps[]` graph, no `id`/`calls` indirection.
- **All branches visible.** Every `if`, `switch`, early return, `throw`, async fan-out is shown.
- **Notable branches carry a ULID.** A branch that maps to real branching logic gets a trailing `// <ULID>` comment (generate with `~/.claude/scripts/flow-ulid.mjs`). Map each ULID to its real source in `<ep-slug>.bindings.json`. Plain control-flow scaffolding needs no ULID — only the branches worth revealing.
- **All side effects visible.** Show `db.x`, `redis.x`, `emit`, `log`, `fs`, `http` calls — don't hide them inside helpers.
- **One function per file.** Major sub-workflow (≥ ~15 lines) → a second function below, called from the first.
- **≤ ~80 lines total.** If longer, you're documenting too much — split the entry point.
- Use namespaces to show component boundaries and group related functions.

### Component declarations — `components/<name>.d.ts`

One declaration file per app component referenced in pseudocode. Declares the API (for autocomplete) and binds each symbol to its **real source** with a `@source <path:line>` JSDoc tag. The real source may be **any language** (Go, Rust, …) and **any repo** — the path lives in the tag, not in a TS declaration map.

**Prefer absolute paths** in `@source` (unambiguous and repo-independent — the component may live in a different repo than the workflow notes). A relative path is resolved against the open Zed worktree root.

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

**Prefer an absolute `source`** (used verbatim). A relative `source` resolves against the open Zed worktree root (`$ZED_WORKTREE_ROOT`); set `"repo": "<abs-path>"` on an entry to override the base for that one branch.

### Verify + autocomplete plumbing

- **Verify every citation.** Open each `@source` and each `bindings.json` `source` before writing it. Then run the lint:
  `~/.claude/scripts/flow-reveal.mjs check <research-dir>` — fails if any ULID/`@source` points at a missing path or past-EOF line.
- **`tsconfig.json`** in the research dir makes the editor type-check + autocomplete the workflow files:
  ```json
  { "compilerOptions": { "noEmit": true, "checkJs": false, "module": "esnext", "moduleResolution": "bundler" },
    "include": ["*.workflow.ts", "components/*.d.ts", "_flow.entities.d.ts"] }
  ```
- **Reveal in the editor (Zed):** cursor on a notable-`if` line → reveal key opens its real source via the ULID; for a component, `cmd-click` jumps into its `.d.ts`, then the reveal key on that line opens the `@source`. Both run `flow-reveal.mjs reveal`. See `.config/zed/tasks.json` + `keymap.json`.

Cross-reference: the `.md` artifact's "Workflow steps" table is the human-readable index (markdown `path:line` links); this `.workflow.ts` + its `bindings.json`/`components` are the machine-readable, navigable spec. They must agree on the cited locations.

## Aggregated `flows.json`

After all subagents finish, combine their workflows into a single document at `$RESEARCH_DIR/flows.json` that the `explore-flow-map` skill renders as interactive HTML. Schema:

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

Rules: every `from`/`to` references a package `id`. Every `source` is a verified `path:line`. Derive `packages[].id` from the `// path:line` anchors inside each `<ep-slug>.workflow.ts` function (top-level dir or repo package of the cited file).

## INDEX.md

Write `$RESEARCH_DIR/INDEX.md` so the planner can find each artifact at a glance:

```markdown
# Research index — <task slug>

Generated: <ISO date>

| Entry point | Slug | Artifacts | Summary |
|---|---|---|---|
| `src/server/index.ts` | server-index | [md](server-index.md) · [workflow](server-index.workflow.ts) · [questions](server-index.questions.md) | HTTP request lifecycle from router to response |
| `HandleRequest` | handle-request | [md](handle-request.md) · [workflow](handle-request.workflow.ts) · [questions](handle-request.questions.md) | Dispatch + middleware chain |

**Aggregated flows:** [flows.json](flows.json) — render with `/flow-map`.
```

## Procedure

1. **Resolve task slug.** Use the user's task description, kebab-case, max 40 chars. Save in shell var `TASK_SLUG`.
2. **Resolve `<notes-dir>`.** Prefer the active work-manager notes dir; fall back to `./.notes/`. Create `$RESEARCH_DIR = $NOTES_DIR/research` if missing.
3. **Check for prior runs.** If `$RESEARCH_DIR/INDEX.md` exists, ask the user whether to *append*, *overwrite*, or *bail*. Don't silently overwrite previous research.
4. **Generate question lists** (see "Grill phase" below): run Opus via `claude` CLI per entry point to produce `$RESEARCH_DIR/<ep-slug>.questions.md`. These are questions the explorer must answer — not questions for the user.
5. **For each entry point, spawn an Explore subagent in parallel** (single message, multiple `Agent` tool calls). Brief each with:
   - The specific entry point
   - The output directory (`$RESEARCH_DIR`, absolute path)
   - The contents of `<ep-slug>.questions.md` — explorer must answer each question in a `## Grill answers` section at the bottom of the `.md` artifact
   - Required artifacts and their schemas — **copy the "MD artifact structure" section verbatim into the prompt** so the explorer cannot fall back to prose
   - "Verify every `path:line` by reading the file — do not guess"
   - "The primary reader is someone planning a refactor. They want to scan steps, decision points, and edge cases in seconds. No paragraphs of prose."
6. **Wait for all subagents to finish.**
7. **Run the convergence loop** (see below) until research converges. Only then continue.
8. **Aggregate** all per-entry workflows into `$RESEARCH_DIR/flows.json` (schema above). Deduplicate packages by `id`.
9. **Write** `$RESEARCH_DIR/INDEX.md` (template above).
10. **Append worklog entry** to `<notes-dir>/worklog.md` if it exists.
11. **Print the research dir path** and suggest running `/flow-map` against `$RESEARCH_DIR/flows.json` for an interactive HTML view.

## Convergence loop (autonomous)

A single fan-out misses two things: a **wrong/incomplete entry-point set** (a path nobody was told to explore) and **uncovered edge cases** (the failure path step left thin). The loop closes both. It runs autonomously — no user in the loop — and is the explore analogue of `grill-me`'s relentless questioning: keep probing until nothing new surfaces.

Maintain `seen` = set of (entry-point slug) already explored, and `dry` = count of consecutive rounds that surfaced no new gap. Loop:

1. **Critique every artifact against the 6-step chain.** For each `<ep-slug>.md`, spawn one read-only critic subagent (`subagent_type: "Explore"`) that returns a structured gap list. A step is a **gap** when:
   - **Tests (2):** marked UNTESTED but tests exist, or test rows cite paths that don't exercise this path.
   - **Follow data (3):** an identity/data carrier named in the workflow has no row.
   - **Failure path (5):** a branch/`throw`/early-return in `<ep-slug>.workflow.ts` has no matching DP-N/EC-N, or a partial-failure has no rollback note.
   - **One-sentence trace (6):** missing, or it references a step/branch absent from the body (= the body is incomplete, not the trace).
2. **Discover missed entry points.** The critic also reports **new entry points** referenced by the explored path but never explored — downstream calls, dispatched handlers, fan-out targets, error sinks. Filter against `seen` and against the task scope (drop clearly out-of-scope ones; **log what was dropped** with a one-line reason).
3. **If no fresh gaps and no new entry points:** `dry++`. Else `dry = 0`.
4. **Stop when `dry >= 2`** (two consecutive clean rounds) or after **4 rounds total** — whichever first. Log the stop reason and any still-open gaps.
5. **Otherwise re-spawn** a parallel round (single message, multiple `Agent` calls):
   - For each gapped artifact: an explorer briefed with the specific gaps to fill — it **edits the existing `.md` in place**, not a rewrite.
   - For each new in-scope entry point: a fresh explorer with full artifact requirements (generate its `.questions.md` first, as in step 4 of the Procedure). Add it to `seen`.
   Then return to loop step 1.

Log each round: `round N — <k> gaps, <m> new entry points, dry=<d>`. Never silently cap — if you stop at the 4-round limit with open gaps, print them.

## Grill phase — generate questions FOR the explorer

The explorer subagent works better when it has a sharp question list. We use `grill-me` not to interview the user but to **interrogate the entry point itself**: a separate Claude Opus CLI process is asked to act as a paranoid reviewer and produce the questions the explorer must answer.

For each entry point, spawn one Haiku CLI call (these can run in parallel via shell `&`):

```bash
EP="<entry-point>"
EP_SLUG="<ep-slug>"
QFILE="$RESEARCH_DIR/$EP_SLUG.questions.md"

cat <<PROMPT | claude --model haiku --print --output-format text > "$QFILE"
/grill-me

You are NOT interviewing a human. You are grilling the codebase entry point below to generate a research agenda for another agent (the "explorer") that will read the code and answer your questions.

Entry point: $EP
Task context: <one-line task description>

The explorer will use your questions to populate a refactor-oriented artifact graded against a 6-step chain: entry point → tests → follow data → skip noise → failure path → one-sentence trace. Bias your questions so the explorer is forced to satisfy every step.

Produce a markdown file with sections:

## Intent / test questions (tests-first)
- Which tests exercise this path, and what intent does each pin (the behaviour the code must keep)?
- Is any part of the path UNTESTED? Which branch has no test?
- Do the tests reveal intent the implementation hides (edge cases asserted, error messages pinned)?

## Workflow-step questions
- What are the ordered atomic steps from entry to exit on the happy path?
- For each step, what is the exact file:line and what state does it touch?

## Decision-point questions
- What every \`if\`/\`switch\`/dispatch table branches on; what fields it checks; what each branch does differently.
- Where the code forks into parallel paths (prerun/main, sync/async, fast-path/slow-path) and what carries identity across the fork.

## Edge-case questions (adversarial)
- Empty inputs, single-element inputs, duplicate keys, key collisions.
- Race conditions, iteration-order non-determinism, concurrent mutation.
- Partial failure mid-loop: what state has already been mutated and is there a rollback?
- Deleted/missing referenced resources, stale caches, encoder ambiguity (same input → different serialisation?).
- Silent overwrites, silent drops (\`continue\` on missing field), asymmetric branches across similar handlers.

## Identity & invariant questions
- What is "identity" at each layer (handle string, resource ID, hash, axis key, …) and how is equality defined?
- Which fields are mutable vs locked-after-creation? Which are part of dedup keys vs annotations?

## Refactor-hotspot questions
- Which surfaces couple multiple files (schema + dispatcher + handler)?
- Which contracts are implicit (cache key formula, iteration order, name canonicalisation)?
- Where would a future change most likely cause silent data loss or stale cache?

## Surprises / gotchas
- What would a new contributor most likely get wrong?

Each question must be answerable by reading the code. Be specific and adversarial — assume the code has hidden complexity. No questions for humans.
PROMPT
```

Outputs: one `<ep-slug>.questions.md` per entry point in `$RESEARCH_DIR`. These files become required input to the matching explorer subagent.

Notes:
- `--print` keeps it non-interactive: Opus generates the question list and exits.
- If `claude` CLI is unavailable, the main agent invokes `grill-me` in-session (sequentially per entry point) to produce the same `.questions.md` files.
- Keep the model id in one place — change once if Opus version changes.

## Parallel subagents — important

- All subagent calls must be in **one assistant message** to actually run in parallel.
- Use `subagent_type: "Explore"` for read-only investigation. If the entry point needs deeper reasoning (cross-file design questions), use `general-purpose`.
- Each subagent gets a self-contained prompt — they cannot see this conversation. Include the entry point's grill questions verbatim and the absolute `$RESEARCH_DIR` path.

## Integration with work-manager

- During the **research phase**, `explore-research` saves coarse findings as `<notes-dir>/research-*.md`. `explore` complements that with per-entry-point deep dives under `<notes-dir>/research/`.
- During **spec phase**, `spec` (`write` / `todo` subcommands) may reference `research/<ep-slug>.md#DP-N` or `#EC-N` from a TODO's **Pre-reads** so the implementer doesn't re-derive the analysis.
- `research/` is committed alongside `spec.md` and `todos/` — it travels with the task.

## What this skill is NOT

- Not implementation. No code edits to the target codebase.
- Not a code review.
- Not a planning doc. The workflow.ts files are descriptive, not prescriptive.

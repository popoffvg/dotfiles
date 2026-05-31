---
name: explore
description: Research phase before implementation. Given a list of entry points, spawn one subagent per entry point in parallel and write refactor-oriented research artifacts into the work-manager notes directory (`<notes-dir>/research/`). Use when the user says "explore", "research these entry points", or provides a list of files/symbols to investigate before starting a task. To render the resulting flows as an interactive HTML, use the `flow-map` skill.
argument-hint: "list of entry points (files, symbols, urls)"
---

## Purpose

Build a shared understanding of unknown code **before** the task is implemented. The user provides N entry points; you spawn N subagents in parallel, each producing artifacts so a downstream agent (or human) can navigate the territory without re-reading the codebase.

Output lives inside the work-manager **notes directory** for the current task so it persists with the rest of the planning context (`plan.md`, `worklog.md`, `todos/`) and ships with the work, instead of vanishing from `$TMPDIR`.

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
NOTES_DIR="${NOTES_DIR:-_notes}"
RESEARCH_DIR="$NOTES_DIR/research"
mkdir -p "$RESEARCH_DIR"
```

Per entry point `<ep-slug>`, three files in `$RESEARCH_DIR/`:

| File | Purpose |
|---|---|
| `<ep-slug>.questions.md` | Grill-phase questions the explorer must answer |
| `<ep-slug>.md` | Scannable refactor-oriented write-up. **Follow the mandatory structure in "MD artifact structure" below.** Every claim links to `path:line`. |
| `<ep-slug>.workflow.ts` | Human-readable workflow definition (see schema below) |

Plus, after all subagents finish:

| File | Purpose |
|---|---|
| `flows.json` | Aggregated flows document — input for `flow-map` |
| `INDEX.md` | One-line summary + links per entry point |

The previous `$TMPDIR/claude-explore/` location is deprecated.

## MD artifact structure (MANDATORY)

The `.md` is read by humans planning refactors. Prose paragraphs are forbidden as the primary form — use the headings below in this order. Each section is short, scannable, and citation-dense.

Use markdown links for code references: `[packageName|typeName.functionName](path:line)`

```md
# <Title> — <scope one-liner>

**Scope.** What this doc covers. **Out of scope.** What it doesn't.

## Terms
The table contains terms used in the workflow and the related area.

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
```

**Rules.**
- Tables over prose. Prose only inside "Scope" and per-row clarifiers.
- Every `path:line` must be verified — open the file before you cite it.
- Decision points and edge cases are numbered (`DP-1`, `EC-1`, …) so other docs and TODOs can reference them.
- If a section is genuinely empty (e.g. no decisions), write "None." rather than omitting the heading.

## Workflow TS schema

Each `<ep-slug>.workflow.ts` is **TS pseudocode written as an imperative function** that reads top-to-bottom like the real code path. Same notation as `plan-flow` — real TS syntax, fake bodies, every meaningful line anchored to a verified `path:line` in a trailing or leading comment.

The file exports:
1. A `meta` object with name + description.
2. One pseudocode function per workflow (typically one — the entry point).

```ts
export const meta = {
  name: "handle-request",        // matches <ep-slug>
  description: "HTTP request lifecycle from router to response.",
};

// Imperative pseudocode. Each line annotated with the file:line where the
// real logic lives. Reads top-to-bottom like the actual code path.
// The pseudocode should start with the entry point called `flow` and read like a real code path.
export function flow(req: Request): Response {
  const body = parseBody(req);                          // src/server.ts:42
  if (!validate(body)) {                                // src/validator.ts:10
    return reject(400, "invalid body");                 // src/errors.ts:5
  }

  const handler = dispatch(body.action);                // src/router.ts:88
  if (!handler) {
    return reject(404, "no route");                     // src/router.ts:104
  }

  try {
    const result = handler(body);                       // src/handlers/*.ts
    return write(200, result);                          // src/server.ts:120
  } catch (e) {
    log.error("handler crashed", { action: body.action, e }); // src/server.ts:131
    return reject(500, "internal");                     // src/errors.ts:18
  }
}
```

Rules:
- **Real TS syntax, fake bodies.** Parses as TS; replace internals with one-line calls + `// path:line` anchors. No `/* ... */` blobs hiding logic.
- **Imperative, top-to-bottom.** Reads like the happy + error paths in execution order. No `steps[]` graph, no `id`/`calls` indirection.
- **Every meaningful line has a `// path:line` anchor** to a location you opened and verified. Lines that just declare a local need no anchor.
- **All branches visible.** Every `if`, `switch`, early return, `throw`, async fan-out is shown.
- **All side effects visible.** Show `db.x`, `redis.x`, `emit`, `log`, `fs`, `http` calls — don't hide them inside helpers.
- **One function per file.** If the entry point fans out into a major sub-workflow (≥ ~15 lines of its own logic), add a second function below the first and call it from the first.
- **≤ ~80 lines total.** If you need more, you're documenting too much — split the entry point.
- **No imports, no real file paths inside identifiers.** Real paths live only in `// path:line` comments.
- For parallel paths (prerun + main, fast/slow path, sync/async), use two functions and a top-level orchestrator that calls them, mirroring the real fork.
- use namespaces to show the component boundaries and group related functions together

Cross-reference: the `.md` artifact's "Workflow steps" table is the human-readable index; this `.workflow.ts` is the machine-readable code-shaped spec. They must agree on file:line citations.

## Aggregated `flows.json`

After all subagents finish, combine their workflows into a single document at `$RESEARCH_DIR/flows.json` that the `flow-map` skill renders as interactive HTML. Schema:

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
2. **Resolve `<notes-dir>`.** Prefer the active work-manager notes dir; fall back to `./_notes/`. Create `$RESEARCH_DIR = $NOTES_DIR/research` if missing.
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
7. **Aggregate** all per-entry workflows into `$RESEARCH_DIR/flows.json` (schema above). Deduplicate packages by `id`.
8. **Write** `$RESEARCH_DIR/INDEX.md` (template above).
9. **Append worklog entry** to `<notes-dir>/worklog.md` if it exists.
10. **Print the research dir path** and suggest running `/flow-map` against `$RESEARCH_DIR/flows.json` for an interactive HTML view.

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

The explorer will use your questions to populate a refactor-oriented artifact organised as: workflow steps, decision points (DP-N), edge cases (EC-N), refactor hotspots. Bias your questions so the explorer is forced to surface those.

Produce a markdown file with sections:

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

- During the **research phase**, `research` saves coarse findings as `<notes-dir>/research-*.md`. `explore` complements that with per-entry-point deep dives under `<notes-dir>/research/`.
- During **plan phase**, `plan` / `todo-prepare` may reference `research/<ep-slug>.md#DP-N` or `#EC-N` from a TODO's **Pre-reads** so the implementer doesn't re-derive the analysis.
- `research/` is committed alongside `plan.md` and `todos/` — it travels with the task.

## What this skill is NOT

- Not implementation. No code edits to the target codebase.
- Not a code review.
- Not a planning doc. The workflow.ts files are descriptive, not prescriptive.

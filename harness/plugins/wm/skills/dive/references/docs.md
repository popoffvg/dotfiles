# dive · docs route (default)

Write the **markdown research artifacts + question lists**. One `.questions.md` and one `.md` per entry point. Prose write-up graded against the 6-step chain. No `.workflow.ts`, no bindings — that is the `workflow` route. 

After one round of research, find the missing part and start another round of exploration.

For every round of exploration use parallel subagents to explore different entry points.

Stop when you don't have any blindspots left to explore.

## Parallel subagents — important 

- All subagent calls must be in **one assistant message** to actually run in parallel.
- Use `subagent_type: "explore"` with `model: "sonnet"` for read-only investigation. If an entry point needs deeper reasoning (cross-file design questions), use `general-purpose`.
- Each subagent gets a self-contained prompt — they cannot see this conversation. Include the entry point's inputs verbatim (grill questions for `docs`; the `.md` + schema for `workflow`) and the absolute `$RESEARCH_DIR` path.

## Output

Per entry point `<ep-slug>`, two files in `$RESEARCH_DIR/`:

| File | Purpose |
|---|---|
| `<ep-slug>.questions.md` | Grill-phase questions the explorer must answer |
| `<ep-slug>.md` | Scannable refactor-oriented write-up. **Follow "MD artifact structure" below.** Every claim links to `path:line`. |

After all subagents finish:

| File | Purpose |
|---|---|
| `INDEX.md` | One-line summary + links per entry point |

## Result criteria — the 6-step chain (MANDATORY)

Every `.md` is graded against a 6-step chain. The chain is the **result criteria**, not a reading
recipe: the finished `.md` must demonstrably cover all six, in this order. The convergence loop
re-spawns any entry point whose artifact leaves a step thin.

| # | Step | Where it lands in the `.md` | Why it matters |
|---|---|---|---|
| 1 | **Entry point** | Title + Scope | Names the exact symbol/file the path starts at. |
| 2 | **Tests** | `## Intent (tests)` | Tests pin *intent* before implementation. Read them first; an artifact with no test trail can't claim it understood what the code is *for*. |
| 3 | **Follow data** | `## 3. Identity / data carriers` | Trace what value carries identity/state through the path. |
| 4 | **Skip noise** | Scope → **Out of scope** | State what was deliberately ignored, so a reader knows the gaps are intentional. |
| 5 | **Failure path** | `## 2. Decision points` + `## 5. Edge cases` | Every branch, throw, partial-failure, rollback. |
| 6 | **One-sentence trace** | `## Trace` (closing line) | One sentence, entry→exit. Forces clarity and **surfaces gaps** — if you can't write it, the artifact is incomplete. |

## MD artifact structure (MANDATORY)

The `.md` is read by humans planning refactors. Prose paragraphs are forbidden as the primary form —
use the headings below in this order. Each section is short, scannable, and citation-dense.

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
Use mermaid diagrams to visualize the workflow flow. Don't use ASCII art flow diagrams.

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
- All 6 chain steps must be covered. A thin step is a gap the convergence loop will catch and re-spawn.

## Procedure

1. **Resolve task slug.** User's task description, kebab-case, max 40 chars. Save as `TASK_SLUG`.
2. **Resolve `<notes-dir>` and `$RESEARCH_DIR`** (see router "Output location"). Create `$RESEARCH_DIR` if missing.
3. **Check for prior runs.** If `$RESEARCH_DIR/INDEX.md` exists, ask the user: *append*, *overwrite*, or *bail*. Never silently overwrite.
4. **Generate question lists** (see "Grill phase" below): one `$RESEARCH_DIR/<ep-slug>.questions.md` per entry point. These are questions the explorer must answer — not questions for the user.
5. **For each entry point, spawn an `explore` subagent in parallel** (`subagent_type: "explore"`, `model: "sonnet"`; single message, multiple `Agent` calls). Brief each with:
   - The specific entry point
   - The output directory (`$RESEARCH_DIR`, absolute path)
   - The contents of `<ep-slug>.questions.md` — explorer answers each in a `## Grill answers` section at the bottom of the `.md`
   - **Copy the "MD artifact structure" section verbatim into the prompt** so the explorer cannot fall back to prose
   - "Verify every `path:line` by reading the file — do not guess"
   - "The primary reader is someone planning a refactor. They want to scan steps, decision points, and edge cases in seconds. No paragraphs of prose."
6. **Wait for all subagents to finish.**
7. **Run the convergence loop** (below) until research converges.
8. **Write** `$RESEARCH_DIR/INDEX.md` (template below).
9. **Append worklog entry** to `<notes-dir>/worklog.md` if it exists.
10. **Print** the research dir path. Suggest `/dive workflow` to add the navigable TS pseudocode + bindings layer.

## Convergence loop (autonomous)

A single fan-out misses two things: a **wrong/incomplete entry-point set** (a path nobody was told
to explore) and **uncovered edge cases** (the failure path step left thin). The loop closes both. It
runs autonomously — no user in the loop — and is the explore analogue of `grill-me`'s relentless
questioning: keep probing until nothing new surfaces.

Maintain `seen` = set of explored entry-point slugs, and `dry` = count of consecutive rounds with no
new gap. Loop:

1. **Critique every artifact against the 6-step chain.** For each `<ep-slug>.md`, spawn one read-only critic subagent (`subagent_type: "explore"`, `model: "sonnet"`) that returns a structured gap list. A step is a **gap** when:
   - **Tests (2):** marked UNTESTED but tests exist, or test rows cite paths that don't exercise this path.
   - **Follow data (3):** an identity/data carrier named in the path has no row.
   - **Failure path (5):** a branch/`throw`/early-return in the path has no matching DP-N/EC-N, or a partial-failure has no rollback note.
   - **One-sentence trace (6):** missing, or it references a step/branch absent from the body (= the body is incomplete, not the trace).
2. **Discover missed entry points.** The critic also reports **new entry points** referenced by the explored path but never explored — downstream calls, dispatched handlers, fan-out targets, error sinks. Filter against `seen` and task scope (drop out-of-scope ones; **log what was dropped** with a one-line reason).
3. **If no fresh gaps and no new entry points:** `dry++`. Else `dry = 0`.
4. **Stop when `dry >= 2`** (two consecutive clean rounds) or after **4 rounds total** — whichever first. Log the stop reason and any still-open gaps.
5. **Otherwise re-spawn** a parallel round (single message, multiple `Agent` calls):
   - For each gapped artifact: an explorer briefed with the specific gaps to fill — it **edits the existing `.md` in place**, not a rewrite.
   - For each new in-scope entry point: a fresh explorer with full artifact requirements (generate its `.questions.md` first). Add it to `seen`.
   Then return to loop step 1.

Log each round: `round N — <k> gaps, <m> new entry points, dry=<d>`. Never silently cap — if you stop at the 4-round limit with open gaps, print them.

## Grill phase — generate questions FOR the explorer

The explorer subagent works better with a sharp question list. Use `grill-me` not to interview the
user but to **interrogate the entry point itself**: a separate Claude CLI process acts as a paranoid
reviewer and produces the questions the explorer must answer.

For each entry point, spawn one CLI call (these can run in parallel via shell `&`):

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

Outputs: one `<ep-slug>.questions.md` per entry point in `$RESEARCH_DIR`. Required input to the matching explorer subagent.

Notes:
- `--print` keeps it non-interactive: the CLI generates the question list and exits.
- If `claude` CLI is unavailable, invoke `grill-me` in-session (sequentially per entry point) to produce the same `.questions.md` files.

## INDEX.md

Write `$RESEARCH_DIR/INDEX.md` so the architector finds each artifact at a glance:

```markdown
# Research index — <task slug>

Generated: <ISO date>

| Entry point | Slug | Artifacts | Summary |
|---|---|---|---|
| `src/server/index.ts` | server-index | [md](server-index.md) · [questions](server-index.questions.md) | HTTP request lifecycle from router to response |
| `HandleRequest` | handle-request | [md](handle-request.md) · [questions](handle-request.questions.md) | Dispatch + middleware chain |

**Workflow layer:** run `/dive workflow` to add `<ep-slug>.workflow.ts` + `flows.json` (render with `/flow-map`).
```

If the `workflow` route already ran, add its `[workflow]` / `[flows.json]` links to the table.

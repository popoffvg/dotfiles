# explore · docs route (default)

Write the **markdown research artifacts**. One `.md` per entry point. Prose write-up graded against the 6-step chain. No `.workflow.ts`, no bindings — that is the `workflow` route. No `.questions.md` — grilling happens against the artifact, not a separate file.

Three phases, in order:

```
1. Find entry point (if not provided)  →  2. Explore entry point  →  3. Grill-me loop (reveal blindspots)
```

Each grill round reshapes the `.md` in place. Stop when grilling stops surfacing new gaps.

## Output

Per entry point `<ep-slug>`, one file in `$RESEARCH_DIR/`:

| File | Purpose |
|---|---|
| `<ep-slug>.md` | Scannable refactor-oriented write-up. **Follow "MD artifact structure" below.** Every claim links to `path:line`. Grill findings fold into the body — no separate question file. |

After all entry points finish:

| File | Purpose |
|---|---|
| `INDEX.md` | One-line summary + links per entry point |

## Result criteria — the 6-step chain (MANDATORY)

Every `.md` is graded against a 6-step chain. The chain is the **result criteria**, not a reading
recipe: the finished `.md` must demonstrably cover all six, in this order. The grill loop
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

## Trace
One-sentence trace (step 6), entry→exit: "<entry> <verb>s <data> through <key steps>, branching on <decision>, returning <result> / failing to <failure>." If you cannot write this in one sentence, the artifact is incomplete — go back.
```

**Rules.**
- Tables over prose. Prose only inside "Scope", the closing Trace, and per-row clarifiers.
- Every `path:line` must be verified — open the file before you cite it.
- Decision points and edge cases are numbered (`DP-1`, `EC-1`, …) so other docs and TODOs can reference them.
- If a section is genuinely empty (e.g. no decisions), write "None." rather than omitting the heading.
- All 6 chain steps must be covered. A thin step is a gap the grill loop will catch and re-spawn.
- **No `## Grill answers` section.** Grill findings are folded into the relevant body sections (a new EC-N, a corrected DP-N, an added data carrier) — not parked in a Q&A appendix.

## Procedure

1. **Resolve task slug.** User's task description, kebab-case, max 40 chars. Save as `TASK_SLUG`.
2. **Resolve `<notes-dir>` and `$RESEARCH_DIR`** (see router "Output location"). Create `$RESEARCH_DIR` if missing.
3. **Check for prior runs.** If `$RESEARCH_DIR/INDEX.md` exists, ask the user: *append*, *overwrite*, or *bail*. Never silently overwrite.
4. **Phase 1 — Find entry point** (below). Skip if the user already provided entry points.
5. **Phase 2 — Explore entry point** (below). Parallel Explore subagents, one `.md` per entry point.
6. **Phase 3 — Grill-me loop** (below). Run until research stops surfacing gaps.
7. **Write** `$RESEARCH_DIR/INDEX.md` (template below).
8. **Append worklog entry** to `<notes-dir>/worklog.md` if it exists.
9. **Print** the research dir path. Suggest `/explore workflow` to add the navigable TS pseudocode + bindings layer.

## Phase 1 — Find entry point (if not provided)

Skip entirely when the user passed explicit entry points (files, symbols, URLs).

When the input is a free-form description and no entry point is given:

1. Use `cocoindex` semantic search (and `mcp__fff__grep` / `find_files` for known identifiers) to locate candidate entry points for the task.
2. Pick the smallest set of entry points that covers the described surface — the public symbol/file each path *starts* at, not every file it touches.
3. **Move forward without confirmation.** Log the chosen set (one line each, with `path:line`) and proceed straight to Phase 2 — the grill loop (Phase 3) catches a wrong or incomplete set.

If discovery finds nothing, say so and ask the user to name an entry point — do not guess.

## Phase 2 — Explore entry point

For each entry point, **spawn an Explore subagent in parallel** — all `Agent` calls in a single assistant message so they actually run concurrently.

- Use `subagent_type: "Explore"` for read-only investigation. If an entry point needs deeper cross-file design reasoning, use `general-purpose`.
- Each subagent gets a self-contained prompt — it cannot see this conversation. Brief each with:
  - The specific entry point (verbatim, with any `path:line` the user gave).
  - The output directory (`$RESEARCH_DIR`, absolute path) and target filename `<ep-slug>.md`.
  - **The "MD artifact structure" section copied verbatim** so the explorer cannot fall back to prose.
  - The 6-step chain as the result criteria.
  - "Verify every `path:line` by reading the file — do not guess."
  - "The primary reader is someone planning a refactor. They want to scan steps, decision points, and edge cases in seconds. No paragraphs of prose."

Wait for all subagents to finish before Phase 3.

## Phase 3 — Grill-me loop (reveal uncovered research)

A single fan-out misses two things: a **wrong/incomplete entry-point set** (a path nobody explored)
and **uncovered edge cases** (the failure path left thin). The grill loop closes both. It runs
autonomously — no user in the loop — and is the explore analogue of `grill-me`'s relentless
questioning: keep probing until nothing new surfaces.

**No question files.** Grilling targets the artifact directly. Every gap the grill surfaces is fixed
by **editing the `.md` in place** — fold the answer into the right body section, rewrite and reshape
the artifact as needed. Findings live in the research result, never in a side Q&A file.

Maintain `seen` = set of explored entry-point slugs, and `dry` = count of consecutive rounds with no
new gap. Loop:

1. **Grill every artifact against the 6-step chain.** For each `<ep-slug>.md`, spawn one read-only critic subagent (`subagent_type: "Explore"`) that acts as a paranoid reviewer and returns a structured gap list. A step is a **gap** when:
   - **Tests (2):** marked UNTESTED but tests exist, or test rows cite paths that don't exercise this path.
   - **Follow data (3):** an identity/data carrier named in the path has no row.
   - **Failure path (5):** a branch/`throw`/early-return in the path has no matching DP-N/EC-N, or a partial-failure has no rollback note.
   - **One-sentence trace (6):** missing, or it references a step/branch absent from the body (= the body is incomplete, not the trace).
   - Adversarial blindspots: empty inputs, races, duplicate keys, stale caches, silent overwrites, asymmetric handlers — anything the artifact asserts but doesn't prove.
2. **Discover missed entry points.** The critic also reports **new entry points** referenced by the explored path but never explored — downstream calls, dispatched handlers, fan-out targets, error sinks. Filter against `seen` and task scope (drop out-of-scope ones; **log what was dropped** with a one-line reason).
3. **If no fresh gaps and no new entry points:** `dry++`. Else `dry = 0`.
4. **Stop when `dry >= 2`** (two consecutive clean rounds) or after **4 rounds total** — whichever first. Log the stop reason and any still-open gaps.
5. **Otherwise re-spawn** a parallel round (single message, multiple `Agent` calls):
   - For each gapped artifact: an explorer briefed with the specific gaps — it **edits the existing `.md` in place**, folding findings into the body and reshaping sections as needed, not appending a Q&A list and not doing a full rewrite from scratch.
   - For each new in-scope entry point: a fresh explorer with full artifact requirements (Phase 2 brief). Add it to `seen`.
   Then return to loop step 1.

Log each round: `round N — <k> gaps, <m> new entry points, dry=<d>`. Never silently cap — if you stop at the 4-round limit with open gaps, print them.

### Generating sharp grill questions (optional)

The critic subagent works better with a paranoid agenda. You may seed it (in-prompt, not as a file)
with the angles below — keep the questions in the prompt; the answers land in the `.md`, never in a
side file:

- **Intent / tests:** Which tests exercise this path and what intent does each pin? Any UNTESTED branch?
- **Workflow steps:** Ordered atomic steps entry→exit; exact `file:line` and state touched per step?
- **Decision points:** What every `if`/`switch`/dispatch branches on; what each branch does differently; where the path forks (prerun/main, sync/async) and what carries identity across the fork.
- **Edge cases (adversarial):** Empty/single/duplicate inputs, key collisions, races, iteration-order non-determinism, partial failure mid-loop (what's already mutated, is there rollback?), deleted resources, stale caches, encoder ambiguity, silent drops.
- **Identity & invariants:** What is "identity" at each layer and how is equality defined? Which fields are mutable vs locked-after-creation?
- **Refactor hotspots:** Which surfaces couple multiple files? Which contracts are implicit (cache key formula, iteration order, canonicalisation)? Where would a change most likely cause silent data loss?
- **Surprises:** What would a new contributor most likely get wrong?

Each question must be answerable by reading the code. The explorer answers by editing the `.md`, not by writing a Q&A appendix.

## INDEX.md

Write `$RESEARCH_DIR/INDEX.md` so the planner finds each artifact at a glance:

```markdown
# Research index — <task slug>

Generated: <ISO date>

| Entry point | Slug | Artifact | Summary |
|---|---|---|---|
| `src/server/index.ts` | server-index | [md](server-index.md) | HTTP request lifecycle from router to response |
| `HandleRequest` | handle-request | [md](handle-request.md) | Dispatch + middleware chain |

**Workflow layer:** run `/explore workflow` to add `<ep-slug>.workflow.ts` + `flows.json` (render with `/flow-map`).
```

If the `workflow` route already ran, add its `[workflow]` / `[flows.json]` links to the table.

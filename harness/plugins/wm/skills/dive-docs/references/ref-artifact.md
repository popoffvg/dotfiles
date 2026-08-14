# The artifact contract

The one home for what a `<ep-slug>.md` must contain. `explorer` writes against it; `explore-critic`
grades against it. Neither restates it — both read this file.

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

# The artifact contract

The one home for what a `<ep-slug>.md` must contain. `explorer` writes against it; `explore-critic`
grades against it. Neither restates it — both read this file.

**The shape is `examples/research-artifact.md`** — the artifact filled against one real entry point,
with the rules for each section written as the `>` block under it. Open it before writing or grading
one: no section rule is written twice, so this file holds none of them.

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

## Rules

- The section order of `examples/research-artifact.md` is the required order, and every heading it carries is required.
- Tables over prose. Prose only in "Scope", the closing Trace, and per-row clarifiers. The `.md` is read by humans planning a refactor, so each section is short, scannable, and citation-dense.
- **Cite code as `` `path:line` `` in backticks**, repo-relative, with no markdown link around it — that is the form an editor and Claude Code both make clickable, while a link to a `.rs:139` target resolves nowhere.
- Every `path:line` must be verified — open the file before you cite it.
- Decision points and edge cases are numbered (`DP-1`, `EC-1`, …) so other docs and TODOs can reference them, and a number is never reused for a different branch.
- If a section is genuinely empty (e.g. no decisions), write "None." rather than omitting the heading.
- All 6 chain steps must be covered. A thin step is a gap the convergence loop will catch and re-spawn.

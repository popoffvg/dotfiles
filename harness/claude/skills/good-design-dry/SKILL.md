---
name: good-design-dry
description: This skill should be used when writing or changing code, or a markdown spec, plan, README, or design doc that adds or changes code, and the change adds a function, helper, method, type, record, constant, string literal, config value, or a block that looks like code that exists. Also when the user says "DRY", "duplicate", "copy-paste", "copy this from", "reuse", "we already have this", "single source of truth", or "do it like X does".
user-invocable: false
---

# good-design-dry

DRY means one fact in one place, and one way to do one job. This skill owns "does this change do again what the repo already does". `good-design-kiss` owns "is a new shared abstraction worth its layer". `good-design-solid` owns how responsibilities split between types.

## Steps

1. **Search before you write.** For each new function, type, helper, or block, name its job in 2–4 words. Search the repo, its dependencies, and the standard library for that job (`rg -n -i '<verb>.*<noun>'`, the symbol search of the language server). A search that finds nothing counts only when the same search, with the job words changed to a job you know exists, finds that symbol. Done when the `second-way-for-a-job` check passes.
2. **Reuse what exists.** When a symbol does the job, call it. When the symbol is private or returns more than you need, make it public with its full result type, and do not write a second, narrower read. Done when the `narrow-copy-of-a-read` check passes.
3. **Put each fact in one place.** A literal, a limit, a name list, a schema, or an order lives in one constant or one table row. Every other place reads it. Done when the `literal-in-two-places` check passes.
4. **Keep one type per entity.** A copy of a record in a second store reads back as the full record type, not as a second, smaller type, and not as the same type with fields left zero. Compare two copies by the state fields only, in a method named for that (`SameInstanceState`), never `Equal`. Done when the `mirror-type` check passes.
5. **Extract new shared code at the third copy.** A new function with one call site is normal code, not shared code. Two copies of a new block with no existing symbol stay two copies. At the third copy, extract one function, named for the job. Done when the `early-extraction` and `pasted-block` checks pass.
6. **In a doc, point to the code.** A spec or a README that shows code names the existing symbol at its `file:line` and does not paste a second version of it. A code sketch of new code follows steps 1–5 like real code. Done when the `doc-restates-code` check passes.
7. **Verify blind.** After the last edit, follow `## For the caller` in `~/.claude/agents/good-design-verifier.md`, once per change for all three good-design skills. Done when the verifier returns PASS or each finding is fixed or answered.

## Checks

| Slug | Check | Evidence of a breach |
|---|---|---|
| `second-way-for-a-job` | Search the job words of each new symbol. | An existing symbol at `file:line` that does the same job. |
| `narrow-copy-of-a-read` | A new method calls an existing read and returns a part of its result. | The existing read at `file:line`. |
| `literal-in-two-places` | `rg -F` each new literal, number, and name list. | Two or more hits that must change together. |
| `mirror-type` | Compare the fields of each new type with the types of the same entity. | An existing type with the same fields or a superset. |
| `pasted-block` | `rg -F` the most distinctive line of each added block of 5+ lines. | The same block at a `file:line` that existed before this change, or a third copy of a new block. Two copies of a new block pass (step 5). |
| `early-extraction` | Count the call sites of each new helper that the diff makes shared (two or more call sites). | Two call sites, and no old code removed. |
| `doc-restates-code` | Compare each code block of a doc with the symbol it describes. | A doc block that differs from, or repeats, the code at `file:line`. |

A finding is not a breach when the two copies change for different reasons. State the two reasons in the reply.

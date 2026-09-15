# The mutation operators

What counts as one mutant, in what order to write them, and which survivors are equivalent rather
than a gap. Language-neutral — the edit is described by what it changes, not by syntax.

## The roster

Apply them top-down over the diff's changed lines. The order is by how often the surviving mutant
turns out to be a real missing assertion, highest first.

| # | Operator | The edit | The assertion a survivor is missing |
|---|---|---|---|
| 1 | **boundary** | `<` ↔ `<=`, `>` ↔ `>=`, `i < n` → `i <= n` | the value exactly on the edge |
| 2 | **condition flip** | `==` ↔ `!=`, negate a whole branch condition | the other side of the branch |
| 3 | **error path** | swallow a returned error, return success where the code returned a failure | that the failure reaches the caller |
| 4 | **return value** | return the zero value, the empty collection, or the other branch's value | what the function actually returns, not just that it did not throw |
| 5 | **constant** | swap a literal for a neighbour — `0`, `1`, `-1`, `""`, `null`/`nil`/`None`, the next enum member | the concrete value, not its type |
| 6 | **logical** | `&&` ↔ `\|\|`, drop one clause of a compound condition | the input that only the dropped clause rejects |
| 7 | **arithmetic** | `+` ↔ `-`, `*` ↔ `/`, off-by-one on an index or a slice bound | the computed number, not its shape |
| 8 | **guard removal** | delete an early return, a validation check, or a `break`/`continue` | the input the guard exists for |
| 9 | **call removal** | delete a statement whose only job is a side effect — a write, a publish, a cache set | that the side effect happened |
| 10 | **collection bound** | empty input where one element was assumed, one element where many were | the degenerate size |

**One edit per mutant.** Two edits at once produce a verdict that names neither.

**Stop at the budget.** The brief names a mutant count (12 by default). Spend it on the operators
highest in this table that the changed lines actually contain — a file with no arithmetic gets no
arithmetic mutant, and the slot goes to the next operator down.

## Equivalent mutants — reported, never a failure

A survivor is equivalent when no test **could** kill it. Name the row; do not ask for a test.

| Row | The edit changed |
|---|---|
| **observability only** | a log line, a metric label, a span name, a comment — nothing a caller can read |
| **unreachable** | a default branch, a case the type system already excludes, dead code the diff left in |
| **performance only** | a cache, a buffer size, a batch width — same output, different cost |
| **duplicate guard** | a check the caller already enforces, so the branch never sees the rejected input |
| **message text** | the wording of an error or a string the contract does not pin |
| **timing and order** | the order of two independent operations with no observable sequence |

**When unsure, call it a gap and say so.** An equivalent mutant wrongly reported costs one test
nobody needed; a real gap wrongly excused costs the bug the test would have caught.

## What never gets mutated

Test files, fixtures, golden files, generated code, vendored dependencies, and the build
configuration. Mutating any of them measures the mutation, not the test set.

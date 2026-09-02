# Constraints

> Copy to `<notes-dir>/CONSTRAINTS.md`. Created empty by `/code new` Step 0.7; rows are appended as
> decisions settle. Rules for the file: `arch:sub-todo.md` § Constraints.
> The prose follows `harness-dev:text-style`.

The settled decisions this corpus obeys. One row per decision **an increment can violate** — the
rule alone, and where it came from. Every TODO's agent half points here; no TODO copies a row.

| # | Constraint | Origin |
|---|------------|--------|
| R1 | A second refresh on the same token returns 409; never two valid pairs | [[003-decision-single-flight]] |
| R2 | Refresh tokens expire 15 minutes after issue | [[002-fact-token-ttl]] |
| R3 | A request body is a named struct, never a bare string | [API conventions](docs/api-conventions.md) § Request bodies — read 2026-08-24 |

- **`#`** — `R<n>`, 1-indexed, contiguous, unique in the file. **Append only.** Renumbering repoints
  every implementer and every review at a different rule.
- **`Constraint`** — one sentence, imperative or invariant: what the code must do. No trade-off
  prose, no rejected alternative, no origin link — the next column holds that.
- **`Origin`** — a **thought** (`[[NNN-type-slug]]`, live in `thoughts/`) or a **doc**
  (`[<title>](<url or path>) § <section> — read <YYYY-MM-DD>`). Cite a doc when the rule was taken
  from it as-is; when the doc forced a choice, write the decision note and cite the note.
- A rule the tests can check gets a matching case in the `## Autotest` of every TODO it binds.
- A superseded decision: repoint the row's `Origin` at the replacement note and rewrite the rule.
  Never leave a row citing a note that resolves only under `thoughts/archived/`.

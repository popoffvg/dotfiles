# CODE_STYLE

<when="naming anything — a type, a function, a field, a file, a test, a commit message">
## Align language

- One term per concept across code, tests, docs, commits. No synonyms (`user`/`account`/`member` → pick one) — a synonym splits every future search.
- Name types/methods after domain terms, not tech (`placeOrder`, not `insertOrderRow`).
- If domain and code disagree, rename code. Ubiquitous language wins.
- When behavior or audience changes, rename in the same commit. A stale name is misinformation. Audience counts: a private helper that other modules now need gets a public name, not a re-export shim.
</when>

<when="naming anything a reader will search for later — a public symbol, a file, a type, a metric, an event, an error message">
## Searchable names

Code is found by plain-text search — by agents that have no jump-to-definition, and by humans who grep one line out of a log. Every identifier is a search query, and every miss costs reads.

**Give a public name 2–4 words, and at least one of them a domain word.** Use the shortest name that greps uniquely, then stop, and put the rest in the doc line. Good: `DiffResourceFields`, `QueueEventForDispatch`, `FormatDurationMs`. Bad: `Diff`, `Queue`, `Format`.

**Give a generic verb its object.** `validateRunnerConfig`, not `validateConfig`. `sanitizeResourceName`, not `sanitize`.

**Do not lean on the module path to disambiguate.** `runner.Diff` reads well at the call site, but the definition — where a search for `Diff` lands — says only `Diff`. Put the context in the identifier, not only in the folder.

**Keep one definition site per symbol.** Never copy a function into a second file. Move it, and delete the original in the same change.

**Name a file after its concept, never after a role.** `types`, `utils`, `helpers`, `config` say nothing in a search result, and they collide with the same file in every other module. Good: `runner_quota_config`, `resource_state_types`. The base name is the component that declares the type, and each extra file adds a suffix to that base: `client` → `client_bucket`, `client_federated`, and the test beside it → `client_federated_test`.

**One searchable concept per file, and thin orchestrators.** The code that answers "where is X done?" lives in the file named after X, not inline in a coordinator. An orchestrator reads as a sequence of calls into well-named functions, each one hop from the real work. Split until each question-sized concept has one home, then stop — a helper with meaning inside one concept only stays inline.

**Put the domain concept in a type, not in a comment.** Declare a named type (`ResourceID`) and never pass a bare primitive for a domain id: `transfer(ownerID, orgID)` on two integers hides a transposed argument, and a named type turns it into a build error. For a privileged operation, take a capability type that already carries the access scope, not a raw handle — a comment is a request, a required type is physics. Model state as an explicit enum or a sealed set of variants, not a group of nullable fields with implicit rules about which combinations are legal. Names get quoted back to you in compiler errors: `OrgScopedTx` explains itself, `Ctx2` does not, and every untyped escape hatch (`any`) is a place the compiler goes silent.

**Write the constraint where the search lands.** Give every public symbol one doc line that states the sharpest fact the signature cannot show — the unit, the timezone, the owner, the order, the lifetime, who must release the resource. Add the plain-words phrase a person would search for, because `SessionExpiryChecker` does not match a grep for "session expired". Good: `SessionExpiryChecker reports whether the user session has expired.` Bad: `SessionExpiryChecker implements ExpiryCheck.`

**Keep strings whole.** Never assemble a metric name, a resource type, an event name, a feature flag, or an error code from parts: `"pl_" + kind + "_total"` makes `pl_upload_total` impossible to find. Write the full literal, even where a loop looks DRYer.

**Start each error message with a unique literal prefix**, so a line copied from a log greps back to its origin. Good: `"webhook signature mismatch for resource %d"`. Bad: `"%s: mismatch"`. The same holds for wrap messages and log messages.

**Mark a dead end with the language's deprecation marker and a pointer to the replacement.** It goes after the doc line, never in place of it.

Before you commit, answer six questions.

1. Does one search for each new public name find its implementation?
2. Does swapping two arguments of the new function break the build?
3. Is the thing a caller must know, and the signature cannot say, written at the definition?
4. Do all log and error strings exist word for word in the source?
5. Did anything change behavior without changing its name?
6. Where code moved, is it gone from the place it came from?
</when>

<when="the code holds a set of similar items plus a loop or switch that reads them — columns, fields, routes, menu entries, flags, steps">
## Declarative table vs imperative reader

Split the two, and keep every per-item fact on the declarative side.

- **Declarative** — the facts about each item: its name, its type, its order, its membership in a subset, its per-item exceptions. One table, one row per item, each row complete.
- **Imperative** — the reader that turns a row into output. One path, no per-item knowledge. It merges no defaults, injects no fields, and consults no second list.

Two tests decide where a fact belongs.

**The table-diff test.** Change what ships and count the files edited. If changing *what* ships means editing the reader too, the fact belongs in a row. A diff of the table must be a diff of the behavior.

**The identity-branch test.** A branch in the reader keyed on one item's identity (`if id == "status"`) is a field missing from that row. Add the field; delete the branch.

A second array of ids that fixes order or membership is the common breach: two lists can disagree, one cannot. Where list position genuinely cannot carry the meaning — a subset shipping in its own order — give the row an explicit field and assert on duplicates and gaps. The forms this takes, and what to do when the ask itself names the shape, are in the `deliver-the-named-shape` skill.

Imperative stays imperative: sequencing, error handling, retries, and I/O are code, not table rows.

**Order the fields of a row by what identifies it.** The identifying field — `name`, the key, the id — goes first, then its type, then its qualifiers and metadata. A reader scanning a long table reads the first field of each row and nothing else, so the field that says *which item this is* has to be the one in that position. Copy field order from the domain, never from a neighbouring file that happens to lead with a type.
</when>

<when="writing or keeping a comment or a doc tag">
# DO NOT DO

- **NEVER** add links to the task or docs in the code. Code comments should reveal the unclear invariants or assumptions about external systems that code itself doesn't contain.

## The comment deletion test

Before keeping any comment, delete it, read the code under it, and name the fact you lost.

- No fact lost — the comment paraphrased the code. Delete it.
- A fact lost — keep that fact alone: an invariant, an assumption about another system, a unit or scale, a nullability rule, or an alternative that was rejected and why. Never what the code shows.
- Half a fact lost — keep the reason clause, drop the clause that narrates the code.

A doc tag stating only a parameter's name and its type restates the signature. Write the constraint on the value, or no tag.
</when>

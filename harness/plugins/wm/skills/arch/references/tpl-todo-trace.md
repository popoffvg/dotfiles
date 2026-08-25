# TODO-1 — decision trace

> This file is a filled TODO **trace** — the pair's companion, not a third half of it. Copy it to
> `<notes-dir>/todos/TODO-N.trace.md`, replace the content, and delete every `>` line — each one
> states the rule for the block above it.
> The H1 is `# TODO-N — decision trace` and carries no title: the title lives in `TODO-N.md`.
> No frontmatter — `status` has one home, the human half.
> **No line budget, and no diff.** It is as long as the decisions behind this TODO need.
> One section, `## Trace`, and no other.

**Design:** [TODO-1.md](TODO-1.md) · **Increments:** [TODO-1.agent.md](TODO-1.agent.md)

> The two links back, and the first line in this file. This file cites the pair by anchor and never
> restates it: the pair says what the code becomes, this file says which decision put it there and
> where that decision is written down.

## Trace

| Anchor | Origin | Why here |
|--------|--------|----------|
| Outcome | [[001-decision-rotate-on-refresh]] | Rotation was chosen over shortening the refresh TTL, and this row is the slice of that choice a caller can observe. |
| Constraints: C1 | [[003-decision-single-flight]] | The exchange is the only place two refreshes can race, so the 409 rule binds this row and no other. |
| Constraints: C2 | [[002-fact-token-ttl]] | The TTL is read here on every exchange; a row that never reads it is not bound by it. |
| Surface: `RefreshRequest` | [API conventions](docs/api-conventions.md) § Request bodies — read 2026-08-24 | Every request body in this API is a named struct with one `json` tag per field, which is why the exchange takes a struct rather than the bare token string it replaced. |
| Autotest: E2E | [[005-fact-e2e-harness-boots-redis]] | The harness already boots Redis, so an end-to-end rotation assertion is affordable and `none` would have been a choice, not a limit. |
| Changes: 2 | [[006-impl-decision-widen-minter-first]] | Widening the minter before the handler is what keeps the repo building at every increment; the reverse order needs a shim nobody wants to delete later. |

> **One row per decision that had a live alternative and no longer shows one in the pair.** The pair
> states the *what*; this table states which decision produced that *what*, and where its *why* is
> written. It is the **trace** in the `wm:GLOSSARY.md` sense — the thought graph read backward from
> the artifact to its reason.
>
> **Anchor** — where the decision lands in the pair, from this closed set, so a reader can check the
> row against the thing it explains:
>
> | Anchor | Points at |
> |---|---|
> | `Outcome` | the human half's `## Outcome` — why this ledger row exists at all |
> | `Components: <package.Class>` | one `## Components` row |
> | `Surface: <symbol>` | one type, field, signature, or setting in `## Surface` |
> | `Constraints: C<n>` | one `## Constraints` row in the agent half, by its id |
> | `Autotest: Unit` / `Autotest: E2E` | one Autotest level — including a level set to `none` |
> | `Changes: <n>` | one increment, by its number |
> | `Commit` | the commit message's decision paragraph |
>
> **Origin** — where the decision is written down, in one of exactly two forms:
> - **thought** — `[[NNN-type-slug]]`, a note **live in `thoughts/`**. A link that resolves only
>   under `thoughts/archived/` means the decision was superseded and this TODO still obeys it:
>   repoint the row at the replacement, and re-check what the pair says (`code:sub-revise.md`).
> - **doc** — `[<title>](<url or repo-relative path>) § <section> — read <YYYY-MM-DD>`. The section
>   locates the claim inside the document; the date says which version of it the pair was written
>   against, because an external document changes without telling you.
>
> Cite a doc directly when the pair **took a shape or a value from it as-is** — a signature, a field
> name, a wire format, a limit. When the doc **forced a choice between alternatives**, the choice is
> the thought: write the note, let the note cite the doc, and put the note here.
>
> **Why here** — one sentence on why *this* TODO is bound by that origin. Not the rule, which the
> anchor already states; not the trade-off, which the origin already holds. This is the only column
> whose content exists nowhere else, and it is what makes the row worth reading.
>
> **What earns a row**, and the floor every trace file meets:
> - **`Outcome`, always** — the decision that made this a ledger row rather than part of another one.
> - **every `## Constraints` row**, by id. The agent half carries the rule; this file carries where
>   it came from.
> - **every impl-decision note this TODO's author wrote** (`arch:sub-todo.md` § Implementation
>   decisions). Those notes are written during `todo` and nothing else in the pair links to them.
> - **every external document** a `## Surface` shape, a setting's value, or an Autotest case was
>   taken from.
>
> **What earns no row:** a name with no alternative, the order of two increments that could have run
> either way, and anything the pair already states in full. A row per choice makes this a diary, and
> a diary is not read.
>
> **A row you cannot give an origin is a decision nobody recorded.** Write the note first
> (`arch:tpl-note-impl-decision.md`), then cite it — an unsourced row is the gap this file exists to
> make visible.

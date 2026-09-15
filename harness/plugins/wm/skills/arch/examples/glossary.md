> A filled `<notes-dir>/GLOSSARY.md` — the ubiquitous-language dictionary for one spec, kept current
> every phase (new, todo, impl, revise, fix). Copy the file, replace the entries, delete the `>`
> lines — each one states the rules for the entry above it.
> **One entry per term, and the term is the heading.** Not a table: a term carries forbidden aliases,
> and a list of banned words does not fit a cell without being cut short. `/code new` Step 0 creates
> the file with the heading below and no entries.
> Purpose: let a human reading the spec check that the architector's domain model matches their own.
> Keep it short — only terms that appear in the spec's Description or Goal.
> The prose follows `harness-dev:text-style`.

# RefreshToken

Opaque token held in Redis, TTL-bound, exchanged for a new pair on every refresh.

- **Status:** existing
- **Kind:** entity
- **Forbidden:** refresh key, rtok, `refresh_tok`

> The heading is the term, spelled exactly as the code and the spec spell it — one `#` per entry, so
> a term is a section a reader can link to and a grep lands on the definition rather than a row.
> The line under it is the definition: one sentence, the visible contract (TTL, bounds, error
> semantics), no implementation detail a reader cannot observe.
>
> **Forbidden** is the list every entry carries and the reason this file is not a table: the other
> names in use for the same concept, which the spec and the code stop using from here on. Write
> every one of them, including the spelling variants a grep would miss — a name left off the list is
> a name that survives in the codebase. `none` when the concept has only ever had one name.
>
> **Status** is `existing` when the term already names something in the code, `new` when this spec
> coins it. It is what the naming gate reads: `code:sub-verify.md` § Phase 2 judges the `new` entries
> and leaves the `existing` ones alone, because renaming what the code already calls something is a
> refactor with its own TODO, not a spec finding.
>
> **Source** is the `path:line` the term comes from, or the spec section that coins it when no code
> exists yet — an `existing` entry carries a `path:line`, a `new` entry carries the section.

# AuthHandler

Serves every `/auth/*` route and owns the request-to-domain translation for them.

- **Status:** existing
- **Kind:** server
- **Forbidden:** auth router, AuthController

> **Kind** is one word from one of two sets — data, or a **brick** (a running responsibility):
> data ∈ `aggregate | entity | value-object | event | state`;
> brick ∈ `command | service | flow | gateway | server | consumer | policy | scheduler | wiring`
> (roster, metric, and structure of each: `arch:ref-bricks.md`).
> `/dive docs` fills this file first, from the research artifacts' `## Terms` (`dive-docs:SKILL.md`
> § Glossary). An entry it writes leaves **Kind** out until the spec types the term.

# RotateToken

Exchanges a valid refresh token for a new pair; issued by the SDK against a `Session`, and emits
`TokenRotated` on success or `AuthRefreshFailed` on a replay.

- **Status:** new
- **Kind:** command
- **Forbidden:** refresh, renew, reissue

> A command's name is imperative, and its definition says who issues it and which events it emits.
> Every new or renamed entry is approved by the user before it lands —
> `code:ref-subcommand-rules.md` § Glossary.

# TokenRotated

The previous refresh token is invalidated and the new pair is persisted.

- **Status:** new
- **Kind:** event
- **Forbidden:** none

> An event's name is past tense and its definition is the state that now holds, not the call that
> produced it. `Forbidden: none` is written out rather than left off, so a reader can tell a concept
> with one name from an entry someone forgot to finish.

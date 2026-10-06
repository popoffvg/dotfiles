> A filled `<notes-dir>/GLOSSARY.md` — the ubiquitous-language dictionary for one spec, kept current
> every phase. Copy the file, replace the entries, delete the `>` lines — each one states the rules
> for the entry above it. `/code new` Step 0 creates the file with one context heading and no entries.
>
> **Scope:** every domain term that `spec.md`, a TODO pair, or a live thought uses. A term enters the
> file before the first artifact uses it, and leaves only as `retired`.
>
> **Shape:** one `#` heading per bounded context, one `##` entry per term under it, contexts in the
> order the main user flow meets them. An entry is a definition, never a decision: the reason a term
> exists lives in its `thoughts/` note, and the identifiers live in **Code**.
>
> Check: `${CLAUDE_PLUGIN_ROOT}/bin/glossary-lint.py <notes-dir> [--code <repo>]` — the rules below
> are what it parses. The prose follows `harness-dev:text-style`.

# Session

## RefreshToken

Opaque token, TTL-bound, exchanged for a new pair on every refresh.

- **Status:** existing
- **Kind:** entity
- **Code:** `RefreshToken`, `refresh_token`
- **Forbidden:** refresh key, `rtok`
- **Source:** `auth/token.go:14`

> The `##` heading is the term as the spec writes it. The line under it is the definition: one
> sentence, the visible contract (TTL, bounds, error semantics), no implementation detail a reader
> cannot observe.
>
> **Status** has three values. `new` — this spec coins the term and no code declares it yet.
> `existing` — the code declares a **Code** identifier; the `impl` commit that lands the identifier
> sets it. `retired` — the design dropped or replaced the concept. The naming gate judges the `new`
> entries alone (`code:sub-verify.md` § Phase 2).
>
> **Code** lists the identifiers the code spells the term with, so a reader who talks in code names
> lands on the entry. `none` before the code exists.
>
> **Forbidden** lists the other names in use for the concept, which the spec and the code stop
> using. Each one is a whole alias — a phrase or an identifier — that one entry owns, that is not a
> word of another entry's name, and that no definition in this file needs. A banned common word
> (`run`, `cloud`) is a ban nobody can obey. `none` when the concept has one name.
>
> **Source** is the `path:line` the term comes from, or the spec section that coins it.

## AuthHandler

Serves every `/auth/*` route and owns the request-to-domain translation for them.

- **Status:** existing
- **Kind:** server
- **Code:** `AuthHandler`
- **Forbidden:** auth router, `AuthController`
- **Source:** `auth/handler.go:9`

> **Kind** is one word from one of two sets — data, or a **brick** (a running responsibility):
> data ∈ `aggregate | entity | value-object | event | state`;
> brick ∈ `command | service | flow | gateway | server | consumer | policy | scheduler | wiring`
> (roster, metric, and structure of each: `arch:ref-bricks.md`).
> `/dive docs` fills this file first, from the research artifacts' `## Terms`
> (`dive-docs:SKILL.md` § Glossary).

## RotateToken

Exchanges a valid refresh token for a new pair; issued by the SDK against a `Session`, and emits
`TokenRotated` on success or `AuthRefreshFailed` on a replay.

- **Status:** new
- **Kind:** command
- **Code:** none
- **Forbidden:** renew token, reissue token
- **Source:** spec § Goal

> A command's name is imperative, and its definition says who issues it and which events it emits.
> Every new, renamed, or retired entry is approved by the user before it lands —
> `code:ref-subcommand-rules.md` § Glossary.

## TokenRotated

The previous refresh token is invalidated and the new pair is persisted.

- **Status:** new
- **Kind:** event
- **Code:** none
- **Forbidden:** none
- **Source:** spec § Goal

> An event's name is past tense and its definition is the state that now holds, not the call that
> produced it. `none` is written out, so a reader can tell a concept with one name from an entry
> someone forgot to finish.

## TokenJar

Per-user container of refresh tokens, replaced by keeping each token on its `Session`.

- **Status:** retired
- **Replaced by:** RefreshToken
- **Code:** `TokenJar`
- **Source:** `thoughts/012-decision-tokens-live-on-the-session.md`

> A retired entry stays in the file: its heading and its **Code** become banned names, and the lint
> reports every use left in the corpus. **Replaced by** names the live entry that took the meaning,
> or `none`. Never delete an entry — a deleted name comes back.

> A filled `<notes-dir>/GLOSSARY.md` — the ubiquitous-language dictionary for one spec, kept current
> every phase. Copy the file, replace the entries, delete the `>` lines — each one states the rules
> for the entry above it. `/code new` Step 0 creates the file with one context heading and no entries.
>
> **Scope:** every domain term that `spec.md`, a TODO pair, or a live ADR uses. A term enters the
> file before the first artifact uses it, and leaves only as `retired`.
>
> **Shape:** three heading levels. `#` is a bounded context, in the order the main user flow meets
> them. `##` is a **cluster**: the terms that one aggregate, one flow, or one lifecycle joins. `###`
> is one entry per term — a Zettelkasten note: one concept, its definition, and typed **Links** to
> the entries it depends on. An entry is a definition, never a decision: the reason a term exists
> lives in its ADR, and the identifiers live in **Code**.
>
> Check: `${CLAUDE_PLUGIN_ROOT}/bin/glossary-lint.py <notes-dir> [--code <repo>]` — the rules below
> are what it parses. The prose follows `harness-dev:text-style`.

# Auth

## Token rotation

A client keeps a session alive by trading its refresh token for a new pair.

> The line under a cluster heading says what joins its terms, in one sentence. A term belongs to
> the cluster whose other terms it links most. A cluster with one entry is a sign the term belongs
> in a neighbour cluster.

### RefreshToken

Opaque token, TTL-bound, exchanged for a new pair on every refresh.

- **Status:** existing
- **Kind:** entity
- **Code:** `RefreshToken`, `refresh_token`
- **Forbidden:** refresh key, `rtok`
- **Links:** part of [Session](#session); consumed by [RotateToken](#rotatetoken)
- **Source:** `pkg/auth/token.go:24`

> The `###` heading is the term as the spec writes it. The line under it is the definition: one
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
> **Links** are `;`-separated, each `<relation> [Term](#slug)`: the text is another entry's heading
> verbatim, the anchor is that heading's GitHub slug — lowercase, punctuation dropped, spaces to
> `-`. Every heading in the file needs its own slug, so a context or a cluster never shares a name
> with an entry.
> The relation is a short verb phrase read from this entry: `part of`, `holds`, `issued by`,
> `consumes`, `emits`, `produces`, `kind of`, `opposite of`. Link across clusters and contexts
> freely: a link across clusters shows a dependency the grouping hides. Every live entry links at least one other entry;
> the reverse link is optional.

### RotateToken

Exchanges a valid refresh token for a new pair; issued by the SDK against a `Session`, and emits
`TokenRotated` on success or `AuthRefreshFailed` on a replay.

- **Status:** new
- **Kind:** command
- **Code:** none
- **Forbidden:** renew token, reissue token
- **Links:** consumes [RefreshToken](#refreshtoken); emits [TokenRotated](#tokenrotated)

> A command's name is imperative, and its definition says who issues it and which events it emits.
> Every new, renamed, or retired entry is approved by the user before it lands —
> `code:ref-subcommand-rules.md` § Glossary.

### TokenRotated

The previous refresh token is invalidated and the new pair is persisted.

- **Status:** new
- **Kind:** event
- **Code:** none
- **Forbidden:** none
- **Links:** emitted by [RotateToken](#rotatetoken); changes [Session](#session)
- **Source:** `spec.md` § Goal

> An event's name is past tense and its definition is the state that now holds, not the call that
> produced it. `none` is written out, so a reader can tell a concept with one name from an entry
> someone forgot to finish.

## Session lifecycle

A session is opened at login and ends at logout or when its TTL runs out.

### Session

One signed-in client on one device; its TTL is 15 minutes from the last refresh.

- **Status:** existing
- **Kind:** aggregate
- **Code:** `Session`
- **Forbidden:** login state
- **Links:** holds [RefreshToken](#refreshtoken)

### TokenJar

Per-user container of refresh tokens, replaced by keeping each token on its `Session`.

- **Status:** retired
- **Replaced by:** RefreshToken
- **Code:** `TokenJar`

> A retired entry stays in the file: its heading and its **Code** become banned names, and the lint
> reports every use left in the corpus. **Replaced by** names the live entry that took the meaning,
> or `none`. A retired entry has no **Links**, and no live entry links to it. Never delete an
> entry — a deleted name comes back.

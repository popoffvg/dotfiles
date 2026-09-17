---
type: impl-decision
id: "005"
status: approved            # proposed | approved | declined — proposed while the choice is still argued, and it binds nothing until approved
description: >              # 1–3 sentences — the text the index shows, and the rule wm-constraints.py prints verbatim — ref-note-format.md § Frontmatter
  SessionStore wraps every Redis error in ErrStoreUnavailable, so the auth handler branches on
  one error type instead of importing the driver. Every later TODO touching SessionStore returns
  that type.
date: 2026-06-19T09:12:40
source: human               # human | auto — auto = nobody was asked, nobody chose it
todo: TODO-3                # required here — the ledger row this rule is scoped to
tags: [auth, errors]
links:
  - "[[002-fact-token-ttl]]"
---

# Details

> Copy to `<notes-dir>/thoughts/NNN-impl-decision-<slug>.md` — e.g.
> `005-impl-decision-error-wrapping.md` — and delete the `>` lines.
> Write one while authoring a TODO body, the moment you chose between two valid approaches, picked a
> pattern the spec did not mandate, named a symbol absent from `GLOSSARY.md`, or made a choice that
> shapes how later TODOs are written — fresh reasoning beats reconstructed reasoning. Do not write
> one when a settled decision already covers it; link that note instead.
> One note per decision, never a bundle.
> **Sharpen by editing, reverse by superseding.** While later TODOs are written, adding a case the
> wording missed or tightening the rule text is an edit to this note — same `NNN`, no second note.
> Choosing differently is not: a reversal leaves the old rule live and generating a constraint
> nobody obeys, so it goes through `arch:ref-note-format.md` § Superseding — new note, `status:
> declined` plus `superseded_by:` here. The test is the `description`: if the implementer would now
> write different code, it is a reversal.
> The prose follows `i-have-adhd skill`.

> The title names the thought as a statement — imperative or declarative — in at most 60
> characters. The frontmatter `description` never paraphrases it: the title names the thought, the
> description says what it settled (`arch:ref-note-format.md` § Frontmatter).

## Context

The spec says the rotation handler returns 500 on a store failure, but not what the store layer itself returns.

> What the spec left unspecified. One sentence.

## Decision

`SessionStore` wraps every Redis error in `ErrStoreUnavailable`, so the handler maps one error type, not a driver's.

> What was chosen and why, one sentence.

<when="a second approach was viable — whoever ruled it out">
## Alternatives

| Option | Verdict |
|--------|---------|
| Return the raw `redis.Error` | Rejected: the handler would import the driver, and swapping the store would change the handler |
| Return a bare `error` with a message | Rejected: the handler cannot branch on a string without matching text |

> What else was considered and why each lost. Table or bullets.
> The gate is whether a second approach was genuinely viable — not whether the operator was in the
> room. An approach you ruled out alone is the one a reviewer most needs to see ruled out.
</when>

<when="the choice costs something a reader would not predict">
## Consequences

- Every store method now returns `ErrStoreUnavailable`, so a caller that needs to tell a timeout from a dropped connection has to be given a second error type first.

> What this choice makes harder downstream, one bullet each — only the effects a reader could not
> predict from the Decision. Skip the section when there are none; a list of the obvious buries the
> one that matters.</when>

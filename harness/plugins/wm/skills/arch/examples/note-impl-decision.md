---
type: impl-decision
id: "005"
status: approved            # approved | declined
description: >              # 1–3 sentences, the only text the thought index shows — ref-note-format.md § Frontmatter
  SessionStore wraps every Redis error in ErrStoreUnavailable, so the auth handler branches on
  one error type instead of importing the driver. Every later TODO touching SessionStore returns
  that type.
date: 2026-06-19T09:12:40
tags: [auth, errors]
todo: TODO-2
---

# Wrap store errors at the auth boundary

> Copy to `<notes-dir>/thoughts/NNN-impl-decision-<slug>.md` — e.g. `005-impl-decision-error-wrapping.md`.
> Write one while authoring a TODO body, the moment you chose between two valid approaches, picked a
> pattern the spec did not mandate, named a symbol absent from `GLOSSARY.md`, or made a choice that
> shapes how later TODOs are written — fresh reasoning beats reconstructed reasoning. Do not write
> one when a settled decision already covers it; link that note instead.
> One note per decision, never a bundle. A choice that changes while later TODOs are written is an
> edit to this note, never a second note.

## Context

The spec says the rotation handler returns 500 on a store failure, but not what the store layer itself returns.

> What the spec left unspecified. One sentence.

## Decision

`SessionStore` wraps every Redis error in `ErrStoreUnavailable`, so the handler maps one error type, not a driver's.

> What was chosen and why, one sentence.

## Alternatives

| Option | Verdict |
|--------|---------|
| Return the raw `redis.Error` | Rejected: the handler would import the driver, and swapping the store would change the handler |
| Return a bare `error` with a message | Rejected: the handler cannot branch on a string without matching text |

> What else was considered and why each lost. Table or bullets.

## Affects

- Every later TODO touching `SessionStore` returns `ErrStoreUnavailable`, never a driver error.
- The handler's error test asserts on the wrapped type.

> How this shapes other TODOs or the codebase.

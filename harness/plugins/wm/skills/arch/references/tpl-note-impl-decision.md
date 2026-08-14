---
type: impl-decision
id: "005"
status: approved            # approved | declined
date: 2026-06-19T09:12:40
tags: [auth, errors]
todo: TODO-2
---

# Wrap store errors at the auth boundary

> This file is a filled implementation-decision note. Copy it, replace the content, and delete every
> `>` line — each one describes the block above it.
> Path: `<notes-dir>/thoughts/NNN-impl-decision-<slug>.md`, sharing the 3-digit counter with the
> other notes. Example: `005-impl-decision-error-wrapping.md`.
> Write one while authoring a TODO body, for a choice the spec did not make: file naming, package
> structure, error handling, library use, data shape. Write it the moment the choice is made — fresh
> reasoning beats reconstructed reasoning.
> Write a note when you chose between two valid approaches, picked a pattern the spec did not
> mandate, named a symbol absent from `GLOSSARY.md`, or made a choice that shapes how later TODOs
> are written. Do not write one when a settled decision already covers it — link that note instead.
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

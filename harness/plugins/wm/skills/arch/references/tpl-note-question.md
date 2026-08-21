---
type: question
id: "004"
status: open                # open | declined
date: 2026-06-18T14:52:04
source: explore
tags: [auth, scope]
---

# Scope of a rotated refresh token

> This file is a filled question note. Copy it, replace the content, and delete every `>` line —
> each one describes the block above it.
> Path: `<notes-dir>/thoughts/NNN-question-<slug>.md`, sharing the 3-digit counter with the other notes.
> Write one the moment an unresolved question surfaces — seeded from the request, raised by a
> research gap, or opened mid-grill. A `status: open` note here blocks spec readiness.
> One question per note. A note asking two things is two notes; a question hiding an "and" is two
> questions.

## Question

Does a rotated refresh token keep the scope of the token it replaced, or re-read scope from the user record?

> A real question, one sentence, ending in `?`. "Token scope" is a topic, not a question.

## Blocks

The `TokenRotation` decision and the ledger row for the rotation handler — the handler either copies the scope or loads the user.

> What cannot be decided or written until this is answered: name the spec section, the ledger row,
> or the downstream decision that waits. A question that blocks nothing is not an open question —
> drop it, or make it a `## What we're NOT doing` line in `spec.md`.

## Resolved by

codebase: `pkg/auth/rotate.go` — read what the current handler puts in the new token; if it is not implemented yet, ask the user.

> The cheapest resolver, one of `user | codebase: <path> | research | prototype`, plus what to read,
> run, or ask. Prefer `codebase` with a concrete path over `user` — a question the code answers is
> read, never asked.

## Depends on

- [[002-fact-token-ttl]] — a 15-minute TTL means a stale copied scope survives at most 15 minutes

> One line per note that narrows the answer space. Omit the section when nothing narrows it.

> **No answer text ever appears here.** The moment the answer exists the note stops being live:
> the answer is a *new* decision or fact note at the next `NNN`, and this note is marked
> `status: approved` + `superseded_by:` with an `Answered by [[…]]` first body line. A hook then
> moves it to `thoughts/archived/` (`ref-note-format.md` § Resolution).
> **Never delete a question.** Moot → keep the note, set `status: declined`, and add one line saying why;
> it archives the same way.

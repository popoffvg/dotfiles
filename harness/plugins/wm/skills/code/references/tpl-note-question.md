---
description: >
  Question note template. Use the moment an unresolved question surfaces — seeded from
  the request, raised by a research gap, or opened mid-grill. Records what is asked, why
  it blocks, and who or what resolves it. Flipped in place to a decision/fact note when
  answered (ref-note-format.md § Resolution — flip in place).
---

# spec — question note template

## Sections

```
# <Question title — oneliner, the question as a noun-phrase>

## Question
<What is asked, one sentence, ending in "?". The exact question, not a topic.>

## Blocks
<What cannot be decided or written until this is answered. Name the spec section,
 the ledger row, or the downstream decision that waits on it.>

## Resolved by
<user | codebase: `<path>` | research | prototype> — <what to read, run, or ask>

## Depends on *(omit if none)*
- [[NNN-fact-xxx]] — <how this fact narrows the answer space>
```

## Rules

- **One question per note.** A note asking two things splits into two notes. A question hiding an "and" is two questions.
- **Question** is a real question, ending in `?`. "Token scope" is a topic; "Does the refresh token keep the original scope?" is a question.
- **Blocks** is what makes it worth asking now. A question that blocks nothing is not an open question — drop it or make it a `## What we're NOT doing` line in `spec.md`.
- **Resolved by** names the cheapest resolver. Prefer `codebase` with a concrete path over `user` — a question the code can answer is read, never asked.
- **No answer text.** The moment the answer exists, the note stops being a question: flip it in place per `ref-note-format.md` § Resolution — flip in place.
- **Never delete.** Moot question → keep the note, set `status: declined`, one line why.

## Example

```markdown
---
type: question
id: "004"
status: open
date: 2026-06-18T14:52:04
source: explore
tags: [auth, scope]
---

# Scope of a rotated refresh token

## Question
Does a rotated refresh token keep the scope of the token it replaced, or re-read scope from the user record?

## Blocks
The `TokenRotation` decision and the ledger row for the rotation handler — the handler either copies scope or loads the user.

## Resolved by
codebase: `pkg/auth/rotate.go` — read what the current handler puts in the new token; if it is not implemented yet, ask the user.

## Depends on
- [[002-fact-token-ttl]] — a 15-minute TTL means a stale copied scope survives at most 15 minutes
```

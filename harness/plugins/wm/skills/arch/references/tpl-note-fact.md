---
type: fact
id: "002"
status: approved
date: 2026-06-18T14:30:22
source: codebase            # codebase | explore | grill
tags: [auth, config]
---

# Refresh token TTL is 15 minutes in production

> This file is a filled fact note. Copy it, replace the content, and delete every `>` line —
> each one describes the block above it.
> Path: `<notes-dir>/thoughts/NNN-fact-<slug>.md`, sharing the 3-digit counter with the other notes.
> Write a fact note when the answer establishes a truth — a code observation, a user assertion, or
> a research finding. A fact is evidence; it makes no choice. When the answer IS a choice, write a
> decision note instead.

## What

Refresh tokens expire 15 minutes after issue in production, and 1 hour in development.

> One sentence, no hedging. Name the value, the file, or the constraint.
> "Token TTL is 15 minutes", never "Token TTL seems to be around 15 minutes".

## Where

- `pkg/auth/config.go:42` — the `DefaultTokenTTL` constant
- `pkg/auth/config.go:43` — the `DevTokenTTL` constant

> One bullet per source: `path:line` for code, `user stated` for an assertion, `research` for an
> external finding. Several sources → several bullets.

## Evidence

```go
const (
    DefaultTokenTTL = 15 * time.Minute
    DevTokenTTL     = 1 * time.Hour
)
```

> Verbatim only — the lines as they are in the file, the exact command output, the exact quote.
> Never a paraphrase. Omit the section when Where says `user stated`; the assertion is the evidence.

## Constrains

- The 15-minute window makes concurrent refresh races unlikely, so complex locking is unjustified.
- The 15-minute bound belongs in `GLOSSARY.md` as the TTL of `Session`.

> How the fact bounds the decisions that come after it. A TTL constrains race handling; a protocol
> constrains message format; a user requirement constrains scope. Omit when it constrains nothing.

---
description: >
  Fact note template. Use when the answer establishes a truth — code observation,
  user assertion, or research finding. Facts are evidence; they don't make choices.
  Record what, where, verbatim evidence, and what decisions the fact constrains.
---

# spec — fact note template

## Sections

```
# <Fact title — oneliner, noun-phrase>

## What
<The fact, one sentence. Concrete: name the value, the file, the constraint.>

## Where
- `<path>:<line>` — <what was observed>
- user stated — <what the user asserted>
- research — <what external source confirmed>

## Evidence *(omit if "user stated")*
<Code snippet, output, quote, or observation that proves the fact.>
<For codebase facts: the actual lines read, verbatim.>
<For user facts: no Evidence section needed — "user stated" in Where is enough.>

## Constrains *(omit if none)*
- <how this fact limits or bounds downstream decisions>
```

## Rules

- **What** is one sentence, no hedging. "Token TTL is 15 minutes" not "Token TTL seems to be around 15 minutes."
- **Where** names the source — file:line for code, "user stated" for assertions, "research" for external findings. Multiple sources = multiple bullet points.
- **Evidence** is verbatim. The actual lines read from the file, the exact output of the command, the exact quote from docs. No paraphrasing.
- **Constrains** explains how this fact shapes the decision space. A TTL of 15 minutes constrains race-handling strategy; a protocol constraint constrains message format; a user requirement constrains scope.

## Example

```markdown
---
type: fact
id: "002"
date: 2026-06-18T14:30:22
source: codebase   # codebase | explore | grill
tags: [auth, config]
---

# Refresh token TTL is 15 minutes in production

## What
Refresh tokens expire 15 minutes after issue in production, 1 hour in development.

## Where
- `pkg/auth/config.go:42` — `DefaultTokenTTL` constant
- `pkg/auth/config.go:43` — `DevTokenTTL` constant

## Evidence
```go
const (
    DefaultTokenTTL = 15 * time.Minute
    DevTokenTTL     = 1 * time.Hour
)
```

## Constrains
- The 15-minute window makes concurrent refresh races unlikely — complex locking is unjustified.
- The 15-minute bound should be mentioned in the Terms table as the TTL for `Session`.
```

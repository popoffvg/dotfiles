---
description: >
  Decision note template. Use when the answer IS a choice — the user decided,
  recommended, or chose between alternatives. Records question, recommendation,
  resolution, and the trade-off reasoning (Why). Core artifact of the grill loop.
---

# spec — decision note template

## Sections

```
# <Decision title — oneliner, verb-led>

## Question
<What was asked — the exact grilling question, one sentence>

## Resolution
<What was decided — one sentence. If user chose differently: "User chose X because Y">

## Why
<The trade-off table or reasoning that led to the decision.
 Form: if the answer is chosen from alternatives, list each alternative + why rejected.
 If the answer follows from constraints, list the constraints and how they force the choice.>

## Depends on *(omit if none)*
- [[NNN-fact-xxx]] — <how this fact constrains or enables the decision>
- [[NNN-decision-xxx]] — <how this prior decision bounds the options>

```

## Rules

- **Why** is the core of the note. It captures the alternatives considered and why each was rejected, or the constraints that forced the choice. A decision without a **Why** section is unresolved.
- **Depends on** lists prerequisite notes. Every linked note should have a one-line annotation saying HOW it constrains this decision — not just "see also".

## Example

```markdown
---
type: decision
id: "003"
date: 2026-06-18T14:45:10
tags: [auth, concurrency]
links:
  - "[[002-fact-token-ttl]]"
---

# Reject concurrent refreshes (single-flight)

## Question
What happens when two refreshes race on the same expired token?

## Resolution
Accepted recommendation.

## Why
Three options evaluated:

| Option | Description | Verdict |
|--------|-------------|---------|
| A — allow both | Both produce valid token pairs from one old token | Rejected: leaks access, violates rotation invariant |
| B — reject second | Return 409, caller retries with new token | Chosen: safe, simple, rare in practice |
| C — idempotent queue | Deduplicate via Redis locking, return same pair | Rejected: ~40 lines of locking code for a scenario that happens <0.01% of the time |

The constraint from [[002-fact-token-ttl]] (15-minute TTL) makes races rare — the extra complexity of option C is not justified.

## Depends on
- [[002-fact-token-ttl]] — 15-minute TTL makes the race window small; locking overkill
```

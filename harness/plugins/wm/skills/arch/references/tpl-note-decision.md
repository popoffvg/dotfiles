---
type: decision
id: "003"
status: approved            # approved | declined
date: 2026-06-18T14:45:10
source: grill               # grill | explore | codebase — codebase = auto-discovered, nobody chose it
tags: [auth, concurrency]
links:
  - "[[002-fact-token-ttl]]"
---

# Reject concurrent refreshes (single-flight)

> This file is a filled decision note. Copy it, replace the content, and delete every `>` line —
> each one describes the block above it.
> Path: `<notes-dir>/thoughts/NNN-decision-<slug>.md`. `NNN` is the shared 3-digit counter across
> question, decision, fact, and impl-decision notes; `<slug>` is kebab-case, ≤ 5 words.
> Write a decision note when the answer IS a choice — the user decided, recommended, or picked
> between alternatives. When the answer is an observed truth, write a fact note instead.

## Question

What happens when two refreshes race on the same expired token?

> The exact grilling question, one sentence, ending in `?`. A topic is not a question.

## Resolution

Accepted the recommendation: the second refresh returns 409.

> One sentence. When the user chose against the recommendation, say so: "User chose X because Y".

## Why

| Option | Description | Verdict |
|--------|-------------|---------|
| A — allow both | Both produce valid token pairs from one old token | Rejected: leaks access, breaks the rotation invariant |
| B — reject second | Return 409, caller retries with the new token | Chosen: safe, simple, rare in practice |
| C — idempotent queue | Deduplicate via Redis locking, return the same pair | Rejected: ~40 lines of locking for a case under 0.01% of traffic |

The 15-minute TTL in [[002-fact-token-ttl]] makes the race rare, so option C's complexity is not paid for.

> **Why** is the core of the note — a decision without it is unresolved, not recorded.
> Chosen from alternatives → one row per alternative with the reason it lost.
> Forced by constraints → list the constraints and show how they leave one option.
> Auto-discovered (`source: codebase`) → name the `path:line` that forced the choice and say what
> the code does there. Nobody was asked, so the code IS the reason; the reviewer reads these first.

## Depends on

- [[002-fact-token-ttl]] — the 15-minute TTL makes the race window small, so locking is overkill

> One line per prerequisite note, each saying HOW it constrains this decision. A bare "see also"
> link is not a dependency. Omit the whole section when nothing constrains the choice.

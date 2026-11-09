---
status: proposed
kind: architecture
created: 2026-06-18
updated: 2026-07-02
source: human
---

> Copy to `<notes-dir>/adr/NNNN-<slug>.md` and delete every `>` block. The `adr` skill owns the procedure and the title rules.
> The wm key `source` is in `arch:ref-adr-format.md` § Frontmatter. A new ADR carries `status: proposed`; only the operator sets `approved` (`arch:ref-adr-format.md` § Status).

# Concurrent refreshes are safe and lock-free

Two refreshes can race on one expired refresh token. The second refresh returns 409, and the caller retries with the new token. Token rotation rests on [ADR-0001](0001-refresh-tokens-are-single-use.md), and the 15-minute TTL in [token TTL](../research/token-ttl.md) makes the race rare.

> The paragraph: the context and the option chosen. The why goes under `## Reason`. A helper, an error value, or a call order is the TODO's, not the ADR's. Cite a fact by its research file, and another ADR by a markdown link.

## Reason

In the context of token refresh, facing two refreshes that race on one expired token, we decided for a 409 on the second refresh and against a single-flight lock in Redis, to keep refresh lock-free, accepting that a client must retry on 409. The race hits under 0.01% of traffic, and the lock costs about 40 lines of locking code.

Decided by the operator, 2026-06-18: [QUESTIONS.md answer refresh-race](../QUESTIONS.md).

## Properties

| Id | Property | If broken | Recovers by |
|---|---|---|---|
| P1 | [keep] A refresh that issues no new token pair changes no stored token. | A failed refresh revokes the old token, and the user must log in again. | a human |
| P2 | [new] Two refreshes of one refresh token issue at most one new token pair. | Two clients hold valid pairs from one token, so a stolen token stays usable. | a human |

> Each live Property is one rule, `ADR-NNNN/Pn`. P3 was dropped, so the table has a gap and the changelog names it. The numbering rule is in `arch:ref-adr-format.md` § Properties are the rules.

## Considered Options

- Allow both refreshes — rejected: two valid pairs from one token break single use.
- Single-flight lock in Redis — rejected: about 40 lines of locking for under 0.01% of traffic.

## Consequences

- A client that fires two refreshes at once must handle 409 and retry.
- The refresh that loses the race returns 409.

> Optional, like `## Considered Options`. Omit it when it is empty.

## Changelog

- 2026-06-18 — Drafted from the answer to the question `refresh-race` in QUESTIONS.md: the second refresh returns 409.
- 2026-07-02 — Dropped P3: the SDK retries on 409, so the handler sends no `Retry-After` header.

> Every edit bumps `updated` and appends one line. Refine and reverse: `arch:ref-adr-format.md` § Refine in place, reverse by supersede.

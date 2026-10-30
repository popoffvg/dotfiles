---
kind: architecture
created: 2026-06-18
updated: 2026-07-02
source: human
---

> Copy to `<notes-dir>/adr/NNNN-<slug>.md` and delete every `>` block except the quote under `## Reason` and the `> and-what:` quote under each Property. The `adr` skill owns the procedure and the title rules.
> The wm keys — `kind: implementation` with `todo: TODO-N`, and `source` — are `arch:ref-adr-format.md` § Frontmatter. The `status` line is the operator's: an agent writes none, and the operator sets `approved` (`arch:ref-adr-format.md` § Status).

# Concurrent refreshes are safe and lock-free

Two refreshes can race on one expired refresh token. The second refresh returns 409, and the caller retries with the new token. The 15-minute TTL in [token TTL](../research/token-ttl.md) makes the race rare, and token rotation rests on [ADR-0001](0001-refresh-tokens-are-single-use.md).

> The paragraph: the context, the option chosen, and the reason. Cite a fact by its research file, and another ADR by a markdown link.

## Reason

> "A 409 is enough. I do not want 40 lines of Redis locking for a case under 0.01% of traffic."

## Properties

- P1. [new] Two refreshes of one refresh token issue at most one new token pair.
  > and-what: `data` — two clients hold valid token pairs from one refresh token, so a stolen token stays usable — recovers by a human.
- P2. [keep] A refresh that issues no new token pair changes no stored token.
  > and-what: `outage` — a failed refresh revokes the old token, and the user must log in again — recovers by a human.
- P3. (dropped 2026-07-02: the SDK retries on 409, so the handler sends no `Retry-After` header)

> Each live Property is one rule, `ADR-NNNN/Pn`. Never renumber; P3 shows the dropped form (`arch:ref-adr-format.md` § Properties are the rules).

## Considered Options

- Allow both refreshes — rejected: two valid pairs from one token break single use.
- Single-flight lock in Redis — rejected: about 40 lines of locking for under 0.01% of traffic.

## Consequences

- A client that fires two refreshes at once must handle 409 and retry.
- The refresh that loses the race returns 409.

> Optional, like `## Considered Options`. Omit it when it is empty.

## Changelog

- 2026-06-18 — Drafted from the answer to the question `refresh-race` in QUESTIONS.md: the second refresh returns 409.
- 2026-07-02 — Dropped P3: the SDK retries on 409.

> Every edit bumps `updated` and appends one line. Refine and reverse: `arch:ref-adr-format.md` § Refine in place, reverse by supersede.

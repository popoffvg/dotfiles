---
status: proposed # proposed | approved — only the operator sets approved
kind: architecture # or feature: what the user can do and see
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# {The properties the decision gives the system — not the option picked}

{1-3 sentences: the context and the decision. For a feature: who uses it, how they start it, and what they get. The why goes under Reason, not here.}

## Reason

In the context of {the use case or the component}, facing {the concern or the force}, we decided for {the option} and against {the strongest alternatives}, to achieve {the quality the title names}, accepting {the cost or the downside}.

Decided by {the operator | the code, for source: auto}, YYYY-MM-DD: {link to the grill item, the chat date, or the file:line}.

## Properties

<!-- Before filling this table, write one row per Property in gates/<this file name> (ADR-FORMAT.md#property-gate). -->

| Id | Property | If broken | Recovers by |
|---|---|---|---|
| P1 | [keep] or [new] {plain statement of a boundary theorem, preserving its conditions} | {what a caller, a user, or an operator sees} | {retry, restart, a human, or itself} |

<!--
Optional, only when they add value — placed here, above the changelog:

## Considered Options
- {option} — rejected because {reason}

## Consequences
- {non-obvious downstream effect}

Superseded or deprecated: add the changelog line `Superseded by [ADR-NNNN](../NNNN-slug.md)` or `Deprecated: <reason>`, then `git mv` this file to docs/!archived/adr/.
-->

## Changelog

- YYYY-MM-DD — Drafted.

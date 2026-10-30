---
kind: architecture # or feature: what the user can do and see
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# {The properties the decision gives the system — not the option picked}

{1-3 sentences: what is the context, what did we decide, and why. For a feature: who uses it, how they start it, and what they get.}

## Reason

> {the operator's words: why this option won}

## Properties

- P1. [keep|new] {a guarantee the system keeps while this decision holds, in one plain sentence; for a feature, what the user observes}
  > and-what: {impact} — {what a caller, a user, or an operator sees when the system breaks P1} — recovers by {retry | restart | a human | itself}

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

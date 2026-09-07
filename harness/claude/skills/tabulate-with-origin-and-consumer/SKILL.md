---
name: tabulate-with-origin-and-consumer
description: Use when tabulating the elements of a design for review — output columns, pipeline steps, config settings, API fields, UI controls, feature flags. Give every row four things beyond its name: where the value comes from, where the decision to have it was made, which rollout phase it belongs to, and who consumes it. A table of names alone cannot answer the reviewer's actual question, so it comes back for another pass.
metadata:
  origin: self-improvement
---

# Every row needs its origin, its phase, and its consumer

Build the provenance columns in the first version. A reviewer reading a design table is deciding
whether each element should exist — and that needs the decision behind it and the thing downstream
that needs it, neither of which a name and a type carry.

## The five questions per row

| Column | Answers |
|---|---|
| Source | where the value comes from — upstream producer, computed in-stage, user input |
| Stage | which step produces it, keyed to a companion step list so the two tables join |
| Decided in | which unit records the decision — the source corpus's own unit id, or a note of yours |
| Phase | which rollout phase it belongs to; mark cross-phase invariants explicitly |
| Consumer | who reads it — a named column, a page, an export, or nothing (say "nothing") |

A row whose Consumer is empty is a finding, not a gap in the table: it is an element nobody needs.
A row whose "Decided in" is empty is undecided work masquerading as settled design.

## Rules

1. **Cite the source corpus's units, not its rendered docs.** Provenance points at the atom, ADR,
   or ticket that holds the decision — a rendered spec is assembled from those and cannot own one.
   See `edit-the-source-unit-not-the-render`.
2. **Distinguish inherited from newly decided.** Mark whether the decision came from the upstream
   corpus or was made during the current work. That split is what the reviewer scans for: the
   second kind is the part they have not yet approved.
3. **Ship a companion step list with stable step ids** and use those ids as the Stage values, so
   the element table and the flow are one artifact in two views rather than two drifting ones.
4. **Label every node and cell with the real identifier**, in the table and in any companion
   diagram: the package name, the module filename, the column id, the function. A generic step
   label ("AntiFold step", "the scoring stage") cannot be grepped, cannot be checked against the
   code, and hides whether the thing exists yet. Look the names up before drawing; they are also
   the fastest way to catch a step that has no implementation behind it.
5. **Report contradictions the table surfaces** rather than smoothing them. Filling a grid forces
   every cell, and the cells that cannot be filled consistently are real spec conflicts.

## Scope note

This is not speculative enrichment of a named shape — the columns are the deliverable's reason to
exist, because the table is read to make accept/reject calls. When the ask is for a plain list of
names to *use* in code, `deliver-the-named-shape` governs instead: build the named shape and offer
the rest.

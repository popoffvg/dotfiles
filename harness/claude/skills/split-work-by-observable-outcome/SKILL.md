---
name: split-work-by-observable-outcome
description: Use when breaking work into multiple items — TODO rows in a spec ledger, tickets, a commit plan, subtasks, milestones — and the instinct is one item per layer, per file, or per component. Checks each candidate item against "who observes this on its own", so a single new component does not arrive as ten rows nobody can see individually. Triggers on drafting a work breakdown, "split this into TODOs", "plan the commits", or a reviewer saying the list is too granular.
metadata:
  origin: self-improvement
---

# Split where someone can observe the piece, not where the code has a seam

Layer boundaries inside one new component are seams in the *code*. A work item is a promise about an
*outcome*. When those two get conflated, a single new component arrives as one row per internal layer,
and none of the middle rows is anything a user, a caller, or a test can observe on its own.

Ten rows saying "a function now exists" are not ten outcomes.

## The check

For each candidate item, ask both questions:

1. **Who observes this item alone?** A user, an external caller, an existing consumer, a test that
   passes with only this item done. Name them. "The next item in this list" is not an observer.
2. **Does it cross a boundary the project actually enforces?** A separate repo, a separate release or
   version, a published package, a deploy unit, a different owner or review path.

**Either question answers cleanly → its own item.** A separate repo genuinely cannot land in the same
commit; an existing consumer can genuinely be migrated and reverted on its own.

**Neither does → fold it into the item it serves.** It is an internal build step, and internal build
order belongs in that item's body.

## What tips the trade-off

This is a real trade-off, not a rule with one answer. Both directions have a cost worth naming:

| Split finer when | Keep it one item when |
|---|---|
| A layer has a consumer that already exists and can adopt it independently | Nothing consumes the component yet — every layer is reachable only through the layer above |
| Pieces cross repos, releases, or deploy units | It is one new directory landing at once |
| The work is long enough that partial progress must be reviewable | Reverting any piece alone would leave a state nothing can exercise |
| Different pieces need different reviewers | One reviewer reads the whole thing anyway |

A refactor across existing call sites usually splits. A brand-new component with no consumers usually
does not.

## When you merge, the order has to go somewhere

The finer breakdown was encoding a build sequence — deepest dependency first — and merging deletes
that record. Write the sequence into the merged item's body explicitly, as an ordered build rather than
a list of files. Otherwise the merge silently discards the one thing the layering was right about.

State the accepted cost too: one item means one commit and one verification gate over everything in it,
so reverting the visible part reverts the foundations with it.

## The tell while drafting

A breakdown that mirrors the directory tree, or that reads `<layer name>` down the whole column, was
derived from the code's shape rather than from anything observable. When the list feels long, do not ask
"can these be shorter" — ask **which of these has no observer of its own**.

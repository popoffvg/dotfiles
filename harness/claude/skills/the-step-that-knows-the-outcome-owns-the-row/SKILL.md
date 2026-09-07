---
name: the-step-that-knows-the-outcome-owns-the-row
description: Use when more than one stage of a pipeline appends rows, events, or status records to a shared store keyed the same way, and the consumer keeps one record per key by precedence — first-wins, last-wins, or earliest-step-wins. Fires when adding a reason/verdict row to an early stage, when a key starts being written by two stages, and when reviewing which stage should emit a given reason. The stage that can still see the final outcome must own the row; an early stage guessing it wins the precedence race and publishes a verdict the run later contradicts.
metadata:
  origin: self-improvement
---

# The stage that knows the outcome owns the row

When several stages append to one keyed store and the consumer collapses duplicates by precedence,
a row is not a report — it is a **claim that wins or loses a race**. An early stage that writes a
verdict about the whole run ("nothing was produced for this item") wins the race precisely because
it ran first, and is then contradicted by later stages that actually produced something. The store
stays internally consistent and the rendered page lies.

**Before adding a reason row to a stage, ask what the row asserts and whether this stage can see it.**

- The row asserts only what this stage measured (a scan found no target, a filter matched nothing) → this stage owns it.
- The row asserts something about the run's outcome (nothing shipped, this input contributed nothing, the item was dropped) → return no row here; let the stage that decides shipping write it, even if that means the reason string moves downstream.
- The row would be written for a mode or objective this stage's configuration never actually ran → return no row. A record must be scoped to what ran, not to what the code path happened to reach.

Leave a comment at the removal site naming which stage now owns the reason — the next reader sees a
missing append, not a deliberate hand-off.

## Test the collapse, not the producers

Each producer asserted in its own test file passes while the pair is broken: producer A's test sees
A's row, producer B's test sees B's row, and nobody runs the consumer's reduce over both. **Add one
test that feeds every producer's output through the real collapse for the same key** and asserts the
single surviving record. That is the only test shape that catches a precedence race.

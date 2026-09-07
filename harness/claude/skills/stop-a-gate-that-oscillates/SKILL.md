---
name: stop-a-gate-that-oscillates
description: Use when an automated review loop — a lint/name/comment critic, a CI auto-fixer, a linter with competing rules, an LLM reviewer running rounds until it passes — returns a finding that reverses one it made earlier on the same symbol, file, or line. Triggers on a fixup trail whose commits cancel each other, a gate that keeps failing while the tests stay green, a round budget being spent with no net diff, or "rename X to Y" followed later by "rename Y to X", or "delete this test" followed later by "restore it". Decide by hand instead of spending another round.
metadata:
  origin: self-improvement
---

**A gate that reverses its own earlier verdict is not converging.** Stop the loop and settle the
point yourself. Another round buys a commit that cancels the previous one, and the budget runs out
with the work correct and the status reported as blocked.

## The tell

Compare each round's findings against every earlier round, keyed on the **symbol or line**, not on
the wording:

- Round 1 says `mode` → `run_mode`. Round 3 says `run_mode` → `mode`. Same symbol, opposite verdict.
- Two fixup commits whose diffs are inverses. `git show A; git show B` — if B undoes A, the loop
  produced nothing.
- Round 1 says "delete this test — it mirrors the implementation". Round 2 says "restore it —
  deleting it loses unique coverage". Same test, opposite verdict.
- The gate keeps failing while the test suite stays green and the diff stops shrinking.

One repeated finding is a real defect you have not fixed. A **reversed** finding is the gate
disagreeing with itself.

## What to do

1. **Stop the chain.** Do not spend the next round.
2. **Decide the point yourself**, from the repo's own usage: grep how the name is spelled elsewhere,
   read the caller, follow the existing convention. Whichever side the codebase already uses wins.
   Check two things specifically: an authoritative corpus rule (a `CONSTRAINTS.md`-style row or
   decision note) that already fixes the spelling, and whether one of the two candidate names is
   already used *elsewhere* for a genuinely different concept — that is a sign the gate conflated
   two concepts, not evidence that a rename is owed.
   On a delete-vs-keep reversal about a **test**, settle it by asking whether the test crosses a
   boundary the code it "mirrors" does not — a serialized file, an argv, a wire format. A case
   that asserts a constant *and* the bytes written from that constant is not redundant; it is the
   only thing that fails when someone edits the constant and forgets the writer.
3. **Check the net diff of the trail** before reporting anything. Fixups that cancel mean the code
   under review never changed, so any verdict about it still stands from before the loop began.
4. **Run the gates the loop never reached.** A wave that fails on style blocks the deeper gates
   behind it, so the change may be entirely unverified where it matters. Run those directly.
5. **Report the oscillation as the blocker** — not the finding it last printed. "The name gate
   reversed itself on one parameter" is actionable; "blocked on naming" sends the next reader to fix
   a thing that is not wrong.

## Why it happens

A cheap gate judges a diff without the context that settles the question — it sees a parameter named
one thing and a caller naming it another, and picks whichever side it read first. Two runs read them
in different orders and reach opposite conclusions. The gate has no memory of its own last verdict,
so nothing stops it flipping.

This is why the fix is a human read of one line of context, and why capturing it as "the gate was
wrong" is not enough: the gate will do it again on the next symbol whose two ends disagree.

## The related smell it sometimes hides

An oscillating name finding often means the two ends genuinely disagree — a parameter and its caller
use different words for one concept. Settle it once, in the direction the rest of the codebase
already uses, and the gate has nothing left to flip on.

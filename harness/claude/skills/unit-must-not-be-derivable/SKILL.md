---
name: unit-must-not-be-derivable
description: Use before adding OR removing a unit in a modular corpus — a spec atom, an ADR, a doc section, a config entry, a test case, a rule in a rules file, a skill. On adding, checks whether an accepted unit already implies the new one, so consequences do not get filed as decisions, and whether a partly-new candidate is restating mechanics another unit already owns. On removing or merging, checks the surviving unit actually states what the removed one said, so a compression does not silently drop detail. Triggers on "add an atom/section/ADR for X", "merge these into one", "retire/delete the old ones", drafting a batch of units at once, or a reviewer asking "why are you adding that?" or "how can we use DRY here?".
metadata:
  origin: self-improvement
---

# A new unit must state something no accepted unit already implies

Before writing a unit, find the accepted unit nearest to it and ask: **does that one already decide
this?** If it does, the new unit is a consequence, and a consequence is not a unit.

## The test

Read the candidate's statement, then read the accepted units it would sit beside. The candidate fails
if either holds:

- **Derivable** — someone who has read the accepted units could state the candidate's claim without
  being told it. *"The package ships no helper function"* is derivable from *"the package is a flat map
  of plain strings"*: a map of strings cannot hold a function.
- **Same question** — the candidate answers a question an accepted unit already owns. A caveat on a
  rule belongs *in* that rule; splitting them makes a reader consult two places to learn that one
  apparent option is forbidden.

A candidate that survives both states something new and owns its own question.

## What to do with a failure

- **Derivable** → drop it. If one clause of it is genuinely new, move that clause into the unit it
  follows from.
- **Same question** → fold it into the owning unit, carrying its reason in compressed form.

Dropping is not losing the content: the question it answered is still discharged by whichever unit
absorbs it.

## A candidate that is only partly new — keep the new clause, cite the rest

Both failures above delete the whole candidate. The third case keeps it, and the trap is what goes
**inside** it. When a candidate is genuinely needed but the rule it invokes is owned elsewhere, write
only the part no other unit states — usually which rule applies, and under what condition — then name
the owner. Copying the owner's body across is duplication that the corpus now has to keep in sync, and
the copy is what goes stale.

The test: strike every sentence a reader could get by following the citation. What is left is the
unit. If nothing is left, the candidate was a `Same question` failure after all.

This is where a corpus with a declared owner per rule gets broken by an ordinary edit: the edit lands
in the consuming file, the mechanics feel helpful inline, and now two files state the same procedure.
Check for an owner before writing the body, not after.

## An optional field whose default already equals what you set is derivable too

The same test applies to a config entry's own fields, and the accepted unit doing the implying is the
**schema's documented default**. Before writing a field, read its declaration: an optional field whose
default is derived from a field you are already setting must not be written out. The copy adds nothing
and is free to drift from the value it duplicates, and the drift is legal — nothing rejects an entry
whose redundant field disagrees.

Two things make this one easy to miss. A neighbouring file in the corpus usually spells the field out,
so it reads as required; and the pair looks like belt-and-braces rather than duplication. Check the
schema, not the neighbour: an `,?`-style optional marker plus a documented fallback is the evidence,
and the resolver function that applies the fallback confirms it.

## Why this matters more than it looks

Every unit is read at every future orientation and maintained at every future change, so an unearned
one is charged forever against work done once. Worse, a derivable unit **looks** like an independent
decision — a later reader treats it as a separate commitment, and may revise it into conflict with the
unit it was silently derived from.

## Re-run the test after every simplification

The test applies to units already written, not only to new ones. When a decision simplifies the design —
a structure flattens, a mechanism is dropped, a rule is restated more generally — walk the units that
existed to serve the old shape and ask which still carry weight.

A concept introduced to explain a structure does not survive the structure's removal. It goes quiet
instead of failing: nothing references it, nothing contradicts it, and it sits there being read.

So when a simplification lands, name the units it made dead and remove them in the same pass. Deleting
an accepted unit is legitimate — that is what version history is for — and leaving it is how a corpus
accumulates vocabulary nobody uses.

## Removal runs the test in reverse — against the surviving text, not your summary of it

**Before deleting a unit you folded into another, read the survivor and check it states what the
removed one said.** The test for removal is the mirror of the test for addition: a unit may go only
when what it says is *derivable from what remains*. The failure is silent, because the merge felt
complete while it was being written.

Compression is where it breaks. A row in a table, a bullet, or a one-line rule reads as the whole of
the unit it replaced, and the operational detail — the per-case table, the exact command, the
platform trap, the counter-example — is simply gone. Diff the survivor against each removed unit and
list what did not make it across, rather than trusting the merge you just performed.

What does not fit the survivor is not proof the removal was wrong; it means the detail needs a home.
A reference file the survivor points at keeps it one read away, so the survivor stays short and
nothing is lost.

**Check the corpus is versioned before deleting anything from it.** A corpus outside version control
has no history to recover from, so "delete, it is in git" is false there. Move it into the tracked
tree first; then removal is reversible and the evidence behind each retired unit survives with it.

## The tell while drafting

A batch drafted in one pass is where this happens: momentum produces one unit per *paragraph of
thinking* rather than one per *thing decided*. When a batch feels long, the question is not "can these
be shorter" but "which of these is a consequence of another".

Say plainly which candidates failed the test and why, rather than defending the whole batch. A
reviewer asking "why are you adding that?" has usually already spotted the derivable one.

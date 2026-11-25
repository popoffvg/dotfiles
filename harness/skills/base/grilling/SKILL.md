---
name: grilling
description: Settle a plan, a design, or a batch of unclear items by deciding every open point and handing the user a file of decisions to check, with only the hard-to-undo ones up front. Use for "grill me", "stress-test this plan", and "these comments are unclear, ask me".
version: 0.5.0
---

# grilling

Decide every open point yourself. Ask the user to check only the decisions that are hard to undo. The `to-user` skill owns the file and the hand-over.

1. List the open points. Give each one a slug.
2. Settle each point from a source: the user's words in this task or an earlier grill, the repo rules (`AGENTS.md`, `GLOSSARY.md`), or the code. A quote settles a point only when it picks one option. A goal that every option reaches picks none.
3. Decide each other point, and write the reason. A point that depends on another point names it: `(rests on <slug>)`.
4. Sort each decision with one test: can one small commit change it after the user sees the result?
   - Yes: one line under **Decided**, with its source or reason.
   - No: a `[decide]` block at the top of the file. The root decision, scope changes, data and migrations, contracts, and words the system cannot do as written always go here.
5. Write `grill-<subject>.md` with at most five `[decide]` blocks. If more, write only the root block this round. Hand the file over with `to-user`.
6. Read back only the changed lines and slots. Decide again each point that rests on a changed decision, and write the next round.
7. Stop when the user changes nothing in a round. Say the subject in the user's words, and name what stays undecided.

A `[decide]` block holds one decision, the real other option, and what breaks if the decision is wrong. An empty answer slot accepts it. Show two designs with `option-diffs`. When the decision is what the user's words mean, quote the words and list each reading.

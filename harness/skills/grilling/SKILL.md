---
name: grilling
description: Settle a plan, a design, or a batch of unclear items by deciding every open point and handing the user a file of decisions to check, with only the hard-to-undo ones up front. Use for "grill me", "stress-test this plan", and "these comments are unclear, ask me".
version: 0.4.0
---

# grilling

Distilled from **grill-me**: https://github.com/mattpocock/skills

**Decide every open point; ask the user to check only the decisions that are hard to undo.** The user reads decisions, not questions, and changes the ones that are wrong.

**The decisions go in a file.** The `to-user` skill owns the file shape and the hand-over.

## Procedure

1. **List the open points.** Number each one as a candidate, `P1`, `P2`, …, before you ask anything.
2. **Settle each candidate from a source.** Read the source before you call it silent. The sources, in order:
   - the user's own words in this task: the comment, the first message, earlier answers in this grill, earlier grill files, and the decision notes in `.notes/`;
   - the repo rules: `CLAUDE.md` files, `GLOSSARY.md`, `PATTERNS.md`, and the skills they name;
   - the code: an existing type, package, state, or convention that already does the job.

   A source settles a candidate in one of three ways. Each candidate ends this step with its source written beside it, or marked open.
   - **A quote that picks one option.** The quote fails if the user could answer "that is not what I meant" without going against it. A goal that every option reaches ("recreate the installation", "remember the word") picks none of them: how much, which part, in what order, and for which cloud stay open.
   - **Elimination.** A rule, a code fact, or an earlier answer breaks each other option. Write the fact that breaks each one. This covers a reading of the user's words that a repo rule forbids, and an option that leaves the code in a state an earlier answer removes.
   - **An earlier session or grill.** What it settled stays settled, even when its record holds no quote: the text that session left is the decision.
3. **Decide the mechanical candidates.** A candidate is mechanical when every option gives the same behaviour, the same types, and the same scope, and only a name, a place, or a format differs: a branch name, a file or test location, a flag spelling, a hash format. A choice that changes the shape of a type, what ships, or what the user gets is never mechanical.
4. **Answer the user's own questions.** A comment that asks you something ("Do we need that part now?") gets your answer as a decision, with the reason.
5. **Decide every open candidate yourself.** Pick the option that the user's words and the sources support best, and write the reason. A child is decided on its parent's decision and names it: `(rests on P3)`. A child is a candidate whose options change with another candidate's answer.
6. **Run the undo test on each decision from step 5: after the user sees the result, can it change in one small commit?** A decision that steps 2–4 settled from a source is a Decided line whatever the test says.
   - **Two-way door** — yes. It is one line under Decided.
   - **One-way door** — no. It goes first in the file as a block. These are always one-way doors: **the root** (the decision other decisions rest on), **scope** (a decision that drops, narrows, or widens what the user asked for: a cloud, a caller, a skill, a feature, or a limit that the spec sets and the request may lift), data and its migration order, a contract other code or people build on, and **words that cannot be done as written** (the user names a mechanism the system does not have, such as "append" on an object store that only replaces; the decision says why the literal reading fails).
7. **Write one round to a file** named for the subject, e.g. `grill-<subject>.md`. The round is done when every candidate is a block or a Decided line:
   - one `[decide]` block per one-way door, at most five; more than five means the root is still unclear, so write the root's block alone and keep the rest for the next round;
   - one `[info]` block named **Decided**: one line per two-way door, with its source. The user deletes or rewrites a line to change it.
8. **Hand the file over** — `to-user` step 2. The operator edits in place.
9. **Read back only the answered slots and the changed Decided lines.** Decide again every child that rests on a changed decision, and write the next round from those.
10. **Land the words.** An answer that coins a term, renames one, or gives one word to two concepts is a glossary change. When the project has a wm `<notes-dir>/GLOSSARY.md`, write the change there under its owner's rule (wm `code:ref-subcommand-rules.md` § Glossary) before the answer reaches a spec, a TODO, or code. The grill file keeps no `## Terms` section of its own.
11. **Stop when the user changes nothing in a round.** Say what you now understand the subject to be, in the user's own words, and name anything they chose to leave undecided.

## Blocks

A block states a decision. The user accepts it by leaving the slot empty.

- **One decision per block.** A block that settles two things gets one answer and loses the other.
- **The block holds what the user needs to judge it without opening anything else:** the decision, the other way, why it is hard to undo, and what breaks if the decision is wrong.
- **A one-way door between two designs shows both built** — the `option-diffs` skill.
- **The other way is a real position.** An option that keeps the defect the change exists to remove, or that buys nothing, is filler and was never a one-way door.
- **When the decision is what the user's words mean, quote the words.** Name the reading you picked, each other reading you can defend from the context, and the open one: "none of these — write what you mean".
- **Every decision agrees with what the user said.** If you think an earlier statement of the user is wrong, quote it in the block and say why.

## Output

A caller that defines its own output block owns the report — print theirs, not a second summary of your own. With no caller contract: the shared understanding in the user's words, the decision log (asked and decided), what stayed undecided, and the next action.

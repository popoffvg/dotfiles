---
name: grilling
description: Interview the user in rounds of file-based questions until a plan, a design, or a batch of unclear items is settled, asking only what the user alone can answer. Use for "grill me", "stress-test this plan", and "these comments are unclear, ask me".
version: 0.3.0
---

# grilling

Distilled from **grill-me**: https://github.com/mattpocock/skills

**Ask only what the user alone can answer.** A question earns a block when its answer depends on the user's intent, priority, or a fact that no source holds. You settle every other open point and report it under **Decided**.

**The questions go in a file.** The `to-user` skill owns the block shape and the hand-over.

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
5. **Run the two-answer test on each open candidate.** Name two options that a competent engineer would defend, and the fact about the user's intent that picks between them. Delete the filler options first (§ Blocks, "Every option is a real position"); if one option is left, decide the candidate. These candidates always pass and become questions:
   - **The root** — the candidate whose answer changes which other candidates exist or what their options are. Those candidates are its children. A candidate whose options stay the same whatever the root's answer is not a child.
   - **Scope** — a decision that drops, narrows, or widens what the user asked for: a cloud, a caller, a skill, a feature, or a limit that the spec sets and the request may lift.
   - **Words that cannot be done as written** — the user names a mechanism the system does not have ("append" on an object store that only replaces). Say why the literal reading fails, and recommend the option closest to what the words were for.
6. **Write one round to a file** named for the subject, e.g. `grill-<subject>.md`. The round is done when every candidate is a block, a Decided line, or waiting:
   - one `[decide]` block for each question that passed step 5 and whose parent question is answered — at most five; a question under an open parent waits for the next round;
   - one `[info]` block named **Decided**, one line per decision from steps 2–5 with its source. The user deletes a line to reopen it.
7. **Hand the file over** — `to-user` step 2. The operator edits in place.
8. **Read back only the answered slots and the reopened Decided lines.**
9. **Open the next round.** Run steps 2–5 again on what the answers unlocked.
10. **Land the words.** An answer that coins a term, renames one, or gives one word to two concepts is a glossary change. When the project has a wm `<notes-dir>/GLOSSARY.md`, write the change there under its owner's rule (wm `code:ref-subcommand-rules.md` § Glossary) before the answer reaches a spec, a TODO, or code. The grill file keeps no `## Terms` section of its own.
11. **Stop when no branch is open.** Say what you now understand the subject to be, in the user's own words, and name anything they chose to leave undecided.

## Blocks

- **One question per block.** A block that asks two things gets one answer and loses the other.
- **When the question is what the user's words mean, the literal reading is option A.** Quote the words. Each other option is a reading you can defend from the context. The last option is open: "none of these — write what you mean".
- **Every recommendation agrees with what the user said.** If you think an earlier statement of the user is wrong, quote it in the block and say why.
- **Every option is a real position.** An option that keeps the defect the change exists to remove, or that the Detail says "buys nothing", is filler: delete it.
- **A block holds what the user needs to answer it without opening anything else:** what forced the question, what each option changes, and what breaks if the guess is wrong.
- **Recommend in every block.** An empty Answer slot means the user accepted the recommendation.

## Output

A caller that defines its own output block owns the report — print theirs, not a second summary of your own. With no caller contract: the shared understanding in the user's words, the decision log (asked and decided), what stayed undecided, and the next action.

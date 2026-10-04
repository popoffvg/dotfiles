---
name: grilling
description: This skill should be used when a plan, design, or a batch of unclear items must be settled by interviewing the user branch by branch until nothing is open — "grill me", "stress-test this plan", "interview me about the design", "these comments are unclear, ask me". The questions land in a file the user edits, one block per question with a recommended answer. Callers are the wm spec pipeline (`arch:sub-new.md`) and the `line-comment` plugin's act command.
version: 0.2.0
---

# grilling

Distilled from **grill-me**: https://github.com/mattpocock/skills

Interview the user about every part of the plan until you both understand it the same way. Walk the decision tree branch by branch — settle the decision others depend on before the ones depending on it.

**Ask only what the user alone can answer.** A question earns a block when the answer depends on the user's intent, priority, or a fact that no source holds. Every other open point is yours to settle, and you report it as decided.

**The questions go in a file, not in chat.** Use the `to-user` skill for the block shape and the hand-over; nothing here restates them.

## Procedure

1. **List the open points.** Write each one down as a candidate, without asking yet.
2. **Settle each candidate from a source, and read the source before you decide it is silent.** The sources, in order:
   - the user's own words in this task: the comment, the first message, earlier answers in this grill, earlier grill files, and the decision notes in `.notes/`;
   - the repo rules: `CLAUDE.md` files, `GLOSSARY.md`, `PATTERNS.md`, and the skills they name;
   - the code: an existing type, package, state, or convention that already does the job.

   A candidate a source settles is a decision. It does not become a question that asks the user to confirm it.
3. **Decide the mechanical candidates yourself.** A branch name, a file or test location, an export, a docs update, a flag spelling, a hash format: pick the answer that the conventions give.
4. **Run the two-answer test on each candidate that is left.** Name two options that a competent engineer would defend. Then name the fact about the user's intent that picks between them. If you cannot name the second option, or the fact is in a source, it is a decision and you make it.
5. **Write one round to a file** named for the subject, e.g. `grill-<subject>.md`:
   - one `[decide]` block for each question that passed step 4;
   - one `[info]` block named **Decided**, with one line for each decision from steps 2–4 and its source. The user deletes a line to reopen it.
   
   Put in the round only the questions whose parent question is answered. A question that depends on an open one waits for the next round.
6. **Hand the file over** — `to-user` step 2. The operator edits in place.
7. **Read back only the answered slots and the reopened Decided lines.** Do not parse the whole file again.
8. **Open the next round.** Run steps 2–4 again on what the answers unlocked. An answer often settles questions you had planned, so drop them.
9. **Stop when no branch is open.** Say what you now understand the subject to be, in the user's own words, and name anything they chose to leave undecided.

## Rules

- **A round holds at most five questions.** More than five that pass step 4 means the root of the tree is still open. Ask about the root first.
- **One question per block.** A block that asks two things gets one answer and loses the other.
- **When the question is what the user's words mean, the literal reading is option A.** Quote the words. Each other option is a reading you can defend from the context. The last option is open: "none of these — write what you mean".
- **A recommendation never goes against something the user said.** If you think the user's earlier statement is wrong, say so in the block and quote it. Do not hide it inside a different recommendation.
- **Every option must be a real position.** An option that keeps the defect the change exists to remove, or that the Detail says "buys nothing", is filler. Delete it. If only one option is left, step 4 makes it a decision.
- **A question the user cannot answer without opening something else is unfinished.** Put into the block what forced the question, what each option changes, and what breaks if the guess is wrong.
- **Recommend in every block.** An empty Answer slot means the user accepted the recommendation.

## Output

A caller that defines its own output block owns the report — print theirs, not a second summary of your own. With no caller contract: the shared understanding in the user's words, the decision log (asked and decided), what stayed undecided, and the next action.

---
name: grilling
description: This skill should be used when a plan, design, or a batch of unclear items must be settled by interviewing the user branch by branch until nothing is open — "grill me", "stress-test this plan", "interview me about the design", "these comments are unclear, ask me". The questions land in a file the user edits, one block per question with a recommended answer. Callers: the wm spec pipeline (`arch:sub-new.md`) and the `line-comment` plugin's act command.
version: 0.1.0
---

# grilling

Distilled from **grill-me**: https://github.com/mattpocock/skills

Interview the user about every part of the plan until you both understand it the same way. Walk the decision tree branch by branch — settle the decision others depend on before the ones depending on it.

**The questions go in a file, not in chat.** Use the `to-user` skill: one block per question, each carrying the source anchor, the question, and a recommended answer the user can accept as written. A grill is a batch, and a batch belongs in the user's editor, where they answer at their pace and see every question at once. Load `to-user` for the block shape and the extraction rule; nothing here restates them.

## Procedure

1. **Answer what the codebase can answer.** A question the code settles is not a question for the user. Read the code first and drop it.
2. **Write one round of questions to a file** — name it for the subject, e.g. `grill-<subject>.md`. Order the blocks so a question comes after the one it depends on. Every **Recommended** is a real answer you would defend, not a placeholder.
3. **Hand the file over** — `to-user` step 4; the operator edits in place.
4. **Read back only the answered slots.** Do not reparse the whole file.
5. **Open the next round** with the questions the answers unlocked. Each answer closes one branch and usually opens the next.
6. **Stop when no branch is open.** Say what you now understand the subject to be, in the user's own words, and name anything they chose to leave undecided.

## Rules

- **One question per block.** A block that asks two things gets one answer and loses the other.
- **A question the user cannot answer without opening something else is unfinished.** Put what forced the question, what each option changes, and what breaks if the guess is wrong into the block itself.
- **Recommend, always.** An unanswered block means the user accepted your recommendation, so a block with no recommendation wastes a round.
- **A round is a batch, not a queue.** Send every question the current branch allows at once; do not drip them one at a time.

## Output

A caller that defines its own output block owns the report — print theirs, not a second summary of your own. With no caller contract: the shared understanding in the user's words, the decision log, what stayed undecided, and the next action.

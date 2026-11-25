---
name: define-goal
description: Write a short prompt to an agent that already has the session context — the next turn of a Claude Code session, typed in the Ctrl+G buffer (a `.prompt` file in Zed) — and open it in the editor until the operator approves it. Use when writing, rewriting, or checking such a prompt.
---

# define-goal — the next turn in at most 80 words

The receiver already has the session: its files, its decisions, its terms. The prompt adds only what the session does not hold.

## Steps

1. **Write the draft** by the [Rules](#rules). Done when the draft has at most 80 words.
2. **Open the draft for review.** Use the label `goal` and follow steps 2 and 3 of the [`annotate`](../annotate/SKILL.md) skill. Tell the operator: "Add notes or edits to change the prompt. Close the tab without notes to approve it."
3. **Read the notes** when the tab closes. Use step 4 of `annotate`.
4. **Approve or rewrite.**
   - No notes: the operator approved the draft. Go to step 5.
   - Notes: rewrite the draft from each note and from the [Rules](#rules). Overwrite both copies with the new draft, drop the comments on the edit file, then go to step 2.
5. **Hand over the prompt.** Put the approved prompt in the reply as one fenced block. Remove the session files and comments with step 6 of `annotate`.

## Rules

1. Start with the goal: one verb and one object. "Add a `.prompt` extension to the Ctrl+G file", not "look at the editor setup". If two results fit the goal, sharpen the verb.
2. Give the operator's why in one sentence: the decision or the use the result serves. The receiver picks the trade-offs from it. If you do not know the why, ask the operator. Do not invent one.
3. Give only the limits the receiver would get wrong, each with its reason: what must not change, what to reuse, where the work stops. No limit is a valid count.
4. Give the acceptance: an input and its expected output, or a yes/no question. A check that the result cannot fail is no check.
5. Name each thing by the term the session uses, and point to a file by its path. Do not restate what the session holds.
6. Leave out the steps, the tool choices, and the order of work. The receiver picks them.
7. Write no sentence that changes no behavior: no greeting, no "please", no "make sure".

A sample shape. The labels are optional.

```
<goal>. <why>.
Limits: <limit> — <reason>.
Done when <check>.
```

---
name: short-prompt
description: Rules for a short prompt to an agent that already has the session context — the next turn of a Claude Code session, typed in the Ctrl+G buffer (a `.prompt` file in Zed). Use when writing, rewriting, or checking such a prompt.
---

# short-prompt — the next turn in at most 80 words

The receiver already has the session: its files, its decisions, its terms. The prompt adds only what the session does not hold.

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

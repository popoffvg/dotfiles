---
name: explain
description: Explain the current session, or one thing in it, in simple words, as a short tell-me file with a Context table. `/explain [thing]`.
disable-model-invocation: true
argument-hint: "[thing]"
---

# explain

`explain` is `tell-me` with two changes: the source is the current session, and the text is simple. Load the `tell-me` skill and follow its steps, with the changes below.

## Changes to `tell-me`

1. **Step 1, the approach.** With no argument, the topic is the work of this session, and the Context table is the whole body: take no approach. With an argument, take the one approach that best matches it, never two.
2. **Step 2, read the session first.** Read the chat, the files this session read or changed, `git status`, and `git diff`. Read other files only to close a gap in the session. Done when each row of Context, except Next, has a source: a short quote of the chat, a `path:line`, or a command.
3. **Step 3, size.** The limit is 200 words of prose; it replaces 400. Table cells and figures do not count. Ask nothing: list the parts that do not fit under Not covered.
4. **Step 4, write simply.**
   - Use the words of the operator, not the symbol names.
   - Omit **It is not**. The figure under The parts has at most 5 boxes.
   - **Check yourself** has the first 2 exit questions of the approach, or with no approach: "What is the goal?" and "What is next?".
   - Name the file `explain-<thing>`, or `explain-session` with no argument.
5. **The order of sections:** title, In one sentence, The rule, Context, The parts, the approach sections, Check yourself, Not checked, Not covered. Omit a Context row that has no item.

```markdown
## Context
| Part | What we have | Source |
|---|---|---|
| Goal | <what the operator wants, in their words> | <quote> |
| Known | <facts the session found> | <path:line or command> |
| Decided | <choices made, with the reason> | <quote> |
| Done | <changes made> | <file or commit> |
| Open | <questions with no answer> | <quote> |
| Next | <the next step> | — |
```

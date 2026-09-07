---
name: reask-in-prose
description: Use when the user rejects an AskUserQuestion tool call and replies "reask" (or similar). Re-ask the same clarifying questions in plain prose, not the multiple-choice tool again.
---

# Reask in plain prose after an AskUserQuestion rejection

When the user rejects an `AskUserQuestion` call and the follow-up is "reask" (or an equivalent nudge), do NOT call `AskUserQuestion` again. Re-ask the same clarifying questions as plain text in a normal assistant message.

## Do

1. Keep the questions and their options — only the delivery changes.
2. Write them as concise prose: number the questions, list the choices inline (a/b/c) with one-line descriptions.
3. Stop and wait for the reply. Don't reissue the tool.

## Why

A second identical tool call reads as ignoring the rejection. "reask" means "same question, different channel" — the user wants a text answer, not the multiple-choice UI.

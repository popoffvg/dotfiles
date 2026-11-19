---
name: one-shot
description: Run one self-contained prompt in a {light} forked agent and return its answer. Use on `/one-shot <prompt>`, when the prompt already carries every fact the task needs and no file in this session must change.
context: fork
harness-effort: "{light}"
agent: general-purpose
argument-hint: prompt
---

# One-Shot

$ARGUMENTS

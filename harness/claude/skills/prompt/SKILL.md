---
name: prompt
description: Grill the user, then write a prompt that states the goal — result, properties, acceptance criteria, limits. `/prompt <use case>`.
disable-model-invocation: true
argument-hint: <use case>
---

# prompt — state the goal, leave the path to the receiver

The use case: `$ARGUMENTS`. With no arguments, ask for the use case in one line.

A prompt MUST describe the goal: what exists at the end, what is true of it, how to check it, and where the work stops. A prompt MUST NOT prescribe steps the receiver can choose itself. The four parts, the gaps where goals break, and the skeleton are in `references/requirements.md`.

1. **Read `references/requirements.md`.** Done when you know the four parts, their tests, the gaps, and the skeleton.
2. **Fill the four parts from what you have.** Take facts from the arguments, the conversation, and any source the use case names. Write each fact under its part with its source. Done when each part has facts or is marked open.
3. **Answer each open point yourself.** Search what the use case names or touches: files, notes, earlier work of the same kind, existing prompts and skills for the same task. A fact you find fills the part. When you find none, infer the likely answer and mark it as a recommendation with what it rests on. Done when every open point has a fact or a recommendation.
4. **Grill the user on the goal.** Load the `grilling` skill. The result and the limits on scope are one-way doors — they go up front. Ask each gap in `Where goals break` that the use case touches; skip a gap only when a found fact closes it. Done when every part passes its test and the user changed nothing in the last round.
5. **Write the prompt** under the skeleton, in at most 150 words. Write the goal only — no steps, no tool choices, no facts the receiver can read from its own context. Drop an empty section. Done when every property has an acceptance check and the prompt breaks no anti-pattern.
6. **Check it cold.** Spawn one subagent with the prompt and the same access the receiver has. Ask it for three things: the result it would deliver, in two sentences; every point where it had to guess; every sentence it would act the same without. Compare its result with the user's. Fix each mismatch and each guess, in the prompt or by asking the user; delete each sentence on the third list. Done when its result matches and both lists are empty.
7. **Hand it over.** Write the prompt to `prompt-<slug>.md` in the scratchpad and open it with `~/.claude/scripts/open-file.sh`. In chat, list the recommendations the user accepted without changing. Done when the user has the file path.

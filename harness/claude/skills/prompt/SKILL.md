---
name: prompt
description: Write a prompt for the user's use case, grilling the user on every gap. `/prompt <use case>`.
disable-model-invocation: true
argument-hint: <use case>
---

# prompt — write an LLM prompt for a use case

The use case: `$ARGUMENTS`. With no arguments, ask for the use case in one line.

1. **Read `references/requirements.md`.** Done when you know every element, the anti-patterns, and the skeleton.
2. **Fill the elements from what you already have.** Take facts from the arguments, the conversation, and any file or repo the use case names. Write each fact next to its element with its source. Done when every element is filled, marked missing, or marked not applicable with a reason.
3. **Answer each gap yourself before you ask.** For every missing element, search for the answer: grep the repo, read the files and configs the use case touches, check the existing prompts, skills, and agents for the same task, read the docs of the tool or model the prompt targets. A fact you find fills the element — write it with its source. When you find no fact, infer the most likely answer from the use case and keep it as a recommendation. Done when every missing element has a found fact or an inferred recommendation, and each recommendation names what it rests on.
4. **Grill the user only on what you could not settle.** Load the `grilling` skill. Ask one block per inferred recommendation on a required element, and per optional element whose answer changes the prompt. Never ask about a found fact. Run rounds until no required element is open. Done when every required element has a found fact, an answer, or a recommendation the user accepted.
5. **Write the prompt** under the skeleton, in at most 200 words. Go over only when the receiver has no repo and no tools to read from, and say why in chat. Write only what the receiver cannot find or infer: the goal, the decisions, the success criteria. A fact the receiver already has or can read — the repo, its files, CLAUDE.md, its skills, the conversation — gets a pointer at most. A check lives in `<success_criteria>` only; `<instructions>` holds what a check cannot say: inputs, paths, names, order. Show the output as a short filled-in skeleton, not as prose about it. Give a rule its reason only when the receiver could apply it too wide or too narrow without it. Drop empty sections. Done when the prompt fits the budget and breaks no anti-pattern.
6. **Check it cold.** Spawn one subagent with the prompt, one realistic input from the use case, and the same access the receiver has (repo, files, tools). Ask it for two lists: every point where it had to guess, and every sentence it would act the same without. Fix each guess its own access does not answer, in the prompt or by asking the user. Delete each sentence on the second list. Done when both lists are empty.
7. **Hand it over.** Write the prompt to `prompt-<slug>.md` in the scratchpad and open it with `~/.claude/scripts/open-file.sh`. In chat, list the assumptions you made and the elements the user left open. Done when the user has the file path.

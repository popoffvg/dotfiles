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
5. **Write the prompt** under the skeleton. Write only the top-level details: the goal, the reasons, the rules, the success criteria. A prompt is not a handover. A fact the receiver already has or can read itself — the repo, its files, CLAUDE.md, its skills, the conversation — gets a pointer at most, never a copy. Drop sections that are empty. Give every hard rule its reason. Done when the prompt holds every answered element, repeats nothing the receiver already sees, and breaks no anti-pattern.
6. **Check it cold.** Spawn one subagent with the prompt, one realistic input from the use case, and the same access the receiver has (repo, files, tools). Ask it to list every point where it had to guess. A guess that its own access answers is not a gap — leave it out of the prompt. Fix each other guess in the prompt or ask the user. Done when the subagent reports no guess you can remove.
7. **Hand it over.** Write the prompt to `prompt-<slug>.md` in the scratchpad and open it with `~/.claude/scripts/open-file.sh`. In chat, list the assumptions you made and the elements the user left open. Done when the user has the file path.

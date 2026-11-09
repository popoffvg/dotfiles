---
name: skill-builder
description: Interview the user and write the simplest skill that makes the product they need — or hand over a prompt when a skill is wrong. Use for "create a skill", "make a skill for X", "turn this into a skill".
---

# skill-builder — a skill is a product spec

**Product.** One new `SKILL.md` (plus `references/` or a script only when one path needs it), or the verdict "use a prompt" with that prompt.

**Reader.** The agent that runs the skill. The user checks what that agent makes.

**Properties** — the written skill MUST pass each one:

1. It names the product of one run, the reader of that product, and what the reader does with it.
2. It lists the properties of that product. Each one is a yes/no check a reviewer runs on one output.
3. It states the cause: why this product, and not a near alternative.
4. Every other sentence changes the product. A sentence the agent would follow the same without is cut.
5. Every tool it calls was run once on a real input and worked.
6. The description says what the skill makes, then the trigger phrases, and nothing more.
7. It passed a cold run on real past cases.

**Cause.** Skills that list steps but never define their product give results the user cannot use. A skill that wraps a broken tool fails whatever its words say. A product the user needs once is a prompt. A test on made-up input passes skills that fail on real work.

## Steps

1. **Fill from context.** Read the skills that do the same work and any example of the product the user gave. Write each fact under Product, Reader, Properties, Cause. Collect 2–3 real past cases: search the user's sessions for requests of the same product, or for the same problem. Session files start with `-`, so search them with `find ~/.claude/projects -name '*.jsonl' -print0 | xargs -0 grep -l <pattern>`; a shell glob passes them to `grep` as flags and finds nothing. Save each case to `<scratchpad>/cases/<n>.md`. A case is an input the user gave plus an output: **accepted** is the user's own rewrite, or the last output with no complaint after it; **rejected** is an output the user corrected, with the correction. When the output file is gone, rebuild it from the transcript. When two cases disagree, the later one wins. Done when each part has facts or is marked open, and the cases are saved or the user confirmed none exist.
2. **Gate: skill or prompt.** Name the product that one run of the requested skill makes — a report, a table, a file — not the work of building the skill. When the request can name two products, ask the user which one before the gate. A skill is right only when the user will ask for that product again, and each time it has the same reader and the same parts. Facts the agent lacks do not make a skill alone. When the past cases do not show a repeat, ask the user when they will need it again. No past repeat and no named next use means a prompt: read `~/.claude/skills/prompt/SKILL.md`, follow it, hand over the prompt, and stop. Done when the verdict has its reason.
3. **Interview** with `to-user`: one `[decide]` block per open point, each with your recommendation. Product and reader go first. A point the request or a past case already answers is not open. Done when every part has an answer and the user changed nothing in the last round.
4. **Run the tools.** Call each tool the skill will call, on a past case input. When the tools depend on the input, run the ones the past cases need. A script the skill needs and does not have is written into the skill directory and run the same way. An existing tool that fails stops the build: report it. Done when each tool has one good run.
5. **Write the skill** in this order: frontmatter, Product, Reader, Properties, Cause, then Steps only where a past case shows the agent fails without them. Run the checks that the target directory's `CLAUDE.md` asks for a new skill. Done when the skill passes Properties 1–6 and those checks.
6. **Test cold on the past cases.** For each case, give the skill and the past input to a subagent that has not seen this conversation. A case passes when its output passes every product property, and, for a rejected case, fixes what the user rejected; other differences from the accepted output are not fails. Fix the skill for each fail and run the failed cases again. Use a made-up input only when no past case exists. Done when every case passes.
7. **Hand over** the path and each case: past input, new output, verdict. Done when the user has all three.

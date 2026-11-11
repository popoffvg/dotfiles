---
name: prompt
description: Write a goal prompt — result, cause, properties, checks, limits — that an agent runs for a one-off task. `/prompt <use case>`.
disable-model-invocation: true
argument-hint: <use case>
---

# prompt — a goal prompt for a one-off task

**Product.** One goal prompt in `<scratchpad>/prompt-<slug>.md`. The use case is `$ARGUMENTS`; with none, ask for it in one line.

**Reader.** An agent — a subagent, or a new session the user pastes it into. It chooses its own steps and delivers the result.

**Properties** — the prompt MUST pass each one:

1. It names one result: one verb, one object. Two readers name the same deliverable.
2. It states the cause: the problem or decision the result serves, and why this result and not a near one.
3. Each property is observable in the result and has a pass/fail check on the result, not on the path.
4. Each limit names a boundary the reader can see, with its reason.
5. It holds no steps, no tool choices, no order of work, and no fact the reader can read from its own context.
6. Two cold readers name the same result as the user, and neither reports a guess that would change the result.

**Cause.** A prompt that lists steps fixes the path and leaves the result open: the one past run gave a page of numbered procedure, and the skill it made solved the wrong problem because the prompt never said which decision the result serves.

## Steps

1. **Fill the parts** — result, cause, properties, checks, limits — from the arguments, the conversation, and the sources the use case names. Search the repo and the skills for existing work that does the same job. Mark each part that has no fact as open; when existing work exists, "reuse, wrap, or replace it" is always open.
2. **Interview** with `to-user`: one `[decide]` block per open part, each with your recommendation. Cause and result go first. Use the questions in `references/requirements.md` for each part the use case touches. Done when every part passes its test there and the user changed nothing in the last round.
3. **Write** under the skeleton in `references/requirements.md`. Done when Properties 1–5 pass.
4. **Cold check.** Give the prompt to two subagents with the reader's access, in parallel; one reader misses real gaps. Ask for: the result it would deliver, in two sentences; every point where it had to guess; every sentence it would act the same without. Fix each mismatch and guess, and delete each sentence on the third list except the cause and a limit's reason. Run the check again after a fix. Done when Property 6 passes.
5. **Hand over.** Open the file with `~/.claude/scripts/open-file.sh` and list in chat the recommendations the user accepted unchanged.

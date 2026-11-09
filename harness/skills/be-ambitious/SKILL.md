---
name: be-ambitious
description: Turn a task into a deeper version of itself, not a bigger one — name what a top professional in the field would do that the user did not ask for, the rawest material they would start from, the methods and tools they would use, and the external check that would show the result is right — then rewrite the prompt to ask for exactly that. Use on `/be-ambitious`, "be ambitious", "make this prompt deeper", "what would an expert do here", "raise the bar on this task", "rewrite my prompt like a pro would ask it". Not for more scope, more features, or prompt polish for tone or length.
argument-hint: [the task]
---

# be-ambitious

The task is `$ARGUMENTS`. When it is empty, take the last user request in this conversation. When there is none, ask for the task in one line and stop.

**Deeper, not bigger.** Keep the goal and the scope of the user. Depth is a higher standard for the same result: a better source, a sharper method, a real check. Drop each suggestion that makes the job larger and not better: a new deliverable, a feature, a side task.

When you do not know the field well enough to answer a step, say so. Do not invent a source, a tool, or a check.

## Steps

1. **Name the field.** Write it as one specific noun phrase: "SRE incident response", not "operations". Done when a specialist in that field would recognize the name as theirs.
2. **Name what a top professional would do that the user did not ask for.** Give the two or three moves that separate expert work from competent work here. Examples: state the decision the work serves, check the base rate, reproduce before the fix, write the counter-argument. A move changes how the result is reached; a move that leaves a new artifact behind, such as "add monitoring", is bigger, not deeper. Done when each move is an action, not a quality such as "be thorough".
3. **Name the rawest material.** Name the primary source, not the digest: the dataset, not the chart; the logs and the code, not the bug report; the methods section, not the abstract. Your memory is a digest too. For each source, search the repo and this conversation for where it lives: a path, a command, or a URL. Done when each source has a location, or "location unknown", which the rewrite asks the user to fill.
4. **Name the methods and tools.** Name each technique, library, or command, and say in one clause why it fits this task. "Analyze the data" is not a method; "bisect the commits with `git bisect run ./repro.sh`" is. Prefer the tool the repo already pins. With no repo, name the standard tool of the field. Done when each item is a step someone can run.
5. **Name the external check.** Name what shows the result is right, other than the user or the model: a test suite, a benchmark, a reproduction, ground-truth data, a known answer, a measurement, a reviewer, a real user. Write the observation that counts as a pass and the observation that counts as a fail. A check that passes on a wrong result proves nothing; the `with-proof` skill builds one that can fail. When a condition needs a value you lack, such as a baseline, name the value as a placeholder that the rewrite asks for. Done when both conditions are written.
6. **Rewrite the prompt.** Write it in the voice of the user, in one fenced block the user can copy. It starts from the raw material of step 3, uses the methods of step 4, and ends with the check of step 5 and its pass condition. Keep the scope of the original prompt. Done when every answer of steps 2 to 5 appears in the rewrite.

Stop after the rewrite. Offer in one line to run it now. Do not start the task until the user says so.

## Report

```markdown
**Field:** <field>

1. **Expert moves not asked for:** <move>; <move>
2. **Raw material:** <source> — <location>
3. **Methods and tools:** <method> — <why it fits>
4. **External check:** passes when <observation>; fails when <observation>

<the rewritten prompt in one fenced block>

Run it now?
```

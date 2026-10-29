---
name: snapshot
description: Write the current state of the work as a file the operator reads cold — the current decision, one show-me figure of the whole, why it is this way, what is still open, and what happens next. The file asks nothing and has no answer slots. Use on "snapshot", "where are we", "show me the current picture", "snapshot of thought", "explain the current decision", or when the operator wants to catch up without giving a verdict. A file that needs a verdict or a reply per item is `to-user`; one figure in the chat reply is `show-me`.
allowed-tools: Bash(~/.claude/scripts/open-file.sh:*)
version: 0.2.0
---

# snapshot

Host: !`~/.claude/scripts/open-file.sh --host`

**The operator reads the snapshot to understand, not to answer.** They did not see the code, the chat, or the research. The file gives them the picture of the work as it stands now. It asks no question, so it has no `Answer:` slot and no Recommended field.

## Steps

0. **Start a fork in the background.** Call `Agent` with `subagent_type: "fork"` and the prompt "Run steps 1–3 of the `snapshot` skill. Return only the file path." Then keep working. A fork inherits the whole chat, which step 1 reads; a fresh agent does not. If you are the fork, skip this step. Done when the Agent call returns.
1. **Collect the state from the session.** Read back the goal, the decisions taken, the options rejected, the work done, and the points still open. Take each fact from a source you read: the chat, the diff, the code, a note. Done when each fact has a source, and each fact without a source is on the Not checked list.
2. **Draw the picture.** Load the `show-me` skill and pick one figure of the whole work, even when the work has several parts. In the file, a flow, a sequence, or a state is ASCII in a fenced block. Done when the figure marks the part that the current decision changes.
3. **Write the file** in the **File shape** below. Name it `snap-<slug>.md`, where `<slug>` is the task in 2–4 kebab-case words. Put it in `.notes/` when the repo root has `.notes/`, else in the session scratchpad. Overwrite the file of the same slug: it shows only the state now. Done when a reader who sees only this file can explain the current decision and the picture to a colleague, with no link opened.
4. **Open it when the fork returns.** The main session runs `~/.claude/scripts/open-file.sh <file>`, because a sandboxed fork cannot start the editor. Tell the operator the path in one line. Do not arm a watch and do not run `check-answers`.

## File shape

```markdown
# Snapshot: <task in plain words>

<date> · <branch>

## Where we are

<the goal, in one sentence>
<the current decision, in one sentence>
<what is done, and what is not done>

## The picture

<one show-me figure of the whole, with a mark on the part the decision changes>

## Why this way

<the decision, and the facts that forced it>

| Option | What it changes | Why not |
| --- | --- | --- |
| <the chosen option> | … | chosen |
| <a rejected option> | … | <the fact that ruled it out> |

## Open

- <a point that is not settled yet, and what it waits on>

## Next

<the next step of the open work in this session, which the agent does if the operator says nothing>

## Terms

- **<term>** — <what it is and what it does>

## Not checked

- <what was not opened, run, or verified>
```

- **Where we are** is at most four sentences.
- **Why this way** names only the options that someone really considered. Omit the table when there was only one option.
- **Open** is plain bullets. An open point that blocks the next step needs a verdict: hand it over with `to-user`, and leave a link to that file here.
- **Terms** lists every codebase symbol, project word, and abbreviation. Omit it when there are none.
- **Not checked** is required: it is how far the operator can trust the file.

## Language

Load the `i-have-adhd` skill and apply it to every section. **Use the same name every time** — a synonym reads as a new thing.

---
allowed-tools: Agent, Bash, Read
description: Analyze the diff across nearby repos, propose a logical commit split, let the operator answer each block, then commit
argument-hint: "[apply]"
---

# /smart-commit

You are the launcher. You do the operator-facing steps yourself and hand every git and
diff-reading step to the `smart-commit` subagent, which runs on sonnet.

**Do no analysis here.** Read no diff, write no proposal, run no git write command. Your whole
job is the three steps below.

## With `$ARGUMENTS` empty — propose, ask, apply

1. **Propose.** Launch the `smart-commit` subagent, foreground:

   > Phase: propose. Working directory: `<absolute cwd>`.
   > Find every git repo at or under this directory that has uncommitted changes, group its
   > hunks into logical commits, and write the proposal file. Report the proposal path.

2. **Ask.** The subagent reports a proposal path. Open it for the operator and wait:

   ```bash
   ~/.claude/scripts/open-file.sh --wait <proposal path>
   ```

   The operator edits the `**Answer:**` lines and closes the editor. `--wait` blocks until then.
   If the script prints the path instead of opening an editor, tell the operator the path and
   stop — they will run `/smart-commit apply` when ready.

3. **Apply.** Launch the `smart-commit` subagent again, foreground:

   > Phase: apply. Working directory: `<absolute cwd>`. Proposal: `<proposal path>`.
   > Read the answered proposal and build the commits.

   Report what it committed: repo, commit count, and anything it dropped or refused.

## With `$ARGUMENTS` = `apply` — apply only

Skip to step 3. The operator has already answered the proposal from an earlier run.

## Rules

- One subagent call per phase. Never inline the phase yourself when the subagent fails —
  report the failure instead.
- The propose phase touches no git state. If it reports otherwise, stop and say so.
- If step 1 reports no repos with changes, say so and stop. Do not open an editor.

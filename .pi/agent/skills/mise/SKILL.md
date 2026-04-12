---
name: mise
description: Use only for explicit mise/task/repo commands: "mise", "mise run", "mise task", "copy-logs", "dump-db", "repos", "open repo", "add repo to workspace", or "use mise to setup deps".
---

# Mise skill

Run workspace tasks through `mise` and handle repo discovery/open flows.

## Trigger guard (important)

Use this skill **only** when the user explicitly asks for mise/tasks/repos actions.
Do **not** route generic product/feature requests here.

Examples that SHOULD trigger:
- "use mise to setup deps"
- "mise run <task>"
- "install new version" **when paired with** "use air setup" / "use mise"
- "mise repos" / "open repo"

Examples that should NOT trigger:
- comment UI behavior changes
- bug triage unrelated to tasks/tooling

## Execution-first behavior

When user gives a direct execution cue ("continue", "install new version", "reinstall now"):
1. Run one concrete mise action first.
2. Then report result briefly.
3. If task name is unclear, list tasks once (`mise tasks ls`) and pick the closest explicit task from user wording.

## Core commands

### List tasks
```bash
mise tasks ls
```

### Run task
```bash
mise run <task> [-- args]
```

Pass flags after `--`:
```bash
mise run dump-db -- -n my-namespace -o /tmp/mydb
```

### Task info
Read first lines of task file (prefer file read tool):
`mise-tasks/<task>`

### Reinstall / install-new-version flow (common friction)
If user asks to reinstall/install with mise:
1. `mise tasks ls`
2. Run dependency/setup task explicitly requested (for example `air setup` if present).
3. Run build/package/install tasks in order from available task list.
4. Return exact commands executed and status.

If any required task is missing, stop and report missing task names (no guessing).

## Repo search/open

### Search repos
```bash
mise run repos -- <query>
```

No query => list all repos.

After results, ask user:
1. Which repo?
2. Open mode:
   - Add to current workspace: `surf --add <repo_path>`
   - Open new window: `surf -n <repo_path>`

Fallback if `surf` missing: use `code` or `cursor` per user preference.

## Safety + correctness

- Never invent task names.
- Prefer `mise tasks ls` before first run in a workspace.
- Keep output concise: command + result.
- If command fails, show error and the next minimal recovery step.

## Skill storage (dotfiles + stow)

If skills are stow-managed, edit source in dotfiles and restow:
```bash
cd ~/dotfiles
stow --restow pi-skills
```

## Autoresearch rules

**Eval checklist:**
1. Did the agent trigger this skill only on explicit mise/task intent?
2. On reinstall/install requests, did it execute a concrete task before narration?
3. Were commands sourced from `mise tasks ls` (no invented tasks)?
4. Were task args passed after `--` correctly?

**Test inputs:**
- "use air setup for reinstall immediately, use mise to setup deps"
- "continue" (while active mise task request context exists)
- "mise run copy-logs -- --since 1h"

**Can change:** trigger guards, execution order, error handling, argument formatting
**Cannot change:** use `mise` as executor, `mise tasks ls` for discovery, `mise run` for task execution
**Min sessions before eval:** 5
**Runs per experiment:** 3

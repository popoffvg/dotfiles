---
name: mise
description: This skill should be used when the user mentions "mise", "mise run", "mise task", "copy-logs", "dump-db", "repos", "open repo", "add repo to workspace", or wants to search/open repositories.
---

# Mise tasks

Run mise tasks defined in `mise-tasks/` directory of the current project workspace.

## Usage

Parse the user's input to determine the action:

### List tasks (`/mise` or `/mise list`)

```bash
mise tasks ls
```

### Run a task (`/mise <task> [args]`)

```bash
mise run <task> [-- args]
```

Flags go after `--`:
```bash
mise run dump-db -- -n my-namespace -o /tmp/mydb
```

### Task info (`/mise info <task>`)

Read the task file to show `#MISE` and `#USAGE` header lines:
```bash
head -10 mise-tasks/<task>
```

### Search repos (`/mise repos [query]`)

Search git repositories in the workspace:
```bash
mise run repos -- <query>
```

Without a query, lists all repos. With a query, filters by substring match on directory name.

After showing results, ask the user which repo to open and how:
1. **Add to current workspace** — `surf --add <repo_path>`
2. **Open in new window** — `surf -n <repo_path>`

Example flow:
```
> /mise repos auth

  auth-service      /path/to/workspace/auth-service
  auth-gateway      /path/to/workspace/auth-gateway

Which repo to open? → auth-service
How? → Add to current workspace

$ surf --add /path/to/workspace/auth-service
```

Use AskUserQuestion to let the user pick the repo and the open mode.

## Notes

- The `repos` task script lives at `~/.pi/agent/skills/mise/repos-task`, with a wrapper in each project's `mise-tasks/repos`
- It uses `$CLAUDE_PROJECT_DIR` (from `.mise.toml`) or `pwd` as workspace root
- `surf` is the Windsurf CLI (install location varies — check `which surf` or use `code` / `cursor` as fallback)
- Task config is in `.mise.toml` at workspace root: `[task_config] dir = "mise-tasks"`

## Skill Storage with Dotfiles + Stow

Pi skills should be stored in a dotfiles repository and symlinked via GNU Stow. This keeps skills version-controlled and portable across machines.

**Layout inside dotfiles repo:**
```
dotfiles/
  pi-skills/
    .pi/
      agent/
        skills/
          <skill-name>/
            SKILL.md
```

**Install/update a skill:**
```bash
cd ~/dotfiles
stow pi-skills   # symlinks .pi/agent/skills/<skill-name> into ~/.pi/agent/skills/
```

**Restow after adding new skill files:**
```bash
stow --restow pi-skills
```

- Skills live at `~/.pi/agent/skills/<name>/SKILL.md` (symlinks or real files)
- Do **not** edit skills directly inside `~/.pi/agent/skills/` if they are managed by stow; edit the source in `~/dotfiles/` instead

## Autoresearch rules

**Eval checklist:**
1. Did the agent correctly parse the user's intent (list vs run a specific task)?
2. Was `mise tasks ls` used before attempting to run an unknown task?
3. Did task arguments get passed correctly after `--` separator?
4. Were zero mise tasks run that don't exist in the workspace?

**Test inputs:**
- "mise" (should list tasks)
- "mise run copy-logs -- --since 1h"
- "mise task-create feat/new-feature"

**Can change:** input parsing logic, task discovery steps, error messages, argument formatting
**Cannot change:** mise CLI as the tool, `mise tasks ls` for discovery, `mise run` for execution
**Min sessions before eval:** 5
**Runs per experiment:** 3

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
> /mise repos pl

  pl                /path/to/workspace/pl
  platforma         /path/to/workspace/platforma
  platforma-helm    /path/to/workspace/platforma-helm

Which repo to open? → pl
How? → Add to current workspace

$ surf --add /path/to/workspace/pl
```

Use AskUserQuestion to let the user pick the repo and the open mode.

## Notes

- The `repos` task script lives at `~/.claude/skills/mise/repos-task`, with a wrapper in each project's `mise-tasks/repos`
- It uses `$CLAUDE_PROJECT_DIR` (from `.mise.toml`) or `pwd` as workspace root
- `surf` is the Windsurf CLI (install location varies — check `which surf` or use `code` / `cursor` as fallback)
- Task config is in `.mise.toml` at workspace root: `[task_config] dir = "mise-tasks"`

---
name: work-install
description: >
  This skill should be used when the user says "work install", "install work manager",
  "setup work manager", "configure work manager", "work setup", "set up mise tasks",
  "install mise tasks". Guides through full work-manager setup: plugin installation,
  mise tasks, QMD, and environment configuration.
---

# work:install

Interactive guided installation for the work-manager plugin and its optional components.

## Step 1: Greet and explain scope

Tell the user:

```
## Work Manager Installation

I'll walk you through setting up the work-manager plugin step by step.

**Components:**
1. **Plugin** (required) — Claude Code plugin with skills, agents, and hooks
2. **QMD MCP** (recommended) — semantic search for recalling work context across directories
3. **Mise tasks** (optional) — interactive CLI for creating/managing task workspaces with git worktrees
4. **Worktrunk** (required for mise tasks) — git worktree management CLI (`wt`)
5. **fzf** (required for mise tasks) — fuzzy finder for interactive selection

I'll check each component and guide you through what's missing.
```

## Step 2: Check plugin installation

Run `claude plugin list 2>/dev/null | grep work-manager || echo "NOT_INSTALLED"`.

**If installed:** Report version and skip to Step 3.

**If not installed:** Ask the user which installation method they prefer:

```
The work-manager plugin is not installed. Choose installation method:

1. **CLI** (if you have the plugin repo cloned):
   ```bash
   claude plugin add /path/to/work-manager
   ```

2. **From GitHub**:
   ```bash
   claude plugin install popoffvg/claude-plugin-work-manager
   ```

Which method? Or provide the path to an existing clone.
```

Wait for the user's choice. Run the appropriate command. Verify it succeeded.

**After installation**, remind the user to add the plugin read permission to their Claude settings (`~/.claude/settings.json`) in the `permissions.allow` array:

```json
"Read(~/.claude/plugins/**)"
```

This allows the plugin's agents and skills to read their own files.

## Step 3: Check and create settings file

Check if `~/.claude/work-manager.local.md` exists. Read it if it does.

**If missing or incomplete**, create it:

```yaml
---
qmd_collection: ctx
---
```

Tell the user:
```
Created ~/.claude/work-manager.local.md with default QMD collection "ctx".
You can change `qmd_collection` later to match your QMD setup.
```

## Step 4: Check QMD MCP

Check if QMD MCP is configured:
1. Read `~/.claude/settings.json` and look for `qmd` in `mcpServers`
2. Also check if the project `.mcp.json` has QMD configured

**If QMD is configured:** Run `mcp__qmd__status` to verify it's working. Report status.

**If QMD is not configured:**

```
## QMD MCP (recommended)

QMD provides semantic search over markdown documents — the plugin uses it to recall
work context when you resume in a different directory.

**Without QMD:** The plugin still works but `/work recall` can only find notes in the
current directory. Cross-session context recovery won't work.

**To install QMD:**

1. Install the QMD binary:
   ```bash
   # macOS
   brew install nicobailey/tap/qmd

   # Or from source
   cargo install qmd
   ```

2. Add to your Claude Code settings (`~/.claude/settings.json`):
   ```json
   {
     "mcpServers": {
       "qmd": {
         "type": "stdio",
         "command": "qmd",
         "args": ["mcp", "--collection", "ctx", "--root", "~/ctx"]
       }
     }
   }
   ```

3. Add QMD tools to allowed permissions in `~/.claude/settings.json`:
   ```json
   {
     "permissions": {
       "allow": [
         "mcp__qmd__search",
         "mcp__qmd__vector_search",
         "mcp__qmd__deep_search",
         "mcp__qmd__get",
         "mcp__qmd__multi_get",
         "mcp__qmd__status"
       ]
     }
   }
   ```

4. Create the context directory:
   ```bash
   mkdir -p ~/ctx/insights
   ```

5. Restart Claude Code to load the new MCP server.

Would you like me to help configure QMD now, or skip for later?
```

If the user wants help, guide them through each substep interactively.

## Step 5: Check mise and task scripts

Check if mise is installed: `which mise`.

**If mise is not installed:**

```
## Mise Tasks (optional)

Mise is a polyglot task runner. The work-manager plugin works without it, but mise tasks
provide an interactive CLI for managing task workspaces with git worktrees.

**Without mise:** You manage branches and directories manually. `/work start` still creates
`_notes/` and tracks work — you just don't get the worktree isolation.

**To install mise:**
```bash
# macOS
brew install mise

# Or via installer
curl https://mise.run | sh
```

After installing, activate mise in your shell:
```bash
# bash
echo 'eval "$(mise activate bash)"' >> ~/.bashrc

# zsh
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc

# fish
echo 'mise activate fish | source' >> ~/.config/fish/config.fish
```

Restart your shell after activation.
```

Wait for confirmation, then proceed.

**If mise is installed:** Report version and continue.

## Step 6: Check worktrunk

Worktrunk (`wt`) manages git worktrees — the mise task scripts depend on it for creating and removing worktrees.

Check: `wt --version 2>/dev/null`.

**If not installed:**

```
## Worktrunk (required for mise tasks)

Worktrunk (`wt`) is a git worktree management CLI. The task scripts use it to create
isolated working trees per task.

**Install:**
```bash
# macOS
brew install max-sixty/tap/worktrunk

# Or from cargo
cargo install worktrunk
```

**After installing**, set up shell integration:
```bash
wt config shell install
```

This enables `wt switch` to change directories automatically.

**Optional**: create a user config for custom worktree locations:
```bash
wt config create
```

Docs: https://worktrunk.dev
```

**If installed:** Report version, check if shell integration is set up (`wt config shell install` status).

## Step 7: Copy mise task scripts

Ask the user for the target workspace directory:

```
## Mise Task Scripts

The work-manager plugin includes task management scripts for mise:
- **task** — create/list/open/remove task workspaces (interactive fzf menu)
- **task-list** — list and manage existing task workspaces
- **task-remove** — remove a task (detach worktrees + delete folder)
- **task-append** — add repos to an existing task workspace

Where is your workspace root? This is the directory that contains your git repos.
Example: ~/Documents/git/mil

I'll create a `mise-tasks/` directory there with the task scripts.
```

Wait for the user to provide the path. Then:

1. Verify the directory exists
2. Check if `mise-tasks/` already exists — if so, warn about overwrite
3. Create `mise-tasks/` directory
4. Copy all 4 task scripts from `${CLAUDE_PLUGIN_ROOT}/assets/mise-tasks/` to the target
5. Make them executable: `chmod +x mise-tasks/task*`

After copying, report:
```
Copied task scripts to <path>/mise-tasks/:
  task        — main task management (create/list/open/remove)
  task-list   — list and manage tasks
  task-remove — remove a task workspace
  task-append — add repos to existing task
```

## Step 8: Configure .mise.toml

Check if `.mise.toml` exists in the workspace root.

**If it exists:** Read it and check for required env vars and `task_config`.

**If missing or incomplete:** Guide the user through creating/updating it:

```
## .mise.toml Configuration

Your `.mise.toml` needs these settings for task scripts to work:

```toml
[env]
# Required for task scripts
MIL_WORKSPACE_ROOT = "{{config_root}}"
MIL_TASKS_ROOT = "{{config_root}}/tasks"
MIL_REPO_ROOTS = "{{config_root}}"
# Add comma-separated paths if repos live in multiple directories:
# MIL_REPO_ROOTS = "{{config_root}},{{config_root}}/_blocks"

[task_config]
dir = "mise-tasks"
```

**Required env vars:**
| Variable | Purpose | Example |
|----------|---------|---------|
| `MIL_WORKSPACE_ROOT` | Root directory containing all repos | `{{config_root}}` |
| `MIL_TASKS_ROOT` | Where task worktree folders are created | `{{config_root}}/tasks` |
| `MIL_REPO_ROOTS` | Comma-separated dirs to scan for git repos | `{{config_root}}` |

**`[task_config]`:**
| Setting | Purpose | Value |
|---------|---------|-------|
| `dir` | Directory with task scripts | `mise-tasks` |

Shall I add these settings to your `.mise.toml`?
```

If the user agrees, add/update the settings. Don't overwrite existing env vars.

## Step 9: Check fzf dependency

Task scripts use fzf for interactive selection. Check: `which fzf`.

**If not installed:**

```
## fzf (required for mise tasks)

Task scripts use fzf for interactive repo/task selection.

```bash
# macOS
brew install fzf

# Or from source
git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf && ~/.fzf/install
```
```

## Step 10: Create tasks directory

Create the `tasks/` directory in the workspace root if it doesn't exist:
```bash
mkdir -p <workspace_root>/tasks
```

## Step 11: Verify and summarize

Run verification checks:
1. `mise task ls 2>/dev/null | grep task` — confirm mise sees the task scripts
2. Check `_notes/` can be created in a test location (don't actually create)
3. QMD status if configured

Print a summary:

```
## Installation Complete

| Component | Status |
|-----------|--------|
| Plugin | installed (v0.2.0) |
| Settings file | ~/.claude/work-manager.local.md |
| QMD MCP | configured / not configured (optional) |
| Mise | installed (vX.Y.Z) / not installed (optional) |
| Worktrunk | installed / not installed (required for mise tasks) |
| Task scripts | copied to <path>/mise-tasks/ / skipped |
| .mise.toml | configured / needs manual setup |
| fzf | installed / not installed (required for mise tasks) |
| tasks/ dir | created at <path>/tasks/ |

**Quick start:**
1. `cd <workspace_root>`
2. `mise run task` — create a task workspace (or manage branches manually)
3. Open the task folder, then `/work start` to begin tracking
4. `/work help` for all commands
```

## MANDATORY: Update Notes

**After completing ANY action in this skill, you MUST update `_notes/worklog.md`** with a timestamped entry describing what was done. Format:
```
- YYYY-MM-DD HH:MM: <action summary>
```

Never skip this step. Notes are the primary deliverable, not a side-effect.

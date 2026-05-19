# memory-keeper

Persistent knowledge management plugin for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Automatically extracts insights from sessions, injects relevant context on startup, and provides search/save commands for cross-session memory.

## Features

- **Auto-capture**: Session end hook classifies conversation into insights, tasks, or behavior corrections and saves them automatically
- **Context injection**: Session start hook loads project-specific knowledge based on your working directory
- **Dual search**: Keyword-first, then semantic search across your knowledge base (via QMD)
- **Web research**: Falls back to web search when local memory is insufficient, then persists findings

## Setup

### 1. Install the plugin

```bash
claude plugin install popoffvg/claude-plugin-memory-keeper
```

### 2. Create the settings file

Create `~/.claude/memory-keeper.local.md` with your configuration:

```yaml
---
insights_root: ~/my/insights/path
log_level: DEBUG
---
```

**This file is required.** The plugin will not function without it — hooks will skip and skills will prompt you to create it.

### 3. Create the insights directory

```bash
mkdir -p ~/my/insights/path
```

### 4. Verify

Start a new Claude Code session. The SessionStart hook should load without errors. Run `/context find` — it should read your insights root.

| Setting | Required | Description |
|---------|----------|-------------|
| `insights_root` | **Yes** | Root directory for all saved knowledge (e.g. `~/ctx/insights`) |
| `log_level` | No | Logging verbosity for SessionStart hook (`DEBUG`, `INFO`, `WARN`). Default: `DEBUG` |

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [QMD MCP server](https://github.com/nicobailey/qmd) — local search engine over markdown documents
- (Optional) [Firecrawl MCP](https://github.com/mendableai/firecrawl) — for web research fallback

## Commands

| Command | Description |
|---------|-------------|
| `/context find <query>` | Search saved knowledge by keyword or topic |
| `/context find` | Show full knowledge index |
| `/context save <note>` | Persist a specific insight or fact |
| `/context check` | Analyze current session for insights worth saving |
| `/context research <topic>` | Search memory + web, then persist results |
| `/context scan [timeframe]` | Scan recent session logs for missed insights (fallback for failed Stop hooks) |
| `/context done [task-name]` | Complete active task — summarize insights and distribute to repo folders |

## Hourly Scan (Cron)

To enable automatic scanning for missed insights during a session, run:

```
/context scan cron
```

This sets up a session-scoped hourly cron that runs `/context scan` automatically. The cron lives only in the current Claude session and auto-expires after 3 days.

## How It Works

### Session Start
1. Reads `insights_root` from `~/.claude/memory-keeper.local.md`
2. If not configured — skips silently
3. Matches current directory to a project in `<insights_root>/`
4. Loads `_summary.md` (or `INDEX.md` fallback) into session context

### Project Detection
Project name is derived from the **git repo name** (`git rev-parse --show-toplevel | basename`), falling back to the working directory basename.

### Session End
1. Reads `insights_root` from settings — skips if not configured
2. Detects project from git repo name (fallback: cwd basename)
3. Checks for an active task in `_tasks/pending.md`
4. Agent analyzes the conversation and classifies it: `insight` | `task` | `agent_edit` | `none`
5. Saves to the appropriate location:
   - **Insights (with active task)** -> `<insights_root>/_tasks/<task-slug>/notes.md` (tagged with repo name)
   - **Insights (no active task)** -> `<insights_root>/<project>/insights.md`
   - **Tasks** -> `<insights_root>/_tasks/pending.md` + creates `_tasks/<task-slug>/` directory
   - **Agent edits** -> `<insights_root>/claude-config/behavior.md`

### Task Completion (`/context done`)
1. Reads task insights from `_tasks/<task-slug>/notes.md`
2. Generates a concise summary
3. Distributes summary to each repo's `<insights_root>/<repo>/insights.md`
4. Marks task as `done` in `pending.md`

### Knowledge Search
1. `mcp__qmd__search` (keyword) on `ctx` collection
2. `mcp__qmd__deep_search` (semantic) if results are sparse
3. Fallback to `z-core` collection (Obsidian vault)

## Knowledge Structure

```
<insights_root>/
  INDEX.md              # Global knowledge index
  <project>/            # project = git repo name or folder name
    _summary.md         # Project summary (loaded on session start)
    insights.md         # Auto-captured insights + task summaries
  _tasks/
    pending.md          # Task list (status: active | done)
    <task-slug>/        # Per-task directory
      notes.md          # Insights collected during task (tagged with repo names)
  claude-config/
    behavior.md         # Agent behavior corrections
```

## License

MIT

# Dotfiles

Personal dotfiles repo managed with **GNU Stow** + **Ansible**. The repo root mirrors `~/` — stow symlinks everything into place.

## Structure

```
.
├── harness/plugins/     # Claude Code plugins (TypeScript)
├── .claude/             # Claude Code settings, agents, skills
├── .config/             # App configs: nvim, helix, zellij, git, ghostty, atuin, direnv, nix
├── raycast/             # Raycast extensions (space-manager)
├── hammerspoon/         # macOS automation (Lua)
├── scripts/             # git-agent-review, setup helpers
├── .ansible/            # Package installation playbook
├── alacritty/           # Alacritty terminal config
├── nushell/             # Nushell config
├── tmux/                # Tmux config fragments
├── vscode/              # VS Code settings
└── .zshrc, .zshrc_*     # Modular zsh config (aliases, git, go, mise, etc.)
```

## Key Subsystems

### Plugins (`harness/plugins/`)

Claude Code plugins. Each plugin root is `<name>/claude/` with agents, skills, commands, hooks, and MCP config; shared TypeScript/skills live in `<name>/common/`.

| Plugin | Claude | Purpose |
|---|---|---|
| **memory-keeper** | agents, skills, hooks, MCP (SSE) | Long-lived daemon (port 7420): SQLite queue, async insight extraction |
| **work-manager** (`wm`) | agents (5), commands, hooks, statusline | Work phase management: research → spec → implement → verify → done |
| **self-improvement** | skill, Stop hook | Captures behavioral rules from corrections into CLAUDE.local.md |
| **common** | shared rules, language/tooling skills, prompt & model utilities | Shared plugin pool |

### Skills (`skills/`)

Each skill: `<name>/SKILL.md` with YAML frontmatter + markdown instructions. Some include `references/` docs or helper scripts.

**Categories:** work phases (8), context management (6), Go tooling (5), shell/code (4), productivity (7), devops (2).

### Memory-Keeper Daemon

Runs on `localhost:7420`. Owns SQLite DB, queue drain loop, stats, pino logger.

- Claude Code connects via SSE (`type: sse` in mcp.json)
- REST API for enqueue/stats (`/api/enqueue`, `/api/stats`, `/api/health-banner`)
- LLM classification via OpenRouter/Gemma
- Auto-starts from `ensure-daemon.sh` SessionStart hook

### WM Flow

`/work:start` → research → spec → implement (worktree) → verify → `/work:done`

State tracked in `work.settings.json`. Notes in `.notes/` (worklog, plan, research).

## Local Plugin Development (Claude Code)

### Plugin cache

Claude Code copies marketplace plugins to `~/.claude/plugins/cache/`. **Path traversal (`../`) is blocked** — files outside the plugin root are not copied. Symlinks within the plugin directory are **not followed** during caching.

**Edits to `~/.claude/plugins/cache/` are wiped on next stow.** Always edit the dotfiles source at `~/Documents/git/dotfiles/harness/plugins/<name>/` and re-stow.

**Workaround for shared code** (e.g., `common/` referenced by `claude/`):
1. Place shared code in `common/` at plugin root level
2. Create a symlink inside the claude dir: `claude/common → ../common` (relative)
3. Reference via `${CLAUDE_PLUGIN_ROOT}/common/...` (not `../common/...`)
4. After any source change, sync cache: `cp -r <source>/common <cache>/common`

**To bypass cache entirely** during development:
```bash
claude --plugin-dir ~/.claude/plugins/local-plugins/wm
```

### MCP tool naming

Plugin MCP tools are namespaced as `mcp__plugin_<plugin-name>_<server-name>__<tool>`. Example:
- Server `"work"` in plugin `"wm"` → `mcp__plugin_wm_work__work_state`
- Use these full names in agent `tools:` frontmatter

### Plugin structure

```
harness/plugins/<name>/
├── common/           # Shared: skills, server, FSM, types
│   ├── skills/       # SKILL.md files (source of truth)
│   ├── server/       # MCP server (stdio)
│   └── *.ts          # Shared logic
└── claude/           # Claude Code plugin root (= CLAUDE_PLUGIN_ROOT)
    ├── .claude-plugin/plugin.json
    ├── .mcp.json
    ├── agents/
    ├── hooks/
    ├── commands/
    └── skills → ../common/skills   # symlink
```

## Dev Conventions

- **TypeScript** for plugins — `tsx` runtime, no `tsc` build step
- **Stow-compatible paths** — repo structure mirrors `~/`. **Never create config files directly in `~/`** — always place them in the repo at the matching path (e.g., `.config/worktrunk/config.toml`) and run `stow -t ~ .` to symlink. If a broken symlink or real file already exists at the target, remove it first before stowing.
- **Atomic changes** — one logical change per commit, codebase always valid
- **Plugin entry** — `claude/.claude-plugin/plugin.json` manifest
- **Skill entry** — `SKILL.md` with `name:`, `description:` frontmatter

## Install

```sh
ansible-playbook .ansible/install_packages.yaml
mkdir -p ~/.claude/skills
stow -t ~ .
```

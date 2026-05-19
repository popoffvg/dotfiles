# Dotfiles

Personal dotfiles repo managed with **GNU Stow** + **Ansible**. The repo root mirrors `~/` — stow symlinks everything into place.

## Structure

```
.
├── harness/plugins/     # 16 Pi agent plugins (TypeScript)
├── .claude/             # Claude Code settings, agents, skills
├── .pi/                 # Pi agent settings, extension load order
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

Each plugin targets **Pi**, **Claude Code**, or both. Pi side: `<name>/pi/index.ts` exporting `default(pi: ExtensionAPI)`. Claude side: `<name>/claude/` with agents, skills, commands, hooks, and MCP config.

| Plugin | Pi | Claude | Purpose |
|---|---|---|---|
| **memory-keeper** | commands, cron, renderers | agents, skills, hooks, MCP (SSE) | Long-lived daemon (port 7420): SQLite queue, async insight extraction |
| **work-manager** | — | agents (4), commands, hooks, statusline | Work phase management: plan → research → implement → verify → done |
| **work** | commands, state, phase transitions | — | Work phase state machine, Pi-side commands |
| **skill-manager** | skill loading, overrides | — | Skill usage tracking |
| **smart-commit** | commit generation | — | Intelligent commit messages |
| **plugin-workflow** | lifecycle coordination | — | Plugin lifecycle events |
| **compact-startup** | startup banner | — | Shows loaded resources on session start |
| **rtk** | proxy routing | — | Token-optimized CLI proxy |
| **repo-context** | context injection | — | Repository context for prompts |
| **prompt-rewriter** | prompt transformation | — | Rewrites prompts before execution |

### Skills (`skills/`)

Each skill: `<name>/SKILL.md` with YAML frontmatter + markdown instructions. Some include `references/` docs or helper scripts.

**Categories:** work phases (8), context management (6), Go tooling (5), shell/code (4), productivity (7), devops (2).

### Memory-Keeper Daemon

Runs on `localhost:7420`. Owns SQLite DB, queue drain loop, stats, pino logger.

- Claude Code connects via SSE (`type: sse` in mcp.json)
- Pi connects via HTTP REST (`/api/enqueue`, `/api/stats`, `/api/health-banner`)
- LLM classification via Pi CLI (`pi -p --mode json`) + OpenRouter/Gemma
- Auto-starts from Pi extension or `ensure-daemon.sh` SessionStart hook

### Work Manager Flow

`/work:start` → research → plan → implement (worktree) → verify → `/work:done`

State tracked in `.pi/work.settings.json`. Notes in `_notes/` (worklog, plan, research).

## Local Plugin Development (Claude Code)

### Plugin cache

Claude Code copies marketplace plugins to `~/.claude/plugins/cache/`. **Path traversal (`../`) is blocked** — files outside the plugin root are not copied. Symlinks within the plugin directory are **not followed** during caching.

**Edits to `~/.claude/plugins/cache/` are wiped on next stow.** Always edit the dotfiles source at `~/Documents/git/dotfiles/harness/plugins/<name>/` and re-stow.

**Workaround for shared code** (e.g., `common/` used by both `claude/` and `pi/`):
1. Place shared code in `common/` at plugin root level
2. Create a symlink inside the claude dir: `claude/common → ../common` (relative)
3. Reference via `${CLAUDE_PLUGIN_ROOT}/common/...` (not `../common/...`)
4. After any source change, sync cache: `cp -r <source>/common <cache>/common`

**To bypass cache entirely** during development:
```bash
claude --plugin-dir ~/.claude/plugins/local-plugins/work-manager
```

### MCP tool naming

Plugin MCP tools are namespaced as `mcp__plugin_<plugin-name>_<server-name>__<tool>`. Example:
- Server `"work"` in plugin `"work-manager"` → `mcp__plugin_work-manager_work__work_state`
- Use these full names in agent `tools:` frontmatter

### Plugin structure (dual-agent: Pi + Claude)

```
harness/plugins/<name>/
├── common/           # Shared: skills, server, FSM, types
│   ├── skills/       # SKILL.md files (source of truth)
│   ├── server/       # MCP server (stdio)
│   └── *.ts          # Shared logic
├── claude/           # Claude Code plugin root (= CLAUDE_PLUGIN_ROOT)
│   ├── .claude-plugin/plugin.json
│   ├── .mcp.json
│   ├── agents/
│   ├── hooks/
│   ├── commands/
│   └── skills → ../common/skills   # symlink
└── pi/               # Pi agent extension
    └── index.ts
```

Skill-manager syncs `common/skills/` to `~/.pi/agent/skills/` on session start via `sources.json` (`symlinkBack: true` replaces originals with symlinks to global store).

## Dev Conventions

- **TypeScript** for plugins — `tsx` runtime, no `tsc` build step
- **Stow-compatible paths** — repo structure mirrors `~/`. **Never create config files directly in `~/`** — always place them in the repo at the matching path (e.g., `.config/worktrunk/config.toml`) and run `stow -t ~ .` to symlink. If a broken symlink or real file already exists at the target, remove it first before stowing.
- **Atomic changes** — one logical change per commit, codebase always valid
- **Plugin entry** — `export default function(pi: ExtensionAPI) { ... }`
- **Skill entry** — `SKILL.md` with `name:`, `description:` frontmatter

## Install

```sh
ansible-playbook .ansible/install_packages.yaml
mkdir -p ~/.claude/skills ~/.pi/agent/skills
stow -t ~ .
```

## Dependencies

ansible, stow, fzf, bat, delta, mise, lefthook

## Work Manager Plugin

This repository uses the work-manager plugin for phased execution.

- Start or resume with /work:start and /work:status
- Follow the active phase from .pi/work.settings.json
- In implement phase: complete one TODO at a time
- Keep planning artifacts in _notes/ (plan.md, worklog.md, impl-learnings.md)

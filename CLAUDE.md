# Dotfiles

Personal dotfiles repo managed with **GNU Stow** + **Ansible**. The repo root mirrors `~/` — stow symlinks everything into place.

## Structure

```
.
├── harness/plugins/     # 16 Pi agent plugins (TypeScript)
├── skills/              # 39 Claude Code / Pi skills (Markdown)
├── .claude/             # Claude Code settings, agents
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
| **atom** | subtask execution | — | Atomic subtask with `TASK.md` and `_notes/` tracking |
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

## Dev Conventions

- **TypeScript** for plugins — `tsx` runtime, no `tsc` build step
- **Stow-compatible paths** — repo structure mirrors `~/`
- **Atomic changes** — one logical change per commit, codebase always valid
- **Plugin entry** — `export default function(pi: ExtensionAPI) { ... }`
- **Skill entry** — `SKILL.md` with `name:`, `description:` frontmatter

## Install

```sh
ansible-playbook .ansible/install_packages.yaml
stow -t ~ .
```

## Dependencies

ansible, stow, fzf, bat, delta, mise, lefthook

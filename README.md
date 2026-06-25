# dotfiles

Personal dotfiles. Managed with **GNU Stow** + **mise**. Repo layout mirrors `~/` — stow symlinks files into place.

## Structure

```
.
├── .config/             # XDG configs: nvim, helix, fish, git, zellij, ghostty, atuin, direnv, nix, sketchybar, worktrunk
├── .claude/             # Claude Code project-local overrides (settings.local.json)
├── .zshrc, .zshrc_*     # Modular zsh config (aliases, git, go, mise, fish, ...)
├── .tmux.conf
├── .wezterm.lua
├── .aerospace.toml
├── .mise.toml           # mise tasks (incl. unified `stow`)
├── .mcp.json            # global MCP server config
├── .stow-local-ignore   # exclusions for repo-root stow package
│
├── harness/             # Per-harness packages (separate stow targets)
│   ├── claude/          # → ~/.claude   (settings.json, hooks, agents, commands, scripts, skills, CLAUDE.md, RTK.md, agent-settings)
│   ├── plugins/         # Plugin source dirs (wm, self-improvement); NOT stowed directly
│   └── scripts/         # sync-marketplace.sh — regenerates /.claude-plugin/marketplace.json + /plugins/ symlinks
│
├── ansible/             # Package installation playbook (run in-place)
├── scripts/             # Misc shell scripts (not stowed)
├── hammerspoon/         # macOS automation Lua
├── raycast/             # Raycast extensions
├── alacritty/, vscode/  # legacy app configs
└── .notes/              # WM notes (gitignored runtime)
```

### Stow targets

| Source | Target | Contents |
|---|---|---|
| repo root | `~` | shell, .config/*, .tmux.conf, etc. (gated by `.stow-local-ignore`) |
| `harness/claude` | `~/.claude` | Claude Code user config + plugin marketplace |

## Install

Prerequisites: **nix**, **mise**, **stow**, **ansible**.

```sh
# 1. Nix-darwin (Mac system packages)
nix run nix-darwin -- switch --flake .config/nix-darwin

# 2. Other packages via ansible
ansible-playbook ansible/install_packages.yaml

# 3. Symlink everything into ~ (repo root + harness/claude)
mise run stow
```

To remove all symlinks:

```sh
mise run unstow
```

## Adding a Claude Code plugin

Plugins live in `harness/plugins/<name>/claude/`. The `sync-marketplace.sh` step (run automatically by `mise run stow`) generates the marketplace entries in `/.claude-plugin/marketplace.json` and per-plugin symlinks in `/plugins/`. The marketplace is registered at `$HOME/git/dotfiles` (repo root) in `harness/claude/settings.json`.

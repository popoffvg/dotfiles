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

## Claude Code plugins

Two registries, both in `harness/claude/settings.json` (stowed to `~/.claude/settings.json`):

- **`extraKnownMarketplaces`** — where plugins come from. This repo's own plugins ship via the `local-plugins` directory marketplace (`source.path` = repo root, so Claude reads `/.claude-plugin/marketplace.json` directly). External plugins point at GitHub repos.
- **`enabledPlugins`** — which plugins are on. Each entry is `"<name>@<marketplace>": true|false`.

### Install a plugin

```jsonc
// harness/claude/settings.json
"extraKnownMarketplaces": {
  "ponytail": { "source": { "source": "github", "repo": "DietrichGebert/ponytail" } }
},
"enabledPlugins": {
  "ponytail@ponytail": true,        // external plugin
  "wm@local-plugins": true          // local plugin from this repo
}
```

Then `mise run stow` (to symlink the edited settings) and `/reload-plugins` in Claude Code — or do both steps interactively with `/plugin`. After enabling, the first launch caches the plugin under `~/.claude/plugins/cache/`.

> Local plugins are **disabled by default** in committed settings (`wm@local-plugins: false`) — flip to `true` to turn one on.

### Author a local plugin (in this repo)

Each plugin directory under `harness/plugins/<name>/` **is** the plugin root — markdown only (agents, commands, hooks, skills), no `claude/` wrapper, no build step. `harness/scripts/sync-marketplace.sh` (run via `mise run harness:plugins:sync`) regenerates `/.claude-plugin/marketplace.json` with one entry per plugin, `source: ./harness/plugins/<name>` pointing **directly** at the dir — no symlink layer. Edit the source, re-sync, then `/reload-plugins`.

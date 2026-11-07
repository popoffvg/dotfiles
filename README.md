# dotfiles

Personal dotfiles. Managed with **GNU Stow**, **mise**, and **Rulesync**. Stow links ordinary dotfiles; Rulesync installs the Claude, Codex, and Pi harness.

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
├── harness/             # Harness authoring sources
│   ├── claude/          # Native personal definitions and helper scripts
│   ├── plugins/         # Plugin source dirs (wm, self-improvement); NOT stowed directly
│   ├── rulesync/        # Pinned generator, deployer, ownership guards and maintenance skill
│   └── scripts/         # Deployment compatibility entry points
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
| `harness/` through Rulesync | `~/.claude`, `~/.codex`, `~/.pi/agent` | Generated harness files; no Stow links into source |

## Install

Prerequisites: **nix**, **mise**, **stow**, **ansible**.

```sh
# 1. Nix-darwin (Mac system packages)
nix run nix-darwin -- switch --flake .config/nix-darwin

# 2. Other packages via ansible
ansible-playbook ansible/install_packages.yaml

# 3. Link dotfiles and install the harness
mise run stow
```

To remove all symlinks:

```sh
mise run unstow
```

## Claude Code plugins

Two registries are authored in `harness/claude/settings.json` and deployed to `~/.claude/settings.json`:

- **`extraKnownMarketplaces`** — where plugins come from. This repo's own plugins ship via the `local-plugins` directory marketplace under `~/.claude/harness/`; deployment sets the installed path. External plugins point at GitHub repos.
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

Then `mise run harness:sync` (to deploy the edited sources) and `/reload-plugins` in Claude Code — or do both steps interactively with `/plugin`. After enabling, the first launch caches the plugin under `~/.claude/plugins/cache/`.

Load `harness-maintain` before changing installed skills or plugin components.

### Author a local plugin (in this repo)

Each `harness/plugins/<name>/` directory is an editable, self-contained native plugin source.
`mise run harness:sync` imports it with Rulesync and installs generated components, scripts,
and assets under the home harness directories. Manifest versioning and subcommand generation
remain repository tasks. Refresh Claude plugins after deploying a new version.

See [the deployment contract](harness/rulesync/README.md) for ownership, target paths,
verification, and how to resolve installed edits without overwriting third-party files.

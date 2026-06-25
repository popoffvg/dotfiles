# Dotfiles

Personal dotfiles repo managed with **GNU Stow** + **Ansible**. The repo root mirrors `~/` — stow symlinks everything into place.

## Structure

```
.
├── .claude-plugin/      # marketplace.json — repo-root plugin marketplace
├── harness/plugins/     # Claude Code plugin sources (markdown only)
├── harness/claude/      # → ~/.claude  (settings, hooks, commands, skills, scripts)
├── harness/scripts/     # sync-marketplace.sh, bump-plugin-version.sh
├── .claude/             # project-local Claude config + project skills (laptop-setup)
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

Each plugin directory **is** the plugin root (= `CLAUDE_PLUGIN_ROOT`) — no `claude/` wrapper, no shared `common/`, no MCP server, no build step. Plain markdown: agents, commands, hooks, skills.

| Plugin | Contents | Purpose |
|---|---|---|
| **wm** | agents (7), commands (8), hooks, bin | Work phase management: research → spec → implement → verify → done |
| **self-improvement** | skill, Stop hook | Captures behavioral rules from corrections into CLAUDE.local.md |

### Marketplace (`/.claude-plugin/marketplace.json`)

`harness/scripts/sync-marketplace.sh` regenerates `/.claude-plugin/marketplace.json` from the plugin sources — one entry per plugin, `source: ./harness/plugins/<name>` pointing **directly** at the plugin dir (no symlink layer).

Claude Code registers `local-plugins` as a **directory marketplace** pointing at the repo root (`$HOME/git/dotfiles` in `settings.json` `extraKnownMarketplaces`), so it reads `.claude-plugin/marketplace.json` straight from the repo — no stow step needed for the marketplace.

### Skills

- **Loose `~/.claude` skills** live in `harness/claude/skills/<name>/SKILL.md` (stowed to `~/.claude/skills`).
- **Plugin skills** live in `harness/plugins/<name>/skills/`.
- **Project skills** (repo-scoped) live in `.claude/skills/` — e.g. `laptop-setup`.

Each skill: `SKILL.md` with `name:` + `description:` frontmatter; optional `references/` docs or helper scripts.

### WM Flow

`/work:start` → research → spec → implement (worktree) → verify → `/work:done`

State tracked in `work.settings.json`. Notes in `.notes/` (worklog, plan, research).

## Local Plugin Development (Claude Code)

### Plugin cache

Claude Code copies marketplace plugins to `~/.claude/plugins/cache/`. **Path traversal (`../`) is blocked** and symlinks are **not followed** during caching — that's why plugin sources are self-contained markdown under `harness/plugins/<name>/`.

Always edit the source at `harness/plugins/<name>/`, then re-sync (`mise run harness:plugins:sync`) and reinstall/refresh the marketplace in Claude Code.

**To bypass cache entirely** during development:
```bash
claude --plugin-dir ~/git/dotfiles/harness/plugins/wm
```

### Version bump (pre-commit)

`lefthook.yml` runs `harness/scripts/bump-plugin-version.sh` on `pre-commit`: any plugin with staged changes gets its `plugin.json` **minor** version bumped (`x.Y.z → x.(Y+1).0`), the marketplace is regenerated, and both are re-staged.

### Plugin structure

```
harness/plugins/<name>/        # = CLAUDE_PLUGIN_ROOT
├── .claude-plugin/plugin.json
├── agents/
├── commands/
├── hooks/
└── skills/
```

## Dev Conventions

- **Markdown-only plugins** — no TypeScript, no build step, no MCP servers
- **Stow-compatible paths** — repo structure mirrors `~/`. **Never create config files directly in `~/`** — always place them in the repo at the matching path and run `stow -t ~ .` to symlink. If a broken symlink or real file already exists at the target, remove it first before stowing.
- **Atomic changes** — one logical change per commit, codebase always valid
- **Plugin entry** — `<name>/.claude-plugin/plugin.json` manifest
- **Skill entry** — `SKILL.md` with `name:`, `description:` frontmatter

## Install

```sh
ansible-playbook .ansible/install_packages.yaml
mkdir -p ~/.claude/skills
mise run stow
```

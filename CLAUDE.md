# Dotfiles

Personal dotfiles repo managed with **GNU Stow** + **Ansible**. The repo root mirrors `~/` — stow symlinks everything into place.

## Key Subsystems

### Plugins (`harness/plugins/`)

Every rule about a plugin — the plugin root, the marketplace, the router/worker split, subcommand rosters, command naming, the plugin cache, the version bump — lives in `harness/plugins/CLAUDE.md`. Read it before you edit anything under that tree.

### Skills

- **Loose `~/.claude` skills** live in `harness/claude/skills/<name>/SKILL.md` (stowed to `~/.claude/skills`).
- **Plugin skills** live in `harness/plugins/<name>/skills/`.
- **Project skills** (repo-scoped) live in `.claude/skills/` — e.g. `laptop-setup`.

Each skill: `SKILL.md` with `name:` + `description:` frontmatter; optional `references/` docs or helper scripts.

When a skill in this repo must cite a skill that exists only as a real directory under `~/.claude/skills/` — not in this repo — move that skill into `harness/claude/skills/` and run `mise run stow` so the relative link resolves; never rewrite the link to an absolute `~/.claude/...` path to route around the stray.

### WM Flow

`/wm:work:help` → research → spec → implement (worktree) → verify → `/wm:work:finish`

State tracked in `work.settings.json`. Notes in `.notes/` — its own jj repo (history via `jj log`), git-ignored in the parent. Also holds plan + research.

## Dev Conventions

- **Markdown-only plugins** — no TypeScript, no build step inside a plugin dir. An MCP server is allowed only as a `.mcp.json` entry naming a binary built from `harness/apps/<name>/`.
- **Stow-compatible paths** — repo structure mirrors `~/`. **Never create config files directly in `~/`** — always place them in the repo at the matching path and run `stow -t ~ .` to symlink. If a broken symlink or real file already exists at the target, remove it first before stowing.
- **Atomic changes** — one logical change per commit, codebase always valid

## Install

```sh
ansible-playbook ansible/install_packages.yaml
mkdir -p ~/.claude/skills
mise run stow
```

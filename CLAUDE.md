# Dotfiles

Personal dotfiles repo managed with **GNU Stow**, **Ansible**, and **Rulesync**. Stow deploys ordinary dotfiles; Rulesync deploys the agent harness.

## Key Subsystems

### Plugins (`harness/plugins/`)

Every rule about a plugin — the plugin root, the marketplace, the router/worker split, subcommand rosters, command naming, the plugin cache, the version bump — lives in `harness/plugins/CLAUDE.md`. Read it before you edit anything under that tree.

### Skills

- **Loose skills** live in `harness/skills/<name>/SKILL.md`. Rulesync installs them for Claude, Codex, and Pi.
- **Plugin skills** live in `harness/plugins/<name>/skills/`.
- **Project skills** (repo-scoped) live in `.claude/skills/` — e.g. `laptop-setup`.
- **Claude settings, agents, commands, and hooks** live in `harness/claude/`. That directory is not the skill library.

Each skill: `SKILL.md` with `name:` + `description:` frontmatter; optional `references/` docs or helper scripts.

When a skill in this repo must cite a skill that exists only as a real directory under `~/.claude/skills/` — not in this repo — move that skill into `harness/skills/` and run `mise run harness:sync` so the installed reference resolves; never rewrite the link to an absolute `~/.claude/...` path to route around the stray.

### WM Flow

`/wm:code:help` lists the pipeline: research → spec → TODO ledger → implement → the review gate chain.

Notes live in `.notes/` — its own jj repo (history via `jj log`), git-ignored in the parent. It holds the spec, the plan, the research, and the ADRs.

## Dev Conventions

- **Markdown-only plugins** — no TypeScript, no build step inside a plugin dir. An MCP server is allowed only as a `.mcp.json` entry naming a binary built from `harness/apps/<name>/`.
- **Deployment ownership** — ordinary dotfiles use Stow. Harness sources live in `harness/`; `mise run harness:sync` imports them with Rulesync and installs copies under `~/.claude`, `~/.codex`, and `~/.pi/agent`. Generated harness files and marketplaces stay outside this repository. Load `harness-maintain` before changing skills, plugins, or hooks; see `harness/rulesync/README.md`. Never write through installed copies or replace unmanaged files to resolve a collision.
- **Atomic changes** — one logical change per commit, codebase always valid

## Install

```sh
ansible-playbook ansible/install_packages.yaml
mkdir -p ~/.claude/skills
mise run stow
```

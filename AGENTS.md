# Dotfiles

Edit source in this repository. `mise run harness:sync` generates the copies under `~/.claude`, `~/.codex`, and `~/.pi/agent`.

Stow deploys ordinary dotfiles. Ansible installs the prerequisites.

## Where to edit

| Kind | Source |
|---|---|
| Loose skill, shared by Claude, Codex, and Pi | `harness/skills/<group>/<name>/SKILL.md` |
| Plugin, including that plugin's skills | `harness/plugins/<plugin>/` |
| Claude settings, agents, commands, and hooks | `harness/claude/` |
| Local Codex settings | `harness/codex-settings/config.toml` (Git ignores this file) |
| Project skill for this repo | `.claude/skills/<name>/` |

`harness/claude/` is Claude configuration. The skill library is `harness/skills/`.

Installed copies are generated. Recorded ownership is `~/.claude/harness/installed.json`, `~/.codex/harness/installed.json`, and `~/.pi/agent/harness/installed.json`.

## Change the harness

1. Edit the source row in the table. Done when the file is in that source directory.
2. Read `harness/skills/AGENTS.md` before you change a loose skill. Read `harness/plugins/AGENTS.md` before you change any file in the plugin directory.
3. From this checkout run `mise run harness:sync`, then `python3 harness/rulesync/deploy.py --check`. Done when the check prints a verified count.

Claude loads a new plugin version after a plugin refresh. Codex and Pi read the new files in a new session.

Load `harness-maintain` before you change a skill, plugin, or hook. See [Rulesync deployment](harness/rulesync/README.md).

Change generated harness files through their sources. Preserve unmanaged files if deployment reports a conflict.

## Skills

Each skill has a `SKILL.md` with `name` and `description` fields. It can include references and scripts.

If a repository skill references a skill available only under `~/.claude/skills/`, move that skill into `harness/skills/`. Run `mise run harness:sync` to deploy it. Keep the reference relative to the repository source.

## WM workflow

`/wm:code:help` lists the workflow from research through specification, TODOs, implementation, and review.

`.notes/` is a separate jj repository for research, specifications, plans, and ADRs. Use `jj log` to see its history. The parent Git repository ignores it.

## Development conventions

- Keep plugins Markdown-only. Declare an MCP server in `.mcp.json` and build its binary from `harness/apps/<name>/`.
- Make one logical change per commit. Keep the code valid after each commit.

## Install

```sh
ansible-playbook ansible/install_packages.yaml
mkdir -p ~/.claude/skills
mise run stow
```

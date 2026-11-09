# Dotfiles

Edit source in this repository. `mise run harness:sync` generates the copies under `~/.claude`, `~/.codex`, and `~/.pi/agent`.

## Where to edit

| Kind | Source |
|---|---|
| Loose skill, shared by Claude, Codex, and Pi | `harness/skills/<name>/SKILL.md` |
| Plugin, including that plugin's skills | `harness/plugins/<plugin>/` |
| Claude settings, agents, commands, and hooks | `harness/claude/` |
| Project skill for this repo | `.claude/skills/<name>/` |

`harness/claude/` is Claude configuration. The skill library is `harness/skills/`.

Installed copies are generated. Recorded ownership is `~/.claude/harness/installed.json`, `~/.codex/harness/installed.json`, and `~/.pi/agent/harness/installed.json`.

## Change the harness

1. Edit the source row in the table. Done when the file is in that source directory.
2. Read `harness/skills/CLAUDE.md` before a loose skill, and `harness/plugins/CLAUDE.md` before a plugin. Done when the edit follows that file.
3. From this checkout run `mise run harness:sync`, then `python3 harness/rulesync/deploy.py --check`. Done when the check prints a verified count.

Claude loads a new plugin version after a plugin refresh. Codex and Pi read the new files in a new session.

Install, the WM pipeline, and commit conventions are in `CLAUDE.md`.

---
name: harness-maintain
description: Maintain this user's dotfiles skills, plugins, hooks, and Rulesync deployment for Claude Code, Codex, and Pi. Use when changing the harness or a deployed skill.
---

# Maintain the harness source

1. Locate the repository through `~/.claude/harness/installed.json`,
   `~/.codex/harness/installed.json`, or `~/.pi/agent/harness/installed.json`.
   The `source` field names the checkout; `files` maps installed files to source files.
2. Edit the mapped source. Plugin sources live in `harness/plugins/`; loose skills
   in `harness/skills/`; Claude settings, agents, commands, and hooks in `harness/claude/`;
   shared maintenance sources in `harness/rulesync/`.
   Read that directory's instructions. Keep skill references and plugin assets together.
   Source files use native Claude frontmatter; deployment imports them with Rulesync.
   Workers stay internal. Public aliases are defined in `harness/rulesync/config.json`
   and `commands/`: WM entry points, the five `line-comment-*` commands, and
   selected personal skills listed in the configuration.
   Codex and Pi discover workers
   through `harness/skill-index.md`; retain sibling resources in the private library.
   Change source invocation flags to choose automatic or explicit selection.
   Deploy visibility through Rulesync; avoid adding discovery links or reinstalling
   the native Codex WM plugin, which would expose its workers again.
3. For a hook change, distinguish configuration conversion from behavior. Claude tool
   names, payloads, environment variables, and blocking responses need target adapters.
   Keep an unsupported hook on its original target until both allow and deny cases pass.
4. From the checkout run `mise run harness:sync`, then
   `python3 harness/rulesync/deploy.py --check`. Inspect source diffs and test affected
   behavior. Claude needs a plugin refresh/new session; Codex needs a new session;
   Pi supports `/reload`.

Installed files are generated copies. Edit source even when a runtime offers an editor.
Do not edit third-party skills or configuration merely because their names collide.
Deployment preserves unmanaged files and stops on conflicting managed changes.
Read `harness/rulesync/README.md` in the located checkout for deployment and recovery.

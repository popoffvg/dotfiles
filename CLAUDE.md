# Dotfiles

Personal dotfiles repo managed with **GNU Stow** + **Ansible**. The repo root mirrors `~/` — stow symlinks everything into place.

## Key Subsystems

### Plugins (`harness/plugins/`)

Each plugin directory **is** the plugin root (= `CLAUDE_PLUGIN_ROOT`) — no `claude/` wrapper, no shared `common/`, no build step inside the plugin. Plain markdown: agents, commands, hooks, skills.

A plugin may register an MCP server via `.mcp.json`, but only by **binary name** — the compiled source lives in `harness/apps/<name>/` and is built to `~/.local/bin` by its own mise task. Never a build step inside the plugin dir: the plugin cache copies files without following symlinks, so the plugin must stay self-contained markdown + config. See `harness/plugins/vocab` (server source at `harness/apps/vocab`, built by `mise run harness:vocab:build`).

The same split covers a plugin's companion CLI or TUI, which is not an MCP server and is never named in the plugin at all — the user runs it from a terminal. See `harness/apps/self-improve` (built by `mise run harness:self-improve:build`), the TUI over the `self-improvement` plugin's session scan: the algorithm stays in the plugin's shell scripts and the TUI shells out to them, so the viewer cannot drift from what a scan actually does.

### Marketplace (`/.claude-plugin/marketplace.json`)

`harness/scripts/sync-marketplace.sh` regenerates `/.claude-plugin/marketplace.json` from the plugin sources — one entry per plugin, `source: ./harness/plugins/<name>` pointing **directly** at the plugin dir (no symlink layer).

Claude Code registers `local-plugins` as a **directory marketplace** pointing at the repo root (`$HOME/git/dotfiles` in `settings.json` `extraKnownMarketplaces`), so it reads `.claude-plugin/marketplace.json` straight from the repo — no stow step needed for the marketplace.

### Router skill + worker skills

A user-invocable skill with many subcommands splits into one **router** and several **worker** skills. The router holds the subcommand table, the pipeline, and the shared taxonomy. Each worker holds the procedures for one kind of work and is `user-invocable: false`, so the user reaches it only through the router.

**The router owns routing and vocabulary, never a procedure.** Its `SKILL.md` is the table plus the pipeline; its `GLOSSARY.md` is the leading words every worker uses verbatim; its `references/` holds only what cuts across all workers. A procedure that is neither routing nor shared vocabulary belongs in a worker.

**Split workers by the kind of work, not by pipeline stage.** `wm/skills/` is the worked example: `code` routes, `arch` designs (the spec corpus and the component taxonomy), `impl` writes source and git history, `teach` builds and measures the human's understanding. A reader who knows the kind of work knows the skill.

**Cite across skills with the owning skill's prefix** — `arch:ref-write.md`, `impl:sub-commit.md`, `teach:sub-quiz.md`, and `code:<file>` pointing back at the router. The prefix says which skill to open; a bare filename always means a file in the citing skill.

Worker skills need `user-invocable: false` in their frontmatter. That is the key that hides a skill from the slash-command list while leaving the model free to load it by name; `model-invocable: false` is its opposite and belongs on the router, which the user runs and the model does not.

### Subcommand rosters

A router skill (`code`, `dive`, `test-suite`, `work`, …) keeps its subcommand roster in **two** places: the table in its `SKILL.md`, and the matching `harness/plugins/<plugin>/commands/<skill>-help.md`, which prints that table verbatim.

**Any change to a roster lands in both files in the same commit.** Adding, removing, or renaming a subcommand, and any edit to a subcommand's one-line description, is incomplete until `<skill>-help.md` says the same thing. The help command is what the user reads before choosing; a roster that disagrees with it sends the user to a subcommand that no longer exists.

The two tables carry different columns — `SKILL.md` adds the reference column pointing at the command file, `<skill>-help.md` does not. Mirror the rows and the descriptions, not the columns.

### Skills

- **Loose `~/.claude` skills** live in `harness/claude/skills/<name>/SKILL.md` (stowed to `~/.claude/skills`).
- **Plugin skills** live in `harness/plugins/<name>/skills/`.
- **Project skills** (repo-scoped) live in `.claude/skills/` — e.g. `laptop-setup`.

Each skill: `SKILL.md` with `name:` + `description:` frontmatter; optional `references/` docs or helper scripts.

### WM Flow

`/wm:work-help` → research → spec → implement (worktree) → verify → `/wm:work-finish`

State tracked in `work.settings.json`. Notes in `.notes/` — its own jj repo (history via `jj log`), git-ignored in the parent. Also holds plan + research.

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

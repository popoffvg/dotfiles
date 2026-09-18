# Plugins

Every plugin root lives here as self-contained markdown.

## Rule: run `prune-text` after writing markdown here

Any change to a `SKILL.md`, a command file, an agent file, or a `references/` doc under this tree
ends with the `prune-text` skill (`harness-dev` plugin) over the files the change touched. It cuts
what two files repeat, cuts the dead weight inside each file, then reshapes the file into steps plus
disclosed reference.

A new file is not done until it passes `prune-text`. An edit to an existing file runs it over that
file, not over the whole plugin.

## Plugin root

Each plugin directory **is** the plugin root (= `CLAUDE_PLUGIN_ROOT`) — no `claude/` wrapper, no shared `common/`, no build step inside the plugin. Plain markdown: agents, commands, hooks, skills.

A plugin may register an MCP server via `.mcp.json`, but only by **binary name** — the compiled source lives in `harness/apps/<name>/` and is built to `~/.local/bin` by its own mise task. Never a build step inside the plugin dir: the plugin cache copies files without following symlinks, so the plugin must stay self-contained markdown + config.

The same split covers a plugin's companion CLI or TUI, which is not an MCP server and is never named in the plugin at all — the user runs it from a terminal. See `harness/apps/self-improve` (built by `mise run harness:self-improve:build`), the TUI over the `self-improvement` plugin's session scan: the algorithm stays in the plugin's shell scripts and the TUI shells out to them, so the viewer cannot drift from what a scan actually does.

## Marketplace (`/.claude-plugin/marketplace.json`)

`harness/scripts/sync-marketplace.sh` regenerates `/.claude-plugin/marketplace.json` from the plugin sources — one entry per plugin, `source: ./harness/plugins/<name>` pointing **directly** at the plugin dir (no symlink layer).

Claude Code registers `local-plugins` as a **directory marketplace** pointing at the repo root (`$HOME/git/dotfiles` in `settings.json` `extraKnownMarketplaces`), so it reads `.claude-plugin/marketplace.json` straight from the repo — no stow step needed for the marketplace.

## Router skill + worker skills

A user-invocable skill with many subcommands splits into one **router** and several **worker** skills. The router holds the subcommand table, the pipeline, and the shared taxonomy. Each worker holds the procedures for one kind of work and is `user-invocable: false`, so the user reaches it only through the router.

**The router owns routing and vocabulary, never a procedure.** Its `SKILL.md` is the table plus the pipeline; its `GLOSSARY.md` is the leading words every worker uses verbatim; its `references/` holds only what cuts across all workers. A procedure that is neither routing nor shared vocabulary belongs in a worker.

**Split workers by the kind of work, not by pipeline stage.** `wm/skills/` is the worked example: `code` routes, `arch` designs (the spec corpus and the component taxonomy), `impl` writes source and git history, `teach` builds and measures the human's understanding. A reader who knows the kind of work knows the skill.

**Cite across skills with the owning skill's prefix** — `arch:ref-write.md`, `impl:sub-commit.md`, `teach:sub-quiz.md`, and `code:<file>` pointing back at the router. The prefix says which skill to open; a bare filename always means a file in the citing skill.

Worker skills need `user-invocable: false` in their frontmatter. That is the key that hides a skill from the slash-command list while leaving the model free to load it by name; `model-invocable: false` is its opposite and belongs on the router, which the user runs and the model does not.

## Subcommand rosters

A router skill (`code`, `dive`, `test-suite`, `work`, …) keeps its subcommand roster in **two** places: the table in its `SKILL.md`, and the matching `harness/plugins/<plugin>/commands/<router>:<sub>.md`, which prints that table verbatim.

**Any change to a roster lands in both files in the same commit.** Adding, removing, or renaming a subcommand, and any edit to a subcommand's one-line description, is incomplete until `<router>:help.md` says the same thing. The help command is what the user reads before choosing; a roster that disagrees with it sends the user to a subcommand that no longer exists.

The two tables carry different columns — `SKILL.md` adds the reference column pointing at the command file, `<router>:help.md` does not. Mirror the rows and the descriptions, not the columns.

## Command names: colon separates router from subcommand

A command that belongs to a router is named `<router>:<sub>.md`, so it invokes as `/<plugin>:<router>:<sub>` — `commands/code:help.md` → `/wm:code:help`, `commands/work:code-revise.md` → `/wm:work:code-revise`. The dash stays inside a single segment (`code-revise`), never between router and subcommand. A command that is not a router subcommand keeps a plain name (`line-comment:act`, `smart-commit:smart-commit`).

**The filename is the only source of a command's name.** Claude Code ignores a command's `name:` frontmatter — probed on 2.1.224: a file `alpha-beta.md` carrying `name: bumblebee` still registers as `/probeplug:alpha-beta`. Keep `name:` matching the filename so the file reads honestly, and rename the file when the command's name changes.

**Skills cannot use this scheme, so don't try.** A colon in a plugin skill's directory name is normalized back to a dash — `skills/omega:sigma/` registers as `/probeplug:omega-sigma`, and its `name:` frontmatter is ignored too. Only loose and project skills (which carry no plugin prefix) keep a literal colon. A plugin router's routes therefore stay dashed as skills (`dive-docs`, not `dive:docs`) while its commands are colon-named.

## Plugin cache

Claude Code copies marketplace plugins to `~/.claude/plugins/cache/`. **Path traversal (`../`) is blocked** and symlinks are **not followed** during caching — that's why plugin sources are self-contained markdown under `harness/plugins/<name>/`.

Always edit the source at `harness/plugins/<name>/`, then re-sync (`mise run harness:plugins:sync`) and reinstall/refresh the marketplace in Claude Code.

**To bypass cache entirely** during development:
```bash
claude --plugin-dir ~/git/dotfiles/harness/plugins/wm
```

## Version bump (pre-commit)

`lefthook.yml` runs `harness/scripts/bump-plugin-version.sh` on `pre-commit`: any plugin with staged changes gets its `plugin.json` **minor** version bumped (`x.Y.z → x.(Y+1).0`), the marketplace is regenerated, and both are re-staged.

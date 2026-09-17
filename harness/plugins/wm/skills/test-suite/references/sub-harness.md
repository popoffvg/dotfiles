# Test a harness plugin from its source dir

Prove that a command, a skill, an agent, a hook, or an MCP server of
`harness/plugins/<name>/` really fires — reading the working tree, not the plugin cache. Every
plugin dir **is** its own plugin root: `.claude-plugin/plugin.json` sits inside it, and it holds
markdown, JSON config, and shell scripts only. Compiled code lives in `harness/apps/<name>/` and
reaches the plugin as a binary name in `.mcp.json` (root `CLAUDE.md` § Plugins, § Dev Conventions).

Two scripts carry the work. Run them in that order — the static check costs nothing and catches
most of what a live run would only hint at.

## Step 1 — check the layout

```bash
~/.claude/scripts/check-plugin-layout.sh ~/git/dotfiles/harness/plugins/<name>
```

Read-only. It checks the manifest name against the directory, that no TypeScript or node package
sits in the plugin dir, that no symlink and no `../` path is there for the cache copy to drop, that
every `commands/<file>.md` declares the `name:` its filename registers under, that every
`skills/<dir>/SKILL.md` declares the name it registers under (a colon in a plugin skill dir
normalizes to a dash), that every hook command exists and is executable, and that every `.mcp.json`
server names a binary on `PATH`.

Done when the last line reads `PASS <name> layout clean`. Each `FAIL` line names the file and the
rule; fix it and run again.

## Step 2 — load it and see what registered

```bash
~/.claude/scripts/probe-harness-plugin.sh ~/git/dotfiles/harness/plugins/<name> \
  --prompt "/<name>:<command>" --expect "<a string only that command produces>"
```

The script starts one headless session with `--plugin-dir` pointed at the source dir, then reads the
session's own `init` record back: where the plugin loaded from, which slash commands, skills, and
agents it registered, every hook that fired with its exit code, and the model's reply.

`--plugin-dir` **overrides** an installed copy of the same plugin. Probing `wm`, which the
`local-plugins` marketplace also installs, showed one `wm` entry sourced `wm@inline` at the repo
path — so the probe reads the working tree with no sync and no reinstall.

Run it in the background (`Bash` with `run_in_background: true`) — a session takes tens of seconds,
and the `bg-build-and-test` skill governs every run of this length.

Done when the last line reads `PASS <name>`.

## Step 3 — prove the one surface the change touched

Pick the row for what you changed and give the probe a marker that only that surface can produce.

| Surface | Probe with |
|---|---|
| command | `--prompt "/<plugin>:<command> <args>" --expect "<string the command body asks for>"` |
| skill | `--prompt "<a sentence matching the skill's description>" --expect "<string the skill body asks for>"` |
| agent | `--prompt "Use the <plugin>:<agent> agent to …" --expect "<string the agent prompt asks for>"` |
| hook | `--hook-marker "<string the hook script echoes>"` — a `hook_response` record names the event, never the script, so a marker the script echoes is the only proof yours ran |
| MCP server | nothing extra — the probe checks every server named in the plugin's `.mcp.json` reached `connected` |

A skill row is the one worth spending a run on: it measures whether the **description** fires, which
is the failure a body-only read can never see.

Done when the marker appears in the probe's output. A registered name proves only registration; the
marker proves the body ran.

## Step 4 — grade behaviour with the plugin's eval suite

A judgement call — which skill a task loads, where a block of content belongs — needs labelled cases,
not one probe. The suite lives at the plugin root, `harness/plugins/<name>/evals/`, with one
`cases-<skill>.jsonl` per graded skill and a runner that extracts the rule text from the skill at run
time (`skill:plugin-evals-at-plugin-root`).

```bash
cd ~/git/dotfiles/harness/plugins/<name>/evals && ./run.sh
```

In the background, as above. Done when the runner exits 0, meaning accuracy at or above its
threshold. `harness/plugins/wm/evals/README.md` shows the shape and records the last score.

## Step 5 — drive an interactive surface in a pane

A surface that needs a real terminal — the plugin's TUI, a full `claude` session where you type,
anything that dies with `Resource temporarily unavailable (os error 35)` — runs in a herdr pane, not
in a Bash call:

```bash
herdr agent start plugin-test --cwd ~/git/dotfiles/harness/plugins/<name> \
  --tab "$HERDR_TAB_ID" --split down --no-focus -- \
  claude --plugin-dir ~/git/dotfiles/harness/plugins/<name>
herdr agent read plugin-test --source visible --lines 40
herdr pane close <pane_id>
```

Wait for the pane to render before reading it, address every command to the pane id the open call
returned, and close a pane you opened only to prove something. Done when you have quoted the real
screen lines in your report and closed the pane.

## Step 6 — publish the change

Editing the source is enough for every step above, and nothing else. Reaching the plugin from an
ordinary session needs the marketplace regenerated and the plugin refreshed in Claude Code:

```bash
mise run harness:plugins:sync
```

Done when `.claude-plugin/marketplace.json` carries the plugin's new version — the `pre-commit`
bump writes it, so a manual sync only matters before a commit.

---

## What a probe run does and does not isolate

**Isolated:** where the plugin under test comes from. `--plugin-dir` beats the cache copy of the
same name, and the probe runs in a fresh temp cwd so no project settings and no project `CLAUDE.md`
answer for the plugin.

**Not isolated:** everything else in the session. Every other installed plugin loads, the user's
settings load, and the user's global hooks fire — a probe run of a plugin with one hook showed
fifteen hook records. Read your own marker out of that list; never read the list as the plugin's.

## Failures and what they mean

| Symptom | Cause |
|---|---|
| `<plugin> does not appear in the session's plugin list` | `plugin.json` missing or unparseable, or `--plugin-dir` pointed one level off the plugin root. |
| `<plugin> loaded from somewhere else: cache:…` | The path given is not the source dir — usually `~/.claude/plugins/cache/…` copied by hand. |
| the command registers under a name you did not expect | The filename is the only source of a command's name; `name:` frontmatter is ignored. Rename the file. |
| a plugin skill registers with a dash where you wrote a colon | Plugin skill dirs normalize `:` to `-`. Only loose and project skills keep a literal colon. |
| the marker never appears though the name registered | The body did not run. Check the prompt actually invokes it, and for a skill, that the description covers the sentence you sent. |
| a hook is missing from the list | Its script is not executable, its path escapes `${CLAUDE_PLUGIN_ROOT}`, or `hooks/hooks.json` does not parse. Step 1 catches all three. |
| an MCP server is `needs-auth` or absent | The binary is not on `PATH`. Build it with its own task — `mise run harness:<app>:build` writes to `~/.local/bin`. |

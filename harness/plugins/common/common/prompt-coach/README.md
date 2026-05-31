# prompt-coach

Inline prompt-quality coach. Flags weak prompts (vague verbs, missing context, no success criteria, unresolved pronouns) before they run.

## Modes

| Mode | Behavior |
|---|---|
| `off` | disabled |
| `async` | logs critique, no inline output |
| `warn` *(default)* | inline critique, never blocks |
| `strict` | inline critique; blocks when score ≤ `minScore` |
| `block` | blocks any flagged prompt |

Config at `~/.claude/prompt-coach.json`:

```json
{ "mode": "warn", "minScore": 10, "budgetMs": 1500, "minPromptChars": 20, "model": "claude-haiku-4-5" }
```

## Flow

1. `UserPromptSubmit` fires `coach.mjs`.
2. Regex pre-filter checks for vague verbs without file refs, unresolved pronouns, missing success cues. Clean prompts skip the LLM entirely.
3. If flagged, call Haiku via `claude -p` with rubric (`common/rubric.md`), time-boxed.
4. Render the critique to stdout (warn) or stderr+exit-2 (block).

## Commands

- `/coach-mode [off|async|warn|strict|block]` — switch mode or show current.
- `/coach-last` — show critique of most recent prompt.

## Install (local)

The plugin root is the `claude/` subdir (it contains `.claude-plugin/plugin.json`).

```bash
mkdir -p ~/.claude/plugins/local-plugins
ln -s ~/Documents/git/dotfiles/harness/plugins/prompt-coach/claude \
      ~/.claude/plugins/local-plugins/prompt-coach

# Run a one-off Claude Code session with this plugin loaded (no cache copy):
claude --plugin-dir ~/.claude/plugins/local-plugins/prompt-coach
```

Or add it to a marketplace and `/plugin install prompt-coach` — note that the marketplace install **copies** the plugin into `~/.claude/plugins/cache/` and does NOT follow symlinks. That's why `common/` is symlinked from inside `claude/` with a relative path (`claude/common → ../common`) — the cache copy resolves it once during install. After source changes, re-sync the cache or re-install.

## State

- `~/.claude/prompt-coach.json` — config
- `~/.claude/debug/prompt-coach.log` — hook log
- `$TMPDIR/prompt-coach/last.json` — most recent critique

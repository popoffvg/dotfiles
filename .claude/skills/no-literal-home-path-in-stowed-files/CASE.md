# Cases

## 2026-08-07 — A literal home path went into settings.json beside the correct `~/` entries

- **Repo:** /Users/vitaliipopov/git/dotfiles (branch vp-block-software-inventory)
- **Source:** correction — the user rejected the absolute path as soon as it appeared in the diff
- **Task:** allowing a newly written pane script to run without a prompt
- **What I did:** added a literal `/Users/vitaliipopov/.claude/scripts/lumen-pane.sh` to `allowedCommands` and a matching `Bash(...)` entry to `permissions.allow` in `harness/claude/settings.json`, beside the correct `~/`-prefixed entries
- **User's words:** > don't put the abs path to the command /Users/vitaliipopov/.claude/scripts/lumen-pane.sh … it's laptop related things
- **Evidence:** the repo stows `harness/claude/settings.json` onto each machine by symlink, so the literal entry matches only this user's home dir and adds nothing the `~/` entry does not already cover. As of 2026-09-15 the same file still holds `"path": "/Users/vitaliipopov/git/codelens"`.
- **Ambiguous?** no — a stowed file is read on machines whose home dir has another name
- **Scope chosen:** repo — the rule holds for every file this dotfiles repo stows
- **Rule written:** write `~/` or `$HOME` in any stowed file; for a permission, the bare script name plus the `~/` form, two entries, not three; grep the changed file for `/Users/` and `/home/` before finishing
- **Transcript:** ~/.claude/self-improvement/lessons/harvested/2026-08-07-session-c7bdd99c-28b4-403a-93ef-2f06a14f1805.jsonl
- **Session topic:** lumen pane script and its settings.json permission

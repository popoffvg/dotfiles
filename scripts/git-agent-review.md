# git-agent-review

Terminal workflow for reviewing commits and leaving `@agent` comments for an AI agent.
Shell-based, no plugins required. Works in fish, nushell, bash, and from inside Helix.

---

## Prerequisites

```
brew install helix fzf bat git-delta
```

---

## Install

```bash
# Script is already in dotfiles/scripts/git-agent-review
ln -sf ~/Documents/git/dotfiles/scripts/git-agent-review ~/local/bin/git-agent-review

# Git alias
git config --global alias.review "!$HOME/local/bin/git-agent-review"

# Fish abbreviation (in config.fish)
abbr -a g git
```

---

## Usage

### From the terminal

```bash
g review            # pick commits → pick files → open in Helix
g review --staged   # staged files only
g review --all      # working-tree changes (HEAD diff)
```

### From inside Helix

```
Space-r    pick commits → pick files
Space-R    staged files only
```

---

## Step-by-step flow

### 1. Pick commits

```
  a5e94a1 2026-04-04 anti-thrash, squash support (you)
▸ cd9fd0f 2026-04-05 auto-improve self-reflection (you)    │ git show --stat
  ef1b912 2026-04-06 auto-improve work-verify-gate (you)   │ (right pane)
```

- `TAB` — mark/unmark a commit
- `ENTER` — confirm selection, move to file picker

### 2. Pick files

```
  .pi/agent/skills/implement/SKILL.md
▸ .pi/agent/skills/plan/SKILL.md       │ delta diff (right pane)
```

- `TAB` — mark/unmark a file
- `ctrl-p` — switch preview to diff
- `ctrl-o` — switch preview to full file (bat)
- `ctrl-u` / `ctrl-d` — scroll preview
- `ENTER` — open all marked files in Helix

### 3. Add a comment in Helix

Navigate to the relevant line and insert an `@agent` comment:

```go
// @agent: this retry loop ignores context cancellation, fix it
```

Save with `:w`, switch buffer with `Space-b` or `:bn`, repeat.

---

## Comment convention

| Language              | Syntax                                   |
|-----------------------|------------------------------------------|
| Go / Rust / TS / JS / C | `// @agent: <instruction>`             |
| Python / Shell / YAML | `# @agent: <instruction>`               |
| SQL                   | `-- @agent: <instruction>`              |
| HTML / XML            | `<!-- @agent: <instruction> -->`        |

Keep instructions specific: what to fix, why it's wrong, what the expected behaviour is.

---

## Helix config reference

```toml
# ~/.config/helix/config.toml
[keys.normal.space]
r = ":sh git-agent-review --commits"
R = ":sh git-agent-review --staged"
```

---

## Files

| Path | Role |
|------|------|
| `dotfiles/scripts/git-agent-review` | Main bash script |
| `dotfiles/.config/fish/functions/git-agent-review.fish` | Fish wrapper |
| `dotfiles/.config/helix/config.toml` | Helix keybindings |
| `~/local/bin/git-agent-review` | Symlink on PATH |
| `git alias.review` | `g review` entry point |

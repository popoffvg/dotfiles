---
name: agent-setup
description: This skill should be used when the user wants to "add a skill", "add MCP server", "add a hook", "configure agent", "setup tool for pi and claude", "add plugin", "sync pi and claude", or mentions configuring Pi agent or Claude Code settings. Ensures every tool is registered in both Pi and Claude Code.
---

# Agent Setup

Every tool (skill, MCP server, hook, plugin) MUST be configured for **both** Pi and Claude Code.

## Architecture

```
dotfiles/skills/           ← shared skills (single source of truth)
├── <skill>/SKILL.md

~/.claude/skills/<skill>   → symlink → dotfiles/skills/<skill>
~/.pi/agent/settings.json  → skills: ["~/Documents/git/dotfiles/skills"]

dotfiles/.mcp.json         ← shared MCP servers (single source of truth)
~/.claude/.mcp.json        → symlink → dotfiles/.mcp.json
~/.pi/agent/.mcp.json      → symlink → dotfiles/.mcp.json

~/.claude/settings.json    ← Claude Code hooks, permissions, env
dotfiles/.pi/agent/settings.json ← Pi extensions, packages, settings
```

## Adding a Skill

1. Create `dotfiles/skills/<name>/SKILL.md` with frontmatter:
   ```yaml
   ---
   name: <name>
   description: <trigger phrases for when to activate>
   ---
   ```

2. Symlink for Claude Code:
   ```bash
   ln -sfn ~/Documents/git/dotfiles/skills/<name> ~/.claude/skills/<name>
   ```

3. Pi picks it up automatically via `"skills": ["~/Documents/git/dotfiles/skills"]` in settings.json.

**Checklist:**
- [ ] Skill created in `dotfiles/skills/<name>/SKILL.md`
- [ ] Symlink exists at `~/.claude/skills/<name>`
- [ ] Pi settings.json `skills` array includes the dotfiles/skills path

## Adding an MCP Server

Single config at `dotfiles/.mcp.json` — both agents read it via symlink.

Edit `dotfiles/.mcp.json`:
```json
{
  "mcpServers": {
    "<name>": { "command": "...", "args": [...] }
  }
}
```

**Checklist:**
- [ ] Server added to `dotfiles/.mcp.json`
- [ ] Symlinks exist: `~/.claude/.mcp.json` → `dotfiles/.mcp.json`, `~/.pi/agent/.mcp.json` → `dotfiles/.mcp.json`

## Adding a Hook

Hooks differ between Pi (extensions) and Claude Code (settings.json hooks).

### Claude Code hook

Edit `~/.claude/settings.json`, add to `hooks` object:
```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "...", "hook": "..." }],
    "PostToolUse": [{ "matcher": "...", "hook": "..." }],
    "Stop": [{ "hook": "..." }]
  }
}
```

### Pi equivalent

Pi uses extensions in `dotfiles/.pi/agent/settings.json` → `extensions` array.
If no direct equivalent exists, document the gap.

**Checklist:**
- [ ] Hook added to Claude Code `~/.claude/settings.json`
- [ ] Equivalent behavior added to Pi (extension or skill)
- [ ] Both agents have the same capability

## Verification

After any change, verify both agents see the tool:

```bash
# Skills: check symlinks
ls -la ~/.claude/skills/<name>
ls ~/.pi/agent/skills/ | grep <name>

# MCP: verify symlinks point to dotfiles
readlink ~/.claude/.mcp.json
readlink ~/.pi/agent/.mcp.json
```

## Rules

- **Never add a tool to only one agent.** Always both.
- Skills live in `dotfiles/skills/` — never in `~/.claude/skills/` or `~/.pi/agent/skills/` directly.
- MCP config lives in `dotfiles/.mcp.json` — never edit the symlink targets directly.
- After adding, run verification to confirm both agents see the new tool.

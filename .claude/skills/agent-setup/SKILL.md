---
name: agent-setup
description: This skill should be used when the user wants to "add a skill", "add MCP server", "add a hook", "configure agent", "setup tool for pi and claude", "add plugin", "create plugin", "sync pi and claude", "write harness", or mentions configuring Pi agent or Claude Code settings. Ensures every tool is registered in both Pi and Claude Code.
---

# Agent Setup

Every tool (skill, MCP server, hook, plugin) MUST be configured for **both** Pi and Claude Code.

## Activation guardrails

Use this skill only when the user is explicitly changing agent infrastructure (skills, plugins, MCP, hooks, settings).
Do **not** use it for normal feature coding, bug fixes, or repository-only code changes.

If the user asks for a single-agent local experiment, confirm scope before enforcing dual-agent wiring.

## Architecture

```
dotfiles/
├── skills/                    ← standalone skills (shared, single source of truth)
│   └── <skill>/SKILL.md
├── harness/plugins/<plugin>/          ← plugins with agent-specific adapters
│   ├── common/                ← shared logic, MCP servers, core code
│   ├── pi/                    ← Pi extension adapter (index.ts)
│   └── claude/                ← Claude Code plugin (.claude-plugin/, hooks, agents, commands)
├── .mcp.json                  ← global MCP servers (symlinked to both agents)
└── .pi/agent/settings.json    ← Pi settings

~/.claude/skills/<skill>       → symlink → dotfiles/skills/<skill>
~/.pi/agent/settings.json      → skills: ["~/Documents/git/dotfiles/skills"]
~/.claude/.mcp.json            → symlink → dotfiles/.mcp.json
~/.pi/agent/.mcp.json          → symlink → dotfiles/.mcp.json
~/.claude/settings.json        ← Claude Code hooks, permissions, env
```

## Path/source-of-truth resolution

When duplicate-looking skill paths exist, use this precedence:
1. `dotfiles/.claude/skills/<name>/SKILL.md` (repo source of truth for this setup)
2. `~/.pi/agent/skills/<name>/SKILL.md` (runtime copy/symlink if present)

If one path is missing, edit the existing source-of-truth file and state which path was used.

## Harness Plugin Structure

A plugin is a feature that needs agent-specific adapters (MCP servers, hooks, commands).

### Directory layout

```
harness/<plugin-name>/
├── common/                    ← shared code used by both agents
│   ├── server/                ← MCP server (if any)
│   │   ├── index.ts
│   │   └── package.json
│   └── core/                  ← shared logic, types, utilities
├── pi/                        ← Pi extension
│   └── index.ts               ← Pi extension entry point
└── claude/                    ← Claude Code plugin
    └── .claude-plugin/
        └── plugin.json        ← plugin metadata
    ├── .mcp.json              ← plugin-local MCP servers (use ${CLAUDE_PLUGIN_ROOT})
    ├── agents/                ← agent .md files
    ├── commands/              ← slash command .md files
    ├── hooks/                 ← hooks.json
    ├── skills/                ← plugin-scoped skills (SKILL.md per dir)
    └── bin/                   ← helper scripts
```

### Creating a new plugin

1. **Create the directory structure:**
   ```bash
   mkdir -p harness/plugins/<name>/{common,pi,claude/.claude-plugin}
   ```

2. **Write plugin.json** (`harness/plugins/<name>/claude/.claude-plugin/plugin.json`):
   ```json
   {
     "name": "<name>",
     "version": "0.1.0",
     "description": "<what the plugin does>",
     "author": { "name": "popoffvg" }
   }
   ```

3. **Register in Pi** — add extension to `dotfiles/.pi/agent/settings.json`:
   ```json
   "extensions": [
     "~/Documents/git/dotfiles/harness/plugins/<name>/pi/index.ts"
   ]
   ```

4. **Register in Claude Code** — symlink plugin to `~/.claude/plugins/`:
   ```bash
   ln -sfn ~/Documents/git/dotfiles/harness/plugins/<name>/claude ~/.claude/plugins/<name>
   ```

5. **Enable in Claude Code** — add to `~/.claude/settings.json`:
   ```json
   "enabledPlugins": {
     "<name>": true
   }
   ```

### Plugin MCP servers

Plugin-scoped MCP servers go in `harness/plugins/<name>/claude/.mcp.json`.
Use `${CLAUDE_PLUGIN_ROOT}` to reference paths relative to the claude/ dir.
The common server code lives in `harness/plugins/<name>/common/server/`.

```json
{
  "mcpServers": {
    "<name>": {
      "command": "npx",
      "args": ["tsx", "${CLAUDE_PLUGIN_ROOT}/../common/server/index.ts"],
      "env": { "CWD": "${CWD}" }
    }
  }
}
```

For Pi, reference the same server in the extension's index.ts.

### Plugin checklist

- [ ] `harness/plugins/<name>/claude/.claude-plugin/plugin.json` exists
- [ ] `harness/plugins/<name>/pi/index.ts` exists (even if minimal)
- [ ] Pi extension registered in `dotfiles/.pi/agent/settings.json` → `extensions`
- [ ] Claude plugin symlinked to `~/.claude/plugins/<name>`
- [ ] Claude plugin enabled in `~/.claude/settings.json` → `enabledPlugins`
- [ ] Shared code lives in `common/`, not duplicated

## Adding a Standalone Skill

For simple skills without agent-specific adapters:

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

3. Pi picks it up automatically via `"skills": ["~/Documents/git/dotfiles/skills"]`.

**Checklist:**
- [ ] Skill created in `dotfiles/skills/<name>/SKILL.md`
- [ ] Symlink exists at `~/.claude/skills/<name>`

## Adding a Global MCP Server

Single config at `dotfiles/.mcp.json` — both agents read it via symlink.

```json
{
  "mcpServers": {
    "<name>": { "command": "...", "args": [...] }
  }
}
```

**Checklist:**
- [ ] Server added to `dotfiles/.mcp.json`
- [ ] Symlinks exist: `~/.claude/.mcp.json` and `~/.pi/agent/.mcp.json` → `dotfiles/.mcp.json`

## Adding a Hook

### Claude Code

Edit `~/.claude/settings.json` → `hooks`:
```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "...", "hook": "..." }],
    "PostToolUse": [{ "matcher": "...", "hook": "..." }],
    "Stop": [{ "hook": "..." }]
  }
}
```

### Pi

Add extension to `dotfiles/.pi/agent/settings.json` → `extensions` array.

**Checklist:**
- [ ] Hook added to Claude Code
- [ ] Equivalent behavior added to Pi
- [ ] Both agents have the same capability

## Verification

```bash
# Skills: check symlinks
ls -la ~/.claude/skills/<name>
ls ~/.pi/agent/skills/ | grep <name>

# Plugins: check both registrations
ls -la ~/.claude/plugins/<name>
grep '<name>' dotfiles/.pi/agent/settings.json

# MCP: verify symlinks
readlink ~/.claude/.mcp.json
readlink ~/.pi/agent/.mcp.json
```

## Pre-change checklist

- [ ] Restate requested scope (skill/plugin/MCP/hook; Pi/Claude/both)
- [ ] Confirm target paths before editing
- [ ] Prefer minimal changes; avoid unrelated refactors
- [ ] After edits, verify registrations/symlinks with concrete checks

## Rules

- **Never add a tool to only one agent.** Always both.
- Skills live in `dotfiles/skills/` — never directly in agent dirs.
- Plugins live in `dotfiles/harness/plugins/<name>/` with `common/`, `pi/`, `claude/` dirs.
- MCP config lives in `dotfiles/.mcp.json` — never edit symlink targets directly.
- Shared code goes in `common/` — never duplicate between `pi/` and `claude/`.

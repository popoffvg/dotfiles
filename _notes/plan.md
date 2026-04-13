# Plan — claude-skill-stats

Two goals: (1) add Claude Code side to skill-manager plugin, (2) expose `work_start` MCP tool for work-manager.

Architecture decision: **pure hooks + JSONL** (no MCP server). See `_notes/tradeoffs.md` for rationale.

---

## Goal 1: Claude Code side for skill-manager

### Architecture: hooks + JSONL + scoring script

- **PostToolUse(Read)** shell hook → detect SKILL.md reads, append `skill_activate` to JSONL
- **PostToolUse(Edit/Write)** shell hook → append `file_edit` to JSONL
- **UserPromptSubmit** prompt hook → LLM classifies friction, appends `friction` + `user_message` to JSONL
- **Stop** prompt hook → instructs Claude to run scoring script + auto-improve check
- **SessionStart** shell hook → score any un-scored previous JSONL (crash recovery)
- Scoring script (`score-session.ts`) → reads JSONL, computes session score, writes to `skills-stats.json` and `skills-scores/YYYY-MM-DD.json`

### Files

```
harness/plugins/skill-manager/
  claude/
    .claude-plugin/
      plugin.json           # Plugin manifest
    bin/
      track-skill.sh        # PostToolUse(Read) — detect SKILL.md, append to JSONL
      track-edit.sh         # PostToolUse(Edit/Write) — append file_edit to JSONL
      score-session.ts      # Stop/SessionStart — process JSONL, compute scores, persist
      recover-session.sh    # SessionStart — check for un-scored JSONL, run score-session.ts
    hooks/
      hooks.json            # Hook definitions
    commands/
      skills-stats.md       # /skill-manager:skills-stats command
```

### Shared files (Pi side continues owning)

```
~/.pi/agent/skills-stats.json              # Cumulative per-skill stats
~/.pi/agent/skills-scores/YYYY-MM-DD.json  # Daily session scores
~/.pi/agent/skill-stats-session.jsonl      # Current session event log
```

### Acceptance criteria

- [ ] AC1: PostToolUse(Read) detects SKILL.md paths and appends skill_activate event to JSONL
- [ ] AC2: PostToolUse(Edit/Write) appends file_edit event to JSONL
- [ ] AC3: UserPromptSubmit prompt hook classifies friction and appends friction + user_message events
- [ ] AC4: Stop hook triggers scoring script that computes session quality score
- [ ] AC5: Scoring formula matches Pi side: quality 45%, efficiency 30%, stability 25%
- [ ] AC6: Stats persist to `~/.pi/agent/skills-stats.json` (same format as Pi side)
- [ ] AC7: Daily scores persist to `~/.pi/agent/skills-scores/YYYY-MM-DD.json`
- [ ] AC8: SessionStart hook recovers un-scored sessions from previous JSONL
- [ ] AC9: Auto-improve triggers via Stop prompt hook when friction threshold crossed
- [ ] AC10: `/skill-manager:skills-stats` command shows formatted stats

### TODOs

- [x] TODO-0: Investigate why "plan verification" skill is not visible — confirmed `work-plan-verifier` is referenced by FSM/router but no `SKILL.md` exists, so it cannot be discovered/loaded.
- [ ] TODO-1: Create plugin scaffold — `claude/.claude-plugin/plugin.json`, `claude/bin/`, `claude/hooks/`, `claude/commands/` directories
- [ ] TODO-2: Create `claude/bin/track-skill.sh` — PostToolUse(Read) hook script. Reads stdin JSON, checks if `tool_input.file_path` ends with `SKILL.md`, extracts skill name from path, appends `{"type":"skill_activate","skill":"<name>","ts":"<iso>"}` to `~/.pi/agent/skill-stats-session.jsonl`
- [ ] TODO-3: Create `claude/bin/track-edit.sh` — PostToolUse(Edit/Write) hook script. Reads stdin JSON, extracts `tool_input.file_path`, appends `{"type":"file_edit","path":"<path>","ts":"<iso>"}` to JSONL
- [ ] TODO-4: Create `claude/hooks/hooks.json` — wire PostToolUse(Read) to track-skill.sh, PostToolUse(Edit/Write) to track-edit.sh, UserPromptSubmit prompt hook for friction, Stop prompt hook for scoring + auto-improve, SessionStart to recover-session.sh
- [ ] TODO-5: Create `claude/bin/score-session.ts` — reads JSONL, computes session score (quality/efficiency/stability), updates `skills-stats.json` and `skills-scores/YYYY-MM-DD.json`, deletes processed JSONL. Scoring formula extracted from Pi `index.ts:703-728`
- [ ] TODO-6: Create `claude/bin/recover-session.sh` — SessionStart hook. Checks if `skill-stats-session.jsonl` exists (un-scored previous session), runs `score-session.ts` to process it
- [ ] TODO-7: Create `claude/commands/skills-stats.md` — `/skill-manager:skills-stats` command that reads `skills-stats.json` and formats stats table
- [ ] TODO-8: Test hooks end-to-end — verify JSONL events are written correctly by each hook

---

## Goal 2: Expose work_start MCP tool for work-manager

### Context

`work_start` already exists in `harness/plugins/work-manager/common/server/index.ts`. The MCP server is registered in `claude/.mcp.json`. Need to verify it works and add a command doc.

### TODOs

- [ ] TODO-9: Verify `work_start` MCP tool registration — check `.mcp.json` points to server correctly, test that `mcp__work__work_start` is available
- [ ] TODO-10: Add `/work-manager:work-start` command markdown if missing — documents usage and params
- [x] TODO-11: Recreate missing `work-plan-verifier` skill from Pi/Claude session records and work-manager activation behavior

---

## Implementation order

1. TODO-1 (scaffold)
2. TODO-2, TODO-3 (tracking hooks — parallel)
3. TODO-4 (hooks.json wiring)
4. TODO-5 (scoring script — core logic)
5. TODO-6 (crash recovery)
6. TODO-7 (stats command)
7. TODO-8 (e2e test)
8. TODO-9, TODO-10 (work-manager — parallel, independent)

---

## Hotfix: project subrepo skills/rules discovery

### Acceptance criteria

- [x] AC-H1: skill-manager discovers `.claude/skills` from cwd and first-level subrepos
- [x] AC-H2: skill-manager exposes `.claude/rules` via `promptPaths` in `resources_discover`

### TODOs

- [x] TODO-H1: Update discovery function to return both `skillPaths` and `promptPaths`
- [x] TODO-H2: Wire `resources_discover` to return both when present

---

## Hotfix: suppress false "daemon not running" warning

### Acceptance criteria

- [x] AC-D1: memory-keeper waits for daemon health with retries before warning

### TODOs

- [x] TODO-D1: Replace one-shot startup sleep with health polling loop in `harness/plugins/memory-keeper/pi/index.ts`

# Architecture Decision: Hooks vs MCP Server

## Decision: Pure hooks + JSONL log (no MCP server)

MCP server adds unnecessary complexity for stat tracking. Hooks + file persistence is simpler, more durable, and sufficient.

## Comparison

| Criteria | MCP Server | Pure Hooks |
|---|---|---|
| **In-memory state** | Yes — maps, counters live in process | No — append to JSONL, batch-process on Stop |
| **Crash durability** | Loses state on crash | JSONL survives crashes |
| **Process overhead** | stdio server per session (tsx + node) | None — bash scripts only |
| **Dependencies** | @modelcontextprotocol/sdk, zod, tsx | bash, jq |
| **Query interface** | Rich — agent calls MCP tools | Read file directly |
| **Complexity** | package.json, tsconfig, server lifecycle | Shell scripts + one tsx scoring script |
| **Pattern consistency** | Matches work-manager | Simpler, fewer moving parts |
| **Startup cost** | ~1-2s node boot per session | Zero |

## Hook mapping (Pi -> Claude Code)

| Feature | Pi hook | Claude hook | Notes |
|---|---|---|---|
| Skill activation | `tool_result` | **PostToolUse(Read)** | Check path ends with SKILL.md |
| Edit thrashing | `tool_call` | **PostToolUse(Edit/Write)** | Append {file, ts} to JSONL |
| Friction detection | `input` (regex) | **UserPromptSubmit** (prompt) | LLM-based — better than regex, catches semantic friction |
| User message count | `input` | **UserPromptSubmit** | Increment counter in JSONL |
| Assistant turns | `turn_end` | **PostToolUse** | Approximate: dedupe by timestamp window (~1s) |
| Tool failures | `tool_execution_end` | **PostToolUse** | Parse output for error patterns |
| Session scoring | `session_shutdown` | **Stop** | Runs tsx scoring script |
| Auto-improve | `agent_end` / `RETURN_TO_PLAN` | **Stop** (prompt) + **PostToolUse** (prompt, threshold) | Prompt-based: inject improvement instruction when friction ratio crossed |
| Friction log | In-memory array | JSONL `type: "friction"` entries | More durable than in-memory |

## Known gaps

### 1. Assistant turn count (minor)
No exact `turn_end` equivalent. PostToolUse fires per tool, not per turn — over-counts when multiple tools per turn. Mitigation: dedupe by timestamp window. Acceptable inaccuracy for scoring formula.

### 2. Tool failure detection (minor)
PostToolUse doesn't guarantee structured error info. Strategy: parse output for known error patterns (`Error:`, stack traces, non-zero exit). Good enough for stability score.

### 3. Stop hook reliability (medium)
Stop doesn't fire on forced quit / terminal close. Mitigations:
- JSONL log persists raw events regardless of clean shutdown
- **SessionStart** hook checks for un-scored previous JSONL and scores it retroactively

### 4. Auto-improve trigger timing (different, not worse)
Pi fires at `agent_end` mid-session. Claude options:
- **Stop hook** (prompt-based): instructs Claude to run improvement at session end
- **PostToolUse** (prompt-based): checks friction ratio every N events, triggers inline when threshold crossed — actually closer to real-time than Pi

## Persistence strategy

```
~/.pi/agent/skill-stats-events.jsonl   # Append-only event log (per session)
~/.pi/agent/skills-stats.json          # Cumulative stats (shared with Pi side)
~/.pi/agent/skills-scores/YYYY-MM-DD.json  # Daily scores (shared with Pi side)
```

Event types in JSONL:
- `skill_activate` — name, source, hash
- `file_edit` — path, timestamp
- `friction` — user text, timestamp
- `user_message` — timestamp (count only)
- `tool_use` — tool name, timestamp, error flag

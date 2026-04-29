---
name: context-scan
description: Scan recent Claude session logs for missed insights (fallback when Stop hook fails). This skill should be used when the user says "context scan", "scan sessions", "check old sessions", "find missed insights", or wants to recover insights from sessions where the Stop hook did not fire. Also used by hourly cron to automatically sweep for uncaptured knowledge.
---

# Context Scan

Scan recent Claude Code session logs for insights the Stop hook may have missed.

## Usage

`/context scan` — last hour
`/context scan 3h` — last 3 hours
`/context scan 1d` — last day

## Configuration

Read `insights_root` from `~/.claude/memory-keeper.local.md` YAML frontmatter.

## Procedure

### Step 0: Load config first (required)

- Read `insights_root` from `~/.claude/memory-keeper.local.md` YAML frontmatter **before any file operations** (including listing sessions or reading logs).
- If `insights_root` is missing/unreadable, report the blocking config error and stop.

### Preflight: local-only scan and recovery behavior

- This skill operates on local files under `~/.claude/...`; do **not** require SSH for normal operation.
- If a path read fails, report the exact missing/inaccessible path and stop speculative diagnosis.
- If the user indicates environment recovery (e.g., "I fixed ssh"), retry the original scan flow once from Step 1 instead of giving more setup advice.
- Do not loop on connectivity guidance; either proceed with the scan or return one concrete blocking error.

### Step 1: Find recent sessions

1. List `~/.claude/projects/` subdirectories
2. Find `*.jsonl` files modified within the time window
3. Skip the current session (match by `sessionId` from first record)
4. Skip already-processed sessions via `<insights_root>/.scanned_sessions`

### Step 2: Extract conversations

For each unscanned JSONL:
1. Lines where `type` is `"user"` or `"assistant"`
2. User messages: `message.content` string, skip `<command`, `<system`, `<local` prefixes
3. Assistant messages: text blocks from `message.content` array (`block.type == "text"`)
4. Max 4000 chars per session, take last N messages that fit

### Step 3: Extract entries

For each session, identify distinct topics worth remembering. For each:

- **classification**: `insight` | `agent_edit` | `none`
- **repo**: basename from `~/.claude/projects/<encoded-path>/` last path segment
- **topic**: keyword-rich title, 3-7 words

Classifications:
- `insight`: completed work — how things work, patterns, gotchas, decisions
- `agent_edit`: AI behavior changes — hooks, prompts, skills, plugin config
- `none`: routine, skip

### Step 4: Write entries in wiki format

```
## <Keyword-rich title, 3-7 words> — YYYY-MM-DD HH:MM

<Lead: direct statement of what this is and why it matters. 1-3 sentences.
Include concrete identifiers: file paths, function names, config keys.
No preamble. Write for someone with zero memory of this session.>

### Subsection (only when topic has multiple distinct aspects)
<Details>
```

**Heading = the search key.** Must be findable months later:
- Good: `RocksDB WAL mode: disable for unit test speed`
- Bad: `Database optimization`, `Fixed performance issue`

**Lead = complete picture.** Self-contained, no preamble:
- Good: `RocksDB in WAL journal mode acquires a file lock that prevents parallel test processes from opening the same DB. Disable WAL with \`db.pragma("journal_mode = DELETE")\` in test setup.`
- Bad: `We found that the database was causing issues because...`

### Step 5: Deduplicate and save

Before saving each entry, read the target file:
1. Exact heading match → skip
2. Semantic overlap → skip
3. New entry is broader → replace old
4. Existing entry is broader → skip

Save locations:
- `insight` → `<insights_root>/<repo>/insights.md`
- `agent_edit` → `<insights_root>/claude-config/behavior.md`

### Step 6: Mark as scanned

Append each processed session filename to `<insights_root>/.scanned_sessions`.

## Output

- Sessions scanned
- Entries saved (by classification)
- Brief list: topic + file
- "No new insights" if nothing found

## Commit/side-effect guard

- Do not run git commands from this skill.
- If user says only "commit" while scanning/reviewing, ask what they want committed and where; do not assume.
- This skill only reads session logs and writes insight markdown files.

## Autoresearch rules

**Eval checklist:**
1. Were session logs scanned within the requested time window (not broader/narrower)?
2. Did the scan find insights that the Stop hook missed (not re-saving existing ones)?
3. Were extracted insights saved to the correct repo insight folders?
4. Was the insights_root config read before any file operations?

**Test inputs:**
- "Scan last hour for missed insights"
- "Scan last day of sessions"
- "Scan when no sessions exist in the time window"

**Can change:** log parsing strategy, time window parsing, insight extraction criteria, deduplication
**Cannot change:** insights_root config requirement, session log location, fallback nature (supplements Stop hook), removed `_tasks` routing
**Min sessions before eval:** 5
**Runs per experiment:** 3

# Memory-Keeper Refactor Plan

## Goals

1. **Daemon architecture** — single long-lived process (MCP + core) shared across all sessions
2. **Unified statistics** in core — both MCP and Pi use the same implementation (Pi's rich table format)
3. **SQLite queue** for async processing — last 30 sessions, GC for old data, background drain loop
4. **pino logger** — structured JSON, file rotation, single log for both adapters
5. **tsx everywhere** — `.ts` files, no `tsc` build step, tsx as runtime
6. **Health banner** on session start from daemon stats

## Architecture

```
┌──────────────────────────────────────────────────┐
│            memory-keeper daemon                   │
│  (single long-lived process, started once)        │
│                                                   │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ MCP server   │  │ Queue    │  │ Drain loop  │ │
│  │ (SSE/HTTP)   │  │ (SQLite) │  │ (background)│ │
│  └──────┬───────┘  └────┬─────┘  └──────┬──────┘ │
│         │               │               │         │
│  ┌──────┴───────────────┴───────────────┴──────┐ │
│  │              Core library                    │ │
│  │  classify, dedup, save, stats, logger        │ │
│  └──────────────────────────────────────────────┘ │
└──────────┬─────────────────────────┬──────────────┘
           │ SSE/HTTP                │ HTTP (same)
    ┌──────┴──────┐          ┌──────┴──────┐
    │ Claude Code │          │ Pi agent    │
    │ (MCP client)│          │ (HTTP calls)│
    └─────────────┘          └─────────────┘
```

**Key change from previous plan**: No per-session process spawning. The daemon starts once (via launchd, manual start, or first-session auto-start) and serves all Claude Code / Pi sessions over SSE transport.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Logger | **pino** + `pino.destination()` | JSON by default, file dest avoids stdout, rotation handled manually |
| SQLite | **better-sqlite3** | Sync API, single process owns the DB — no concurrent access issues |
| Runtime | **tsx** everywhere | `.ts` files, no compilation, instant startup |
| Transport | **SSE** (MCP SDK `SSEServerTransport`) | Claude Code supports `"type": "sse"` in mcp.json, long-lived connection |
| Port | `localhost:7420` (configurable via `MK_PORT`) | High port, localhost only, no auth needed |
| DB location | `~/.claude/debug/memory-keeper.db` | Single DB, daemon owns it exclusively |
| Daemon management | Auto-start script + PID file | `~/.claude/debug/memory-keeper.pid`, health check via HTTP `/health` |

## Dependency Graph

```
Step 1: pino logger ─────┬──→ Step 2: stats to core ──┬──→ Step 4: processQueue() + drain loop
                         └──→ Step 3: SQLite queue ────┘          │
                                                           Step 5: daemon (SSE server + lifecycle)
                                                              ┌────┴────┐
                                                     Step 6: Claude  Step 7: Pi
                                                              └────┬────┘
                                                         Step 8: docs + smoke
```

## Layout After

```
memory-keeper/
├── common/
│   ├── memory.ts          # core logic: classify, dedup, save (exists, edited)
│   ├── index.ts           # re-exports (exists, edited)
│   ├── logger.ts          # NEW — pino wrapper
│   ├── queue.ts           # NEW — SQLite queue
│   ├── processor.ts       # NEW — processQueue() drain function + background drain loop
│   └── server/
│       ├── index.ts       # MCP server — SSE/HTTP daemon (rewritten from stdio)
│       ├── daemon.ts      # NEW — lifecycle: start, stop, health, PID file
│       └── package.json   # add pino, better-sqlite3, express/fastify or raw http
├── claude/
│   ├── .claude-plugin/plugin.json
│   ├── agents/context-keeper.md
│   ├── bin/memory-extract.sh
│   ├── bin/ensure-daemon.sh  # NEW — starts daemon if not running (SessionStart hook)
│   ├── hooks/hooks.json      # edited — add SessionStart hook for daemon + health banner
│   ├── mcp.json              # changed — type: sse, url: http://localhost:7420/sse
│   └── skills/
├── pi/
│   └── index.ts           # thin adapter — HTTP client to daemon
├── skills/
│   └── plugin-architecture/SKILL.md  # updated
├── __tests__/
│   ├── logger.test.ts
│   ├── queue.test.ts
│   ├── processor.test.ts
│   ├── stats.test.ts
│   └── e2e.test.ts
└── package.json
```

---

## Step 1: Add pino logger to common/

**Blocked by**: nothing
**Blocks**: Step 2, Step 3

### What

Replace hand-rolled `log()` + `rotateLog()` in `common/memory.ts` with pino.

### Files

- **NEW**: `common/logger.ts`
- **EDIT**: `common/memory.ts` — remove `log()`, `rotateLog()`, `LOG_FILE`, `LOG_DIR` constants, import from logger
- **EDIT**: `common/server/package.json` — add `pino`, `pino-roll`

### API

```ts
// common/logger.ts
import pino from 'pino'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync } from 'fs'

const LOG_DIR = join(homedir(), '.claude', 'debug')
mkdirSync(LOG_DIR, { recursive: true })

export const LOG_FILE = join(LOG_DIR, 'memory-keeper.log')
export { LOG_DIR }

export const logger = pino({
  level: process.env.MK_LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
}, pino.transport({
  target: 'pino-roll',
  options: { file: LOG_FILE, size: '512k', limit: { count: 3 } }
}))
```

Single log file, child loggers per subsystem via `createLogger(name)`. Each JSON line has a `component` field for filtering.

**Child loggers**:

| Component | Used by | Created in |
|---|---|---|
| `core` | `common/memory.ts` (default `logger` export) | `common/logger.ts` |
| `mcp` | MCP server / daemon | `common/server/index.ts` |
| `hooks` | Claude Code hooks | hook scripts |
| `pi` | Pi adapter | `pi/index.ts` |
| `queue` | Queue operations | `common/queue.ts` |
| `drain` | Background drain loop | `common/processor.ts` |

**Example log line**:
```json
{"level":30,"time":"2026-04-11T10:30:00.000Z","component":"mcp","topic":"Go context","msg":"insight processed"}
```

### Tests (`__tests__/logger.test.ts`)

```
1. logger.info() writes JSON line to LOG_FILE
2. JSON line has required fields: level, time, msg, component
3. MK_LOG_LEVEL=debug enables debug level; MK_LOG_LEVEL=error suppresses info
4. createLogger('mcp') returns child with component='mcp' in every line
5. createLogger('pi') and createLogger('mcp') write to same file without corruption
6. LOG_DIR is created if missing
```

---

## Step 2: Move stats to core with Pi's rich format

**Blocked by**: Step 1
**Blocks**: Step 4

### What

Unify token stats + QMD stats into core. Port Pi's nice table format as canonical.

### Currently duplicated

- `common/memory.ts`: `trackTokenUsage()`, `loadTokenStatsByDay()`, `DayStats` — basic
- `pi/index.ts`: same + `trackQmdUsage()`, `loadTokenStatsByDay()` with detail drill-down, `/memory:stats` table formatting

### Target exports from `common/memory.ts`

- `trackTokenUsage(sessionId, project, usage, savedCount)`
- `trackQmdUsage(toolName, toolInput, resultText)`
- `loadTokenStatsByDay(days?): DayStats[]`
- `formatStatsTable(days: DayStats[]): string` — Pi's current table format
- `formatStatsDayDetail(day: DayStats): string`
- `formatHealthBanner(days: DayStats[], queueStats: QueueStats): string` — compact one-liner for session start
- Types: `DayStats`, `TokenUsage`, `QueueStats`

### Health banner on session start

Both adapters show a compact health summary when the user opens a session. Gives immediate visibility into plugin state without running `/memory:stats`.

**Format** (single line, fits terminal):
```
memory-keeper: 3 insights today · 1.2k tokens · queue: 0 pending, 0 failed · 42 sessions tracked
```

**Degraded states** (highlight problems):
```
memory-keeper: ⚠ 5 failed in queue · 0 insights today · 850 tokens · 30 sessions tracked
```
```
memory-keeper: ✗ no stats yet — first session?
```

**`formatHealthBanner()` logic**:
1. Load today's `DayStats` from `loadTokenStatsByDay(1)`
2. Load `QueueStats` from `getQueueStats()`
3. Build one-line summary:
   - Insights saved today (from DayStats)
   - Tokens used today (from DayStats, formatted as `1.2k` / `15.3k`)
   - Queue status: pending + failed counts (only shown if > 0)
   - Total sessions tracked (from QueueStats or sessions table)
4. Prefix with `⚠` if `failed > 0`, `✗` if no stats at all

### Adapter changes

- MCP `memory_stats` tool → `formatStatsTable()` / `formatStatsDayDetail()`
- Pi `/memory:stats` → same functions, render via `ctx.ui.notify()`
- Pi `tool_result` handler → `trackQmdUsage()` from core
- **Claude Code**: new `SessionStart` hook in `hooks.json` → shell script calls MCP `memory_context` tool with health banner injected into `additionalContext`
- **Pi**: `before_agent_start` handler appends `formatHealthBanner()` output to system prompt injection

### Delete from Pi

`trackTokenUsage`, `trackQmdUsage`, `loadTokenStatsByDay`, `DayStats`, `TOKEN_STATS_FILE`, `QMD_STATS_FILE`, `QMD_STATS_LOG`

### Tests (`__tests__/stats.test.ts`)

```
1. trackTokenUsage() appends JSONL line with correct fields (timestamp, session, project, tokens, saved_count)
2. trackTokenUsage() creates LOG_DIR if missing
3. loadTokenStatsByDay(3) returns max 3 days, sorted newest first
4. loadTokenStatsByDay() aggregates multiple sessions on same day correctly
5. loadTokenStatsByDay() handles corrupt JSONL lines gracefully (skips, doesn't crash)
6. loadTokenStatsByDay() returns [] when stats file doesn't exist
7. trackQmdUsage() appends JSONL line with tool, query, result_count, zero_results fields
8. trackQmdUsage() counts zero_results correctly for empty response
9. formatStatsTable() produces table with header, separator, rows, totals
10. formatStatsTable() marks latest day with "◀" indicator
11. formatStatsTable([]) returns "No stats" message
12. formatStatsDayDetail() includes all fields: date, sessions, total/input/output tokens, insights
13. MCP memory_stats tool returns same string as formatStatsTable() (integration)
14. formatHealthBanner() with today's stats returns "N insights today · Nk tokens · queue: ..."
15. formatHealthBanner() with no stats returns "✗ no stats yet — first session?"
16. formatHealthBanner() with failed queue items shows "⚠ N failed in queue"
17. formatHealthBanner() formats tokens as "1.2k" for 1200, "15.3k" for 15300, "850" for 850
18. formatHealthBanner() with 0 pending and 0 failed omits queue section
```

---

## Step 3: Add SQLite queue to core

**Blocked by**: Step 1
**Blocks**: Step 4

### What

Create `common/queue.ts` with better-sqlite3 for async insight processing.

### Schema

```sql
CREATE TABLE IF NOT EXISTS queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  conversation TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('claude', 'pi-cron', 'pi-shutdown', 'pi-manual')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'processing', 'done', 'failed')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  source TEXT NOT NULL,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  total_enqueued INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);
```

### API

```ts
// common/queue.ts
export function openQueue(dbPath?: string): void
  // default: ~/.claude/debug/memory-keeper.db

export function enqueue(item: {
  sessionId: string
  project: string
  conversation: string
  source: 'claude' | 'pi-cron' | 'pi-shutdown' | 'pi-manual'
}): number
  // returns queue row id
  // upserts sessions table (last_seen, total_enqueued++)

export function dequeue(batchSize?: number): QueueItem[]
  // returns pending items oldest-first, atomically marks as 'processing'

export function markDone(id: number, result?: object): void
  // sets status='done', processed_at=now, stores result as JSON

export function markFailed(id: number, error: string, retryCount: number): void
  // sets status='failed' if retryCount >= 3, else back to 'pending' with retry_count++

export function getQueueStats(): {
  pending: number
  processing: number
  done: number
  failed: number
  total: number
}

export function gcSessions(keepCount?: number): number
  // default keepCount=30
  // deletes sessions + queue rows for sessions beyond the Nth most recent
  // returns count of deleted sessions

export function closeQueue(): void
```

### GC Rule

`gcSessions(30)` ranks sessions by `last_seen` DESC, keeps top 30, deletes the rest + their queue rows. Called on Pi `session_start` and Claude MCP server startup.

### Tests (`__tests__/queue.test.ts`)

```
1. openQueue() creates DB file and tables (queue, sessions, indexes)
2. openQueue() is idempotent — second call on same path doesn't error
3. enqueue() inserts row with status='pending', returns integer id
4. enqueue() upserts sessions table — first call creates, second updates last_seen + increments total_enqueued
5. enqueue() validates source field — rejects invalid source string
6. dequeue(2) returns oldest 2 pending items, marks them as 'processing'
7. dequeue() skips items already in 'processing' or 'done' status
8. dequeue() on empty queue returns []
9. dequeue() returns items in FIFO order (oldest first by created_at)
10. markDone() sets status='done', sets processed_at timestamp, stores result JSON
11. markDone() on non-existent id throws/logs error gracefully
12. markFailed() with retryCount < 3 resets status to 'pending', increments retry_count
13. markFailed() with retryCount >= 3 leaves status as 'failed'
14. getQueueStats() returns correct counts for each status
15. getQueueStats() on empty DB returns all zeros
16. gcSessions(2) with 5 sessions deletes the 3 oldest + their queue rows
17. gcSessions() preserves all queue rows for kept sessions
18. gcSessions() on empty DB returns 0
19. closeQueue() closes DB connection — subsequent operations throw
20. concurrent enqueue from two openQueue() calls on same DB doesn't corrupt (WAL mode)
21. dequeue + markDone cycle: enqueue 3 → dequeue 3 → markDone all → getQueueStats shows 3 done
22. stale 'processing' items: items stuck in 'processing' for >5min are re-queued by dequeue (optional, stretch goal)
```

---

## Step 4: Add processQueue() to core

**Blocked by**: Step 2, Step 3
**Blocks**: Step 5

### What

Create `common/processor.ts` — the drain function that takes items off the queue and processes them through classify → dedup → save.

### API

```ts
export interface ProcessQueueOptions {
  batchSize?: number  // default: 5
  llmCallFn: (prompt: string) => Promise<{ text: string; usage: TokenUsage }>
  qmdSearchFn?: QmdSearchFn
  insightsRoot: string
  onItemDone?: (id: number, result: { savedCount: number; usage: TokenUsage }) => void
}

export async function processQueue(opts: ProcessQueueOptions): Promise<{
  processed: number
  saved: number
  skipped: number
  failed: number
}>
```

### Flow per item

1. `dequeue(batchSize)` — get pending items
2. For each item:
   a. `collectExistingTopics()` for the item's project
   b. `buildClassifyPrompt(project, existingTopics, conversation)`
   c. `llmCallFn(prompt)` → get response
   d. `parseClassification(response.text)`
   e. `processInsights(insights, insightsRoot, project, qmdSearchFn)`
   f. `trackTokenUsage(sessionId, project, usage, savedCount)`
3. On success: `markDone(id, { savedCount, usage })`
4. On failure: `markFailed(id, error.message, item.retryCount)`. If `retryCount >= 3`, leave as failed.

### Adapter injection

- **Claude MCP**: `llmCallFn` = Anthropic SDK → `claude-haiku-4-5`
- **Pi**: `llmCallFn` = pi-ai `completeSimple` or Vercel AI SDK with cheapest model

### Tests (`__tests__/processor.test.ts`)

```
1. processQueue() with empty queue returns { processed: 0, saved: 0, skipped: 0, failed: 0 }
2. processQueue() with 1 pending item calls llmCallFn once with correct prompt
3. processQueue() saves insight file to <insightsRoot>/<project>/<category>.md
4. processQueue() marks item as 'done' after successful processing
5. processQueue() tracks token usage via trackTokenUsage()
6. processQueue() with llmCallFn that throws marks item as 'failed'
7. processQueue() retries failed items (retryCount < 3) — they become 'pending' again
8. processQueue() permanently fails items with retryCount >= 3
9. processQueue() with batchSize=2 processes exactly 2 items when 5 are queued
10. processQueue() calls onItemDone callback for each processed item
11. processQueue() with qmdSearchFn deduplicates across projects
12. processQueue() without qmdSearchFn skips QMD dedup (no error)
13. processQueue() handles malformed LLM response (bad JSON) — marks failed, doesn't crash
14. processQueue() handles LLM response with all "none" classifications — marks done, savedCount=0
15. processQueue() end-to-end: enqueue conversation about Go patterns → mock LLM returns insight → verify file at <insightsRoot>/test-project/go.md contains entry
16. processQueue() dedup: enqueue same conversation twice → process both → second is deduped by file-level check
```

---

## Step 5: Build daemon (SSE server + lifecycle)

**Blocked by**: Step 4
**Blocks**: Step 6, Step 7

### What

Rewrite the MCP server from per-session stdio to a **long-lived SSE daemon**. Single process owns all state: SQLite queue, drain loop, logger, stats.

### Daemon lifecycle (`common/server/daemon.ts`)

```ts
const PORT = parseInt(process.env.MK_PORT || '7420', 10)
const PID_FILE = join(LOG_DIR, 'memory-keeper.pid')

export async function startDaemon(): Promise<void>
  // 1. Check PID file — if another daemon is running, exit
  // 2. Write PID file
  // 3. openQueue(), gcSessions(30)
  // 4. Start background drain loop (setInterval)
  // 5. Start HTTP server with SSE transport for MCP
  // 6. Expose /health endpoint (GET → { status, uptime, queueStats })
  // 7. Handle SIGTERM/SIGINT → graceful shutdown (flush queue, close DB, remove PID)

export function isRunning(): boolean
  // Read PID file, check process.kill(pid, 0)

export function stopDaemon(): void
  // Send SIGTERM to PID from file
```

### HTTP server (`common/server/index.ts` — rewritten)

```ts
import { createServer } from 'http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'

const httpServer = createServer(async (req, res) => {
  if (req.url === '/health') {
    // Return daemon health + queue stats + uptime
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), ...getQueueStats() }))
    return
  }
  if (req.url === '/sse') {
    // SSE transport for MCP — Claude Code connects here
    const transport = new SSEServerTransport('/messages', res)
    await mcpServer.connect(transport)
    return
  }
  if (req.method === 'POST' && req.url === '/messages') {
    // SSE message endpoint
    // handle incoming MCP messages
    return
  }
  res.writeHead(404).end()
})

httpServer.listen(PORT, '127.0.0.1')
```

### Background drain loop (in daemon startup)

```ts
// Runs every 30s, processes pending queue items
const DRAIN_INTERVAL_MS = 30_000

setInterval(async () => {
  const items = dequeue(5)
  if (items.length === 0) return
  await processQueue({
    batchSize: 5,
    llmCallFn: anthropicClassify,
    qmdSearchFn: qmdSearch,
    insightsRoot: config.insights_root!,
  })
}, DRAIN_INTERVAL_MS)
```

### MCP tools (same as before, but running in daemon)

| Tool | Purpose |
|---|---|
| `memory_context` | Project summary + topics + health banner |
| `memory_save` | Save single entry with dedup |
| `memory_extract` | Enqueue conversation → drain processes it |
| `memory_topics` | List topics per project |
| `memory_stats` | Token usage table |
| `memory_queue_stats` | Queue status: pending/done/failed |

### Auto-start script (`claude/bin/ensure-daemon.sh`)

```bash
#!/usr/bin/env bash
# Called by SessionStart hook — ensures daemon is running.
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$PLUGIN_ROOT/../common/server"
PID_FILE="$HOME/.claude/debug/memory-keeper.pid"
PORT="${MK_PORT:-7420}"

# Check if daemon is alive
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    # Already running — return health banner
    BANNER=$(curl -s "http://127.0.0.1:$PORT/health" 2>/dev/null)
    if [ -n "$BANNER" ]; then
      echo "{\"additionalContext\": \"memory-keeper daemon: running (pid=$PID) $BANNER\"}"
    else
      echo '{}'
    fi
    exit 0
  fi
fi

# Start daemon in background
cd "$SERVER_DIR" && nohup npx tsx daemon.ts > /dev/null 2>&1 &
sleep 1

# Return health banner from newly started daemon
BANNER=$(curl -s "http://127.0.0.1:$PORT/health" 2>/dev/null)
echo "{\"additionalContext\": \"memory-keeper daemon: started $BANNER\"}"
```

### Changes

- **DELETE**: `common/server/dist/` directory
- **REWRITE**: `common/server/index.ts` — SSE server instead of stdio
- **NEW**: `common/server/daemon.ts` — lifecycle management
- **EDIT**: `common/server/tsconfig.json` — keep for IDE only
- **EDIT**: `common/server/package.json` — remove tsc build, add deps if needed

### Tests

```
1. Daemon starts on configured port, writes PID file
2. /health returns { status: 'ok', uptime, pending, done, failed }
3. /sse establishes SSE connection (MCP handshake)
4. Second daemon start detects existing PID and exits
5. SIGTERM triggers graceful shutdown — PID file removed, DB closed
6. Drain loop processes queued items in background (enqueue → wait → verify done)
7. Daemon survives client disconnect (SSE connection drop)
8. ensure-daemon.sh starts daemon if not running, returns health banner
9. ensure-daemon.sh detects running daemon, returns health without restart
10. After daemon restart, queue state is preserved (SQLite durability)
```

---

## Step 6: Wire Claude adapter to daemon

**Blocked by**: Step 5
**Blocks**: Step 8

### What

Claude Code connects to the daemon via SSE. No per-session process spawning.

### Changes

**`claude/mcp.json`** — switch from stdio to SSE:

```json
{
  "mcpServers": {
    "memory": {
      "type": "sse",
      "url": "http://127.0.0.1:7420/sse"
    }
  }
}
```

**`claude/hooks/hooks.json`** — add SessionStart hook to ensure daemon + inject health:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/bin/memory-extract.sh",
            "timeout": 10000
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/bin/ensure-daemon.sh",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

**`claude/bin/memory-extract.sh`** — unchanged (still tells Claude to call `memory_extract` tool)

**`memory_context` tool** — appends `formatHealthBanner()` to response

### Delete from Claude adapter

- `common/server/dist/` — no more tsc build output
- No more per-session process spawning

### Tests

```
1. SessionStart hook starts daemon if not running — MCP tools available
2. mcp.json SSE connection succeeds — memory_context tool callable
3. memory_extract enqueues → daemon drain loop processes → insight file created
4. memory_stats returns formatted table from daemon
5. memory_queue_stats returns live daemon queue state
6. Stop hook → memory_extract → queue → background drain → insight saved
7. New session connects to existing daemon (no restart)
8. memory_context includes health banner in response
9. Multiple concurrent Claude sessions share same daemon
```

---

## Step 7: Wire Pi adapter to daemon

**Blocked by**: Step 5
**Blocks**: Step 8

### What

Pi adapter becomes an HTTP client to the daemon. Delegates classification, queue, stats to daemon. Keeps Pi-specific: conversation extraction, TUI, cursor, QMD tools.

### Pi → Daemon communication

Pi calls daemon HTTP endpoints (not importing core directly):

```ts
const DAEMON_URL = process.env.MK_DAEMON_URL || 'http://127.0.0.1:7420'

async function daemonPost(path: string, body: object): Promise<any> {
  const res = await fetch(`${DAEMON_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function daemonGet(path: string): Promise<any> {
  const res = await fetch(`${DAEMON_URL}${path}`)
  return res.json()
}
```

### Daemon HTTP API (beyond MCP/SSE)

Add REST endpoints to daemon for Pi (simpler than MCP for non-Claude clients):

```
POST /api/enqueue    { sessionId, project, conversation, source }  → { id }
GET  /api/stats      → formatted stats table
GET  /api/health     → { status, uptime, queueStats }
POST /api/save       { classification, topic, body, category, repo } → { file }
GET  /api/context?project=X  → project summary + health banner
```

### Delete from `pi/index.ts` (~500 lines)

- `CLASSIFY_PROMPT` — daemon handles classification
- `extractHeadings`, `wordOverlap`, `deduplicateCheck` — daemon handles dedup
- `saveInsight`, `qmdDedup` — daemon handles saving
- `loadConfig`, `detectProject`, `findProjectSummary`, `isExcluded` — keep `isExcluded` for fast local check, rest from daemon
- `processSessionDirect` — replaced by `daemonPost('/api/enqueue', ...)`
- `log`, `rotateLog`, all logging — daemon logs centrally
- `trackTokenUsage`, `trackQmdUsage`, `loadTokenStatsByDay` — daemon handles stats
- All dedup/save/classify types — daemon owns them

### Event handlers become HTTP calls

- `session_start`: ensure daemon running (curl health check, start if needed), restore cursor
- `before_agent_start`: `daemonGet('/api/context?project=X')` → inject into system prompt (includes health banner)
- `cronTick`: `extractConversationSlice()` → `daemonPost('/api/enqueue', { source: 'pi-cron', ... })`
- `session_shutdown`: `daemonPost('/api/enqueue', { source: 'pi-shutdown', ... })` — daemon drain loop handles the rest
- `/memory:process`: `daemonPost('/api/enqueue', { source: 'pi-manual', ... })`
- `/memory:stats`: `daemonGet('/api/stats')` → `ctx.ui.notify()`

### Keep Pi-specific

- `extractConversation`, `extractConversationSlice`, `extractEntryText` (Pi session format)
- `CURSOR_ENTRY_TYPE`, cursor management
- TUI rendering (`renderQmdCall`, `renderQmdResult`)
- QMD tool registrations (`qmd_search`, `qmd_query`, `qmd_get`)
- Command registrations (`/context`, `/memory:process`, `/memory:stats`)
- Workflow events (`PLUGIN_WORKFLOW_EVENTS`)
- `isExcluded` (fast local path check)

### Tests

```
1. Pi session_start checks daemon health — starts daemon if not running
2. cronTick posts to /api/enqueue — daemon processes in background
3. cronTick with no new entries is a no-op (no HTTP call)
4. session_shutdown enqueues remaining entries — daemon drains later
5. /memory:process posts to /api/enqueue — returns result from daemon
6. /memory:stats fetches from daemon /api/stats
7. before_agent_start fetches context from daemon (includes health banner)
8. Pi adapter line count reduced by 500+ lines vs before
9. Daemon down → Pi logs warning, continues without crash
10. Multiple Pi sessions can enqueue simultaneously without conflict
```

---

## Step 8: Update architecture skill + smoke test

**Blocked by**: Step 6, Step 7

### What

Update `skills/plugin-architecture/SKILL.md` to reflect daemon architecture. Run end-to-end smoke tests.

### Skill updates

- Daemon architecture diagram
- SSE transport for Claude Code, HTTP API for Pi
- Background drain loop (30s interval)
- Lifecycle: PID file, ensure-daemon.sh, graceful shutdown
- GC rules (30 sessions on startup)
- Unified pino logger (single log file, JSON, daemon-owned)

### End-to-end smoke tests (`__tests__/e2e.test.ts` — smoke section)

```
1. Daemon full lifecycle: start → serve requests → SIGTERM → graceful shutdown → restart
2. Claude full chain: SessionStart hook → daemon starts → SSE connect → Stop hook → memory_extract → enqueue → drain → insight file
3. Pi full chain: session_start → daemon health check → cron tick → enqueue → drain → insight file
4. Concurrent access: Claude + Pi sessions enqueue simultaneously → no errors, all processed
5. GC: create 35 fake sessions in DB → daemon startup gc → verify 5 oldest removed
6. Shared log: both Claude and Pi operations logged to single pino JSON file
7. DB integrity: after mixed operations, DB state is consistent
8. Daemon restart preserves queue: enqueue → kill daemon → restart → drain processes pending items
9. Health endpoint returns correct stats after operations
10. Stats consistency: trackTokenUsage from both sources → /api/stats aggregates correctly
```

---

## Manual Test Cases (Human Tester)

### Prerequisites

- Claude Code with memory-keeper plugin installed
- Pi agent with memory-keeper extension loaded
- `~/.claude/memory-keeper.local.md` configured with valid `insights_root`
- Daemon running on `localhost:7420` (or auto-started by SessionStart hook)
- Clean state: `rm -f ~/.claude/debug/memory-keeper.db ~/.claude/debug/memory-keeper.log ~/.claude/debug/memory-keeper.pid`

---

### MT-01: Claude Code — insight capture on session end

**Steps**:
1. Open Claude Code in a project directory
2. Have a technical conversation (e.g., "Explain how Go context cancellation works and when to use WithoutCancel")
3. Wait for Claude to respond with substantive content
4. Exit the session (Ctrl+C or `/exit`)

**Expected**:
- [ ] Stop hook fires — `memory-extract.sh` output visible in debug log
- [ ] `~/.claude/debug/memory-keeper.db` contains a row in `queue` table with `source='claude'`, `status='done'`
- [ ] `sessions` table has a row with matching `session_id`
- [ ] Insight file created at `<insights_root>/<project>/go.md` (or appropriate category)
- [ ] `~/.claude/debug/memory-keeper.log` has structured JSON lines (pino format) — not plain text
- [ ] `~/.claude/debug/token-stats.jsonl` has a new line with token counts

---

### MT-02: Claude Code — `/context save` manual save

**Steps**:
1. Open Claude Code
2. Discuss a topic: "better-sqlite3 requires Node rebuild when switching Node versions via nvm"
3. Type: `/context save better-sqlite3 native module requires rebuild on Node version switch`

**Expected**:
- [ ] Confirmation message: `Saved "..." to <path>`
- [ ] Entry appears in `<insights_root>/<project>/typescript.md` (or `tools.md`)
- [ ] Entry has keyword-rich heading and self-contained lead sentence
- [ ] DB queue table has a `status='done'` row for this save

---

### MT-03: Claude Code — `/context find` retrieval

**Steps**:
1. After MT-02, start a new Claude Code session
2. Type: `/context find better-sqlite3`

**Expected**:
- [ ] Returns the entry saved in MT-02
- [ ] Shows project/file context
- [ ] QMD search results displayed (if QMD indexed)

---

### MT-04: Claude Code — `memory_stats` shows table

**Steps**:
1. After MT-01 and MT-02, ask Claude: "show memory keeper stats"
2. Claude should call `memory_stats` MCP tool

**Expected**:
- [ ] Table displayed with columns: `#  Date  Sessions  Tokens  Insights`
- [ ] Today's date row shows correct session count and token totals
- [ ] Latest day marked with `◀`
- [ ] Totals row at bottom sums correctly

---

### MT-05: Claude Code — `memory_queue_stats` tool

**Steps**:
1. Ask Claude: "show the memory queue status"

**Expected**:
- [ ] Returns counts: `pending`, `processing`, `done`, `failed`, `total`
- [ ] `done` count matches number of successfully processed items from previous tests
- [ ] `pending` is 0 (nothing stuck)
- [ ] `failed` is 0 (no errors)

---

### MT-06: Pi — cron extraction during session

**Steps**:
1. Start Pi agent session in a project directory
2. Have a 5+ minute conversation with substantive technical content
3. Wait for at least one cron tick (3 minutes)

**Expected**:
- [ ] Log entry: `INFO [cron] Processing entries [0..N)` in `memory-keeper.log`
- [ ] DB `queue` table: row with `source='pi-cron'`, `status='done'`
- [ ] Insight file created in `<insights_root>/<project>/`
- [ ] Log shows token usage: `saved=N tokens=N`

---

### MT-07: Pi — shutdown flush

**Steps**:
1. Start Pi session, have a brief conversation (< 3 min, so cron hasn't fired)
2. Exit with Ctrl+C (double) or `/quit`

**Expected**:
- [ ] Terminal shows: `⏳ memory-keeper: saving insights for [<project>]...`
- [ ] Then: `✓ memory-keeper: N insight(s) saved (N tokens)`
- [ ] DB `queue` table: row with `source='pi-shutdown'`, `status='done'`
- [ ] Insight file created

---

### MT-08: Pi — `/memory:process` manual trigger

**Steps**:
1. Start Pi session, have a conversation
2. Type: `/memory:process`

**Expected**:
- [ ] Notification: `Processing entries [N..M) for project: <name>...`
- [ ] Then: `Done — N insight(s) saved · N tokens`
- [ ] DB: row with `source='pi-manual'`, `status='done'`
- [ ] Running `/memory:process` again immediately shows: `Nothing new to process since last run`

---

### MT-09: Pi — `/memory:stats` display

**Steps**:
1. After several Pi sessions with insight capture
2. Type: `/memory:stats`

**Expected**:
- [ ] Table identical in format to Claude's `memory_stats` output
- [ ] Includes data from both Pi and Claude sessions (shared stats file)
- [ ] Type: `/memory:stats 1` — shows detail for the latest day
- [ ] Detail includes: date, sessions, total/input/output tokens, insights saved

---

### MT-10: Deduplication — same insight not saved twice

**Steps**:
1. In Claude Code, discuss "Go context cancellation propagates through goroutine tree"
2. Exit session → insight saved
3. Start new session, discuss the same topic with slightly different wording
4. Exit session

**Expected**:
- [ ] First session: insight saved to `<insights_root>/<project>/go.md`
- [ ] Second session: log shows `DEDUP skipped` or `QMD-DEDUP skipped`
- [ ] Only one entry in the target file, not two
- [ ] DB: second queue item is `status='done'` but with `savedCount=0`

---

### MT-11: Deduplication — cross-project "See also" links

**Steps**:
1. Save an insight about "K8s pod scheduling" in project A
2. In project B, discuss a related K8s topic
3. Let the insight be captured

**Expected**:
- [ ] Second insight saved with `**See also**: [[project-a/k8s.md|...]]` appended
- [ ] Original insight in project A unchanged

---

### MT-12: GC — old sessions cleaned up

**Steps**:
1. Check current session count: `sqlite3 ~/.claude/debug/memory-keeper.db "SELECT COUNT(*) FROM sessions;"`
2. If < 30 sessions, create fakes: insert dummy rows with old `last_seen` dates
3. Restart Claude Code or Pi (triggers `gcSessions(30)` on startup)

**Expected**:
- [ ] Sessions table has exactly 30 rows (or fewer if started with fewer)
- [ ] Oldest sessions deleted first (by `last_seen`)
- [ ] Queue rows for deleted sessions are also gone
- [ ] Log entry: `gcSessions deleted N sessions`

---

### MT-13: Shared log — both adapters write to same file

**Steps**:
1. Use Claude Code — trigger an insight capture
2. Use Pi — trigger a cron tick or `/memory:process`
3. Read `~/.claude/debug/memory-keeper.log`

**Expected**:
- [ ] Single file, not two separate files
- [ ] Each line is valid JSON (pino format)
- [ ] Lines from Claude have identifiable source (e.g., `"component":"mcp"`)
- [ ] Lines from Pi have identifiable source (e.g., `"component":"pi"`)
- [ ] No plain-text `YYYY-MM-DD HH:MM:SS` format lines (old format gone)

---

### MT-14: Excluded paths — memory-keeper disabled

**Steps**:
1. Add `exclude_paths: ~/Documents/git/mil/tasks/**` to `~/.claude/memory-keeper.local.md`
2. Start Claude Code or Pi in `~/Documents/git/mil/tasks/some-task`
3. Have a conversation and exit

**Expected**:
- [ ] Log: `cwd excluded by exclude_paths — memory-keeper disabled`
- [ ] No queue rows created for this session
- [ ] No insight files created

---

### MT-15: No insights_root configured — graceful error

**Steps**:
1. Temporarily remove `insights_root` from `~/.claude/memory-keeper.local.md`
2. Start Claude Code, trigger insight capture
3. Start Pi, type `/memory:process`

**Expected**:
- [ ] Claude: MCP tool returns `"Error: no insights_root configured."`
- [ ] Pi: notification `"No insights_root configured in ~/.claude/memory-keeper.local.md"`
- [ ] No crash, no unhandled exception
- [ ] Restore config after test

---

### MT-16: Daemon cold start and lifecycle

**Steps**:
1. Kill any running daemon: `kill $(cat ~/.claude/debug/memory-keeper.pid) 2>/dev/null`
2. Start daemon: `npx tsx common/server/daemon.ts &`
3. Check health: `curl http://127.0.0.1:7420/health`
4. Check PID file: `cat ~/.claude/debug/memory-keeper.pid`
5. Send SIGTERM: `kill $(cat ~/.claude/debug/memory-keeper.pid)`

**Expected**:
- [ ] Daemon starts in < 3 seconds
- [ ] `/health` returns JSON with `status: "ok"`, `uptime`, queue stats
- [ ] PID file exists and matches running process
- [ ] SIGTERM triggers graceful shutdown — PID file removed
- [ ] Second `npx tsx daemon.ts` detects running daemon and exits
- [ ] Claude Code connects via SSE after daemon starts

---

### MT-17: Pi adapter size reduction + HTTP client

**Steps**:
1. Before refactor: `wc -l pi/index.ts` (should be ~1430 lines)
2. After refactor: `wc -l pi/index.ts`
3. Start Pi session, trigger `/memory:process`

**Expected**:
- [ ] Line count reduced by 500+ lines
- [ ] Pi communicates with daemon via HTTP (no direct core imports)
- [ ] All Pi-specific functionality still works (commands, tools, TUI, cron, shutdown)
- [ ] No TypeScript compilation errors

---

### MT-18: `/context check` — mid-session insight scan

**Steps**:
1. In Claude Code, have a productive debugging session
2. Type: `/context check`

**Expected**:
- [ ] Conversation scanned, entries classified
- [ ] Insights saved immediately (no confirmation prompt)
- [ ] Report: topic + classification + file saved to
- [ ] Queue rows created with `source='claude'`
- [ ] Dedup works — running `/context check` again doesn't duplicate

---

### MT-19: Daemon crash recovery

**Steps**:
1. Enqueue some items via Pi or Claude
2. Force-kill daemon: `kill -9 $(cat ~/.claude/debug/memory-keeper.pid)`
3. Start a new Claude Code or Pi session (triggers ensure-daemon.sh)

**Expected**:
- [ ] Daemon auto-restarts via ensure-daemon.sh
- [ ] DB not corrupted — `openQueue()` succeeds
- [ ] Pending items from before crash are picked up by drain loop
- [ ] PID file updated with new process ID
- [ ] Health endpoint returns fresh stats

---

### MT-20: Claude Code — health banner on session start (daemon)

**Steps**:
1. Ensure daemon is running with previous session data
2. Start a new Claude Code session

**Expected**:
- [ ] SessionStart hook runs `ensure-daemon.sh`
- [ ] Daemon already running → hook returns health banner (no restart)
- [ ] Banner contains: daemon status, insights today, token usage, queue status
- [ ] Format: `memory-keeper daemon: running (pid=N) · N insights today · Nk tokens · queue: 0 pending`
- [ ] No delay — banner appears within 1-2s (daemon already warm)

---

### MT-21: Pi — health banner on session start

**Steps**:
1. Ensure you have previous sessions with saved insights
2. Start a new Pi session

**Expected**:
- [ ] Health banner injected into system prompt (visible in agent context)
- [ ] Same format as Claude Code banner
- [ ] Agent can reference the health info if asked "how's memory-keeper doing?"

---

### MT-22: Health banner — first session (no history)

**Steps**:
1. Clean state: `rm -f ~/.claude/debug/memory-keeper.db ~/.claude/debug/token-stats.jsonl`
2. Start Claude Code or Pi session

**Expected**:
- [ ] Banner shows: `memory-keeper: ✗ no stats yet — first session?`
- [ ] No crash, no error in logs
- [ ] Plugin still functions normally (captures insights on exit)

---

### MT-23: Health banner — degraded state (failed queue items)

**Steps**:
1. Manually insert a failed queue item:
   ```sql
   sqlite3 ~/.claude/debug/memory-keeper.db \
     "INSERT INTO queue (session_id, project, conversation, source, status, retry_count) \
      VALUES ('test-fail', 'test', 'test conv', 'claude', 'failed', 3);"
   ```
2. Start a new Claude Code or Pi session

**Expected**:
- [ ] Banner shows: `memory-keeper: ⚠ 1 failed in queue · ...`
- [ ] Warning indicator `⚠` is visible
- [ ] After manual cleanup (`DELETE FROM queue WHERE status='failed'`), next session shows clean banner

---

### MT-24: Health banner — token formatting

**Steps**:
1. Run several sessions to accumulate tokens
2. Start new session, observe banner

**Expected**:
- [ ] Tokens < 1000 shown as raw number: `850 tokens`
- [ ] Tokens 1000-999999 shown as `1.2k tokens`, `15.3k tokens`
- [ ] Tokens >= 1M shown as `1.1M tokens` (if applicable)

---

### MT-25: Concurrent access — Pi and Claude share daemon

**Steps**:
1. Ensure daemon is running
2. Start Pi session in terminal A
3. Start Claude Code session in terminal B (same project)
4. Have conversations in both simultaneously
5. Trigger `/memory:process` in Pi and let Claude's Stop hook fire

**Expected**:
- [ ] Both sessions connect to the same daemon (single PID)
- [ ] No SQLite errors — daemon owns DB exclusively
- [ ] Both sessions' queue items processed by single drain loop
- [ ] `/health` shows combined stats from both sources
- [ ] Log entries from both sources in single pino JSON file
- [ ] Pi disconnect doesn't affect Claude's SSE connection (and vice versa)

**Steps**:
1. Start Pi session in terminal A
2. Start Claude Code session in terminal B (same project)
3. Have conversations in both simultaneously
4. Trigger `/memory:process` in Pi and let Claude's Stop hook fire

**Expected**:
- [ ] No SQLite "database is locked" errors
- [ ] Both sessions create queue rows successfully
- [ ] Both sessions' insights saved to correct files
- [ ] Stats reflect activity from both sources
- [ ] Log entries interleaved but not corrupted

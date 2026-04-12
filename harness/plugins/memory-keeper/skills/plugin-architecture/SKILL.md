---
name: plugin-architecture
description: Architecture reference for the memory-keeper plugin. Covers the daemon-based architecture, two-adapter pattern (Claude Code SSE + Pi HTTP), queue-based async processing, and unified core library. Use when onboarding, debugging capture issues, or planning changes.
---

# Memory-Keeper Plugin Architecture

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│            memory-keeper daemon                   │
│  (single long-lived process on localhost:7420)    │
│                                                   │
│  ┌─────────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ MCP server   │  │ Queue    │  │ Drain loop  │ │
│  │ (SSE/HTTP)   │  │ (SQLite) │  │ (30s cycle) │ │
│  └──────┬───────┘  └────┬─────┘  └──────┬──────┘ │
│         │               │               │         │
│  ┌──────┴───────────────┴───────────────┴──────┐ │
│  │              Core library                    │ │
│  │  classify, dedup, save, stats, logger        │ │
│  └──────────────────────────────────────────────┘ │
└──────────┬─────────────────────────┬──────────────┘
           │ SSE (MCP)              │ HTTP REST
    ┌──────┴──────┐          ┌──────┴──────┐
    │ Claude Code │          │ Pi agent    │
    │ (MCP client)│          │ (HTTP calls)│
    └─────────────┘          └─────────────┘
```

**Key principle**: single daemon process owns all state (SQLite DB, queue, drain loop, logger, stats). Both Claude Code and Pi are thin clients.

## Project Layout

```
memory-keeper/
├── common/                        # Shared core — pure TS, zero framework deps
│   ├── memory.ts                  # Business logic: config, classify, dedup, save, stats
│   ├── logger.ts                  # pino logger (JSON, file dest, rotation)
│   ├── queue.ts                   # SQLite queue (better-sqlite3, WAL mode)
│   ├── processor.ts               # processQueue() drain function
│   ├── index.ts                   # Re-exports
│   └── server/
│       ├── daemon.ts              # SSE daemon: HTTP server + MCP + drain loop + PID lifecycle
│       ├── index.ts               # Legacy stdio MCP server (kept for fallback)
│       └── package.json
├── claude/                        # Claude Code plugin package
│   ├── .claude-plugin/plugin.json
│   ├── agents/context-keeper.md
│   ├── bin/memory-extract.sh      # Stop hook → tells Claude to call memory_extract
│   ├── bin/ensure-daemon.sh       # SessionStart hook → auto-start daemon + health banner
│   ├── hooks/hooks.json           # Stop + SessionStart hooks
│   ├── mcp.json                   # SSE connection to daemon (type: sse, url: localhost:7420/sse)
│   └── skills/
├── pi/                            # Pi agent adapter (thin HTTP client)
│   └── index.ts                   # Extension: cron, cursor, TUI, QMD tools, daemon HTTP calls
├── skills/                        # Shared skill definitions
├── __tests__/                     # Test suite
│   ├── stats.test.ts              # 13 tests: formatStatsTable, health banner, QMD tracking
│   ├── queue.test.ts              # 18 tests: enqueue/dequeue/markDone/markFailed/gcSessions
│   └── processor.test.ts          # 12 tests: processQueue drain function
└── package.json
```

## Daemon (localhost:7420)

Single long-lived process started via `ensure-daemon.sh` or manually with `npx tsx daemon.ts`.

### Endpoints

| Endpoint | Method | Purpose | Used by |
|---|---|---|---|
| `/sse` | GET | SSE transport for MCP | Claude Code |
| `/messages` | POST | MCP message relay | Claude Code |
| `/health` | GET | JSON: status, uptime, queue stats, banner | Both |
| `/api/enqueue` | POST | Enqueue conversation for processing | Pi |
| `/api/stats` | GET | Formatted stats table (text) | Pi |
| `/api/health-banner` | GET | One-line health banner (text) | Pi |
| `/api/context` | GET | Project summary + topics (text) | Pi |
| `/api/queue-stats` | GET | Queue counts (JSON) | Pi |
| `/api/track-qmd` | POST | Track QMD tool usage | Pi |

### MCP Tools

| Tool | Purpose |
|---|---|
| `memory_context` | Project summary + topics + health banner |
| `memory_save` | Save single entry with dedup |
| `memory_extract` | Enqueue conversation for async processing |
| `memory_topics` | List topics per project |
| `memory_stats` | Token usage stats by day (with detail drill-down) |
| `memory_queue_stats` | Queue status: pending/processing/done/failed |

### Lifecycle

1. `ensure-daemon.sh` (SessionStart hook) checks PID file
2. If daemon running → return health banner
3. If not → start `npx tsx daemon.ts` in background
4. Daemon writes PID to `~/.claude/debug/memory-keeper.pid`
5. On startup: `openQueue()`, `gcSessions(30)`, start drain loop
6. On SIGTERM/SIGINT: stop drain loop, close DB, remove PID file

### Background Drain Loop

Every 30 seconds, `processQueue()` dequeues pending items and runs:
1. `collectExistingTopics()` → `buildClassifyPrompt()`
2. `llmCallFn()` → Anthropic API (claude-haiku-4-5)
3. `parseClassification()` → `processInsights()` (QMD + file dedup)
4. `trackTokenUsage()` → `markDone()`
5. Failed items retry up to 3 times, then permanently fail

## Two-Adapter Pattern

| | **Claude Code** | **Pi** |
|---|---|---|
| Transport | SSE (MCP protocol) | HTTP REST |
| Connection | `mcp.json` → `http://127.0.0.1:7420/sse` | `fetch()` to daemon endpoints |
| Extraction trigger | Stop hook → `memory_extract` tool | Cron (3 min) + shutdown |
| Processing | Daemon enqueues, drain loop processes | Same (via `/api/enqueue`) |
| LLM | Daemon owns (Anthropic SDK) | Daemon owns |
| Context injection | `memory_context` tool | `before_agent_start` → `/api/context` |
| Health | `memory_context` includes banner | `/api/health-banner` |

## SQLite Queue

Database: `~/.claude/debug/memory-keeper.db` (WAL mode)

### Tables

- **queue**: id, session_id, project, conversation, source, status (pending/processing/done/failed), error, retry_count, created_at, processed_at
- **sessions**: session_id, project, source, first_seen, last_seen, total_enqueued

### GC Rule

`gcSessions(30)` on daemon startup — keeps 30 most recent sessions by `last_seen`, deletes older sessions + their queue rows.

## Logging

Unified pino logger → `~/.claude/debug/memory-keeper.log`

| Component | Used by |
|---|---|
| `core` | `common/memory.ts` |
| `queue` | `common/queue.ts` |
| `drain` | `common/processor.ts` |
| `daemon` | `common/server/daemon.ts` |

JSON format, manual rotation (512KB, 3 files). Level: `MK_LOG_LEVEL` env (default: info).

## Health Banner

Compact one-liner shown on session start:

```
memory-keeper: 3 insights today · 1.2k tokens · queue: 0 pending · 42 sessions tracked
```

Degraded states:
- `⚠ 5 failed in queue` — failures highlighted first
- `✗ no stats yet — first session?` — no data

## Deduplication Layers

| Layer | Description |
|---|---|
| **Prompt-level** | Existing topic headings injected into LLM prompt |
| **QMD semantic** | `qmd search` CLI, score >= 0.7 same-project = skip |
| **File-level** | Heading substring + word overlap >= 0.7 |

## Data Flow

1. Conversation text enqueued (Claude: `memory_extract` tool; Pi: `/api/enqueue`)
2. Drain loop dequeues → `buildClassifyPrompt()` with existing topics
3. LLM classifies → JSON array of `{classification, category, repo, topic, body}`
4. `parseClassification()` — handles truncated JSON, filters out `none`
5. `processInsights()` — per entry: QMD dedup → file dedup → `saveInsight()`
6. `saveInsight()` routes by classification:
   - `insight` → `<insights_root>/<repo>/<category>.md`
   - `agent_edit` → `<insights_root>/claude-config/behavior.md`
7. `trackTokenUsage()` → `~/.claude/debug/token-stats.jsonl`

## Config

`~/.claude/memory-keeper.local.md` YAML frontmatter:

| Key | Purpose | Default |
|---|---|---|
| `insights_root` | Root directory for all insights | required |
| `exclude_paths` | Comma-separated glob patterns to skip | none |

Daemon-level env vars:

| Var | Purpose | Default |
|---|---|---|
| `MK_PORT` | Daemon port | `7420` |
| `MK_LOG_LEVEL` | pino log level | `info` |
| `MK_DAEMON_URL` | Pi: daemon base URL | `http://127.0.0.1:7420` |
| `ANTHROPIC_API_KEY` | Required for LLM classification | from env |

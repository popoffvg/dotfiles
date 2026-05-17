#!/usr/bin/env node
// MCP server exposing the memory-keeper session queue (SQLite).
// Tools: queue_status, queue_list, queue_retry, queue_get, queue_process,
// plus Pi-style aliases: memory_stats, memory_queue_stats.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getDb } from "../lib/db.mjs";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const server = new McpServer({
  name: "memory-keeper-queue",
  version: "0.2.0",
});

const NODE_BIN = process.env.MEM_KEEPER_NODE_BIN || "/Users/popoffvg/.local/share/mise/installs/node/20.19.3/bin/node";

const STATS_FILE = join(homedir(), ".claude", "debug", "memory-keeper-stats.json");

function hasStatusColumn(db) {
  try {
    const cols = db.prepare("PRAGMA table_info(sessions)").all();
    return cols.some((c) => c.name === "status");
  } catch {
    return false;
  }
}

// --- queue_status: counts by status ---
server.tool("queue_status", "Show session queue counts by status", {}, async () => {
  const db = getDb();
  try {
    const withStatus = hasStatusColumn(db);
    const rows = withStatus
      ? db.prepare("SELECT status, COUNT(*) as count FROM sessions GROUP BY status ORDER BY status").all()
      : [];
    const total = withStatus
      ? rows.reduce((s, r) => s + r.count, 0)
      : db.prepare("SELECT COUNT(*) as count FROM sessions").get().count;
    const today = db
      .prepare("SELECT COUNT(*) as count FROM sessions WHERE date(created_at) = date('now')")
      .get();
    const todayDone = withStatus
      ? db.prepare("SELECT COUNT(*) as count FROM sessions WHERE date(created_at) = date('now') AND status = 'done'").get()
      : { count: 0 };

    const lines = [
      `**Queue status** (total: ${total})`,
      ...(withStatus ? rows.map((r) => `- ${r.status}: ${r.count}`) : ["- status column missing (legacy DB schema)"]),
      "",
      `**Today**: ${today.count} captured, ${todayDone.count} processed`,
    ];
    return { content: [{ type: "text", text: lines.join("\n") }] };
  } finally {
    db.close();
  }
});

// --- queue_list: list sessions with optional status filter ---
server.tool(
  "queue_list",
  "List sessions in the queue with optional status filter",
  {
    status: z.enum(["pending", "processing", "done", "skipped", "error", "dropped"]).optional().describe("Filter by status"),
    limit: z.number().default(20).describe("Max results"),
    today_only: z.boolean().default(false).describe("Only show today's sessions"),
  },
  async ({ status, limit, today_only }) => {
    const db = getDb();
    try {
      let sql = "SELECT id, session_id, project, status, classification, insight_text, error_message, created_at, processed_at FROM sessions";
      const conditions = [];
      const params = [];

      if (status) {
        conditions.push("status = ?");
        params.push(status);
      }
      if (today_only) {
        conditions.push("date(created_at) = date('now')");
      }
      if (conditions.length) {
        sql += " WHERE " + conditions.join(" AND ");
      }
      sql += " ORDER BY created_at DESC LIMIT ?";
      params.push(limit);

      const rows = db.prepare(sql).all(...params);

      if (rows.length === 0) {
        return { content: [{ type: "text", text: "No sessions found." }] };
      }

      const lines = rows.map((r) => {
        let line = `**#${r.id}** [${r.status}] ${r.project} — ${r.created_at}`;
        if (r.classification) line += ` (${r.classification})`;
        if (r.insight_text) line += `\n  → ${r.insight_text}`;
        if (r.error_message) line += `\n  ⚠ ${r.error_message}`;
        return line;
      });

      return { content: [{ type: "text", text: lines.join("\n\n") }] };
    } finally {
      db.close();
    }
  }
);

// --- queue_get: get full details of a session ---
server.tool(
  "queue_get",
  "Get full details of a session including conversation text",
  {
    id: z.number().describe("Session row ID"),
  },
  async ({ id }) => {
    const db = getDb();
    try {
      const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
      if (!row) {
        return { content: [{ type: "text", text: `Session #${id} not found.` }] };
      }

      const lines = [
        `# Session #${row.id}`,
        `- **Session ID**: ${row.session_id}`,
        `- **Project**: ${row.project}`,
        `- **CWD**: ${row.cwd}`,
        `- **Status**: ${row.status}`,
        `- **Classification**: ${row.classification || "—"}`,
        `- **Created**: ${row.created_at}`,
        `- **Processed**: ${row.processed_at || "—"}`,
        "",
      ];

      if (row.insight_text) {
        lines.push(`## Insight`, row.insight_text, "");
      }
      if (row.error_message) {
        lines.push(`## Error`, row.error_message, "");
      }
      if (row.conversation) {
        lines.push(`## Conversation (truncated)`, row.conversation.slice(0, 4000));
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    } finally {
      db.close();
    }
  }
);

// --- queue_retry: reset error/skipped sessions back to pending ---
server.tool(
  "queue_retry",
  "Reset error or skipped sessions back to pending for reprocessing",
  {
    id: z.number().optional().describe("Specific session ID to retry"),
    status: z.enum(["error", "skipped"]).optional().describe("Retry all sessions with this status"),
  },
  async ({ id, status }) => {
    const db = getDb();
    try {
      let result;
      if (id) {
        result = db
          .prepare("UPDATE sessions SET status = 'pending', error_message = NULL, processed_at = NULL WHERE id = ? AND status IN ('error', 'skipped')")
          .run(id);
      } else if (status) {
        result = db
          .prepare("UPDATE sessions SET status = 'pending', error_message = NULL, processed_at = NULL WHERE status = ?")
          .run(status);
      } else {
        return { content: [{ type: "text", text: "Provide either `id` or `status` to retry." }] };
      }

      return {
        content: [{ type: "text", text: `Reset ${result.changes} session(s) to pending.` }],
      };
    } finally {
      db.close();
    }
  }
);

// --- queue_process: trigger the background worker ---
server.tool(
  "queue_process",
  "Trigger the background worker to process pending sessions now",
  {},
  async () => {
    const { spawn } = await import("child_process");
    const { fileURLToPath } = await import("url");
    const { dirname, join } = await import("path");

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const workerPath = join(__dirname, "..", "worker", "process-sessions.mjs");

    const child = spawn(NODE_BIN, [workerPath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return {
      content: [{ type: "text", text: "Worker spawned. Check queue_status in a few seconds for results." }],
    };
  }
);

// --- memory_stats: Pi-style alias for quick stats report ---
server.tool(
  "memory_stats",
  "Show memory-keeper stats report (Pi-style command parity).",
  {},
  async () => {
    const db = getDb();
    try {
      const withStatus = hasStatusColumn(db);
      const rows = withStatus
        ? db.prepare("SELECT status, COUNT(*) as count FROM sessions GROUP BY status ORDER BY status").all()
        : [];
      const total = withStatus
        ? rows.reduce((s, r) => s + r.count, 0)
        : db.prepare("SELECT COUNT(*) as count FROM sessions").get().count;
      const today = db
        .prepare("SELECT COUNT(*) as count FROM sessions WHERE date(created_at) = date('now')")
        .get();
      const todayDone = withStatus
        ? db.prepare("SELECT COUNT(*) as count FROM sessions WHERE date(created_at) = date('now') AND status = 'done'").get()
        : { count: 0 };

      let persisted = null;
      if (existsSync(STATS_FILE)) {
        try {
          persisted = JSON.parse(readFileSync(STATS_FILE, "utf8"));
        } catch {}
      }

      const lines = [
        "Memory Keeper Stats",
        "",
        `Queue total : ${total}`,
        ...(withStatus ? rows.map((r) => `${r.status.padEnd(10)}: ${r.count}`) : ["status    : unavailable (legacy DB schema)"]),
        "",
        `Today       : ${today.count} captured, ${todayDone.count} processed`,
      ];

      if (persisted?.updated_at) {
        lines.push(`Last update : ${persisted.updated_at}`);
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    } finally {
      db.close();
    }
  }
);

// --- memory_queue_stats: Pi-style alias for queue_status ---
server.tool(
  "memory_queue_stats",
  "Show queue status counts (Pi-style alias).",
  {},
  async () => {
    const db = getDb();
    try {
      const withStatus = hasStatusColumn(db);
      const rows = withStatus
        ? db.prepare("SELECT status, COUNT(*) as count FROM sessions GROUP BY status ORDER BY status").all()
        : [];
      const total = withStatus
        ? rows.reduce((s, r) => s + r.count, 0)
        : db.prepare("SELECT COUNT(*) as count FROM sessions").get().count;
      const lines = [
        "Queue Status",
        ...(withStatus ? rows.map((r) => `  ${r.status.padEnd(10)}: ${r.count}`) : ["  status    : unavailable (legacy DB schema)"]),
        `  total      : ${total}`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    } finally {
      db.close();
    }
  }
);

// Start
const transport = new StdioServerTransport();
await server.connect(transport);

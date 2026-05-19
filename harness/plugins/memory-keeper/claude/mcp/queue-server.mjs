#!/usr/bin/env node
// MCP server exposing the memory-keeper event queue (filesystem-backed).
// Tools: queue_status, queue_list, queue_retry, queue_get, queue_process,
// plus aliases: memory_stats, memory_queue_stats.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, readdirSync, existsSync, renameSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { PENDING_DIR, PROCESSING_DIR, FAILED_DIR, stats, ensureDirs } from "../lib/queue.mjs";
import { ensureDaemon, daemonRunning } from "../lib/daemon-control.mjs";

const server = new McpServer({
  name: "memory-keeper-queue",
  version: "0.3.0",
});

const STATS_FILE = join(homedir(), ".claude", "debug", "memory-keeper-stats.json");

const STATE_DIRS = {
  pending: PENDING_DIR,
  processing: PROCESSING_DIR,
  failed: FAILED_DIR,
};

function listDir(state, { limit = Infinity, today_only = false } = {}) {
  ensureDirs();
  const dir = STATE_DIRS[state];
  let names;
  try { names = readdirSync(dir).filter((f) => f.endsWith(".json")); } catch { return []; }
  names.sort().reverse(); // newest first

  const today = new Date().toISOString().slice(0, 10);
  const results = [];
  for (const name of names) {
    if (results.length >= limit) break;
    const path = join(dir, name);
    try {
      const ev = JSON.parse(readFileSync(path, "utf8"));
      if (today_only) {
        const createdDay = (ev.created_at || "").slice(0, 10);
        if (createdDay !== today) continue;
      }
      results.push({ state, path, event: ev });
    } catch {}
  }
  return results;
}

function findById(id) {
  for (const state of Object.keys(STATE_DIRS)) {
    const path = join(STATE_DIRS[state], `${id}.json`);
    if (existsSync(path)) {
      try { return { state, path, event: JSON.parse(readFileSync(path, "utf8")) }; } catch {}
    }
  }
  return null;
}

// --- queue_status ---
server.tool("queue_status", "Show event queue counts by state", {}, async () => {
  const s = stats();
  const total = s.pending + s.processing + s.failed;

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = (state) => listDir(state, { today_only: true }).length;
  const todayTotal = todayCount("pending") + todayCount("processing") + todayCount("failed");

  const lines = [
    `**Queue status** (total: ${total})`,
    `- pending: ${s.pending}`,
    `- processing: ${s.processing}`,
    `- failed: ${s.failed}`,
    "",
    `**Daemon**: ${daemonRunning() ? "running" : "stopped"}`,
    `**Today (${today})**: ${todayTotal} events`,
  ];
  return { content: [{ type: "text", text: lines.join("\n") }] };
});

// --- queue_list ---
server.tool(
  "queue_list",
  "List events with optional state filter",
  {
    state: z.enum(["pending", "processing", "failed"]).optional().describe("Filter by state"),
    limit: z.number().default(20).describe("Max results"),
    today_only: z.boolean().default(false).describe("Only show today's events"),
  },
  async ({ state, limit, today_only }) => {
    const states = state ? [state] : ["pending", "processing", "failed"];
    const all = states.flatMap((s) => listDir(s, { limit, today_only }));
    all.sort((a, b) => (b.event.created_at || "").localeCompare(a.event.created_at || ""));
    const rows = all.slice(0, limit);

    if (rows.length === 0) return { content: [{ type: "text", text: "No events found." }] };

    const lines = rows.map(({ state, event }) => {
      let line = `**${event.id}** [${state}] ${event.event_type} ${event.project || ""} — ${event.created_at}`;
      if (event.retry_count) line += ` (retry=${event.retry_count})`;
      if (event.error_message) line += `\n  ⚠ ${event.error_message}`;
      return line;
    });
    return { content: [{ type: "text", text: lines.join("\n\n") }] };
  }
);

// --- queue_get ---
server.tool(
  "queue_get",
  "Get full details of an event by id",
  { id: z.string().describe("Event id (e.g. 1779023770762-d70890)") },
  async ({ id }) => {
    const hit = findById(id);
    if (!hit) return { content: [{ type: "text", text: `Event ${id} not found.` }] };
    const { state, event } = hit;

    const lines = [
      `# Event ${event.id}`,
      `- **State**: ${state}`,
      `- **Type**: ${event.event_type}`,
      `- **Session ID**: ${event.session_id ?? "—"}`,
      `- **Project**: ${event.project ?? "—"}`,
      `- **CWD**: ${event.cwd ?? "—"}`,
      `- **Created**: ${event.created_at}`,
      `- **Retry**: ${event.retry_count ?? 0}`,
      "",
    ];
    if (event.error_message) lines.push(`## Error`, event.error_message, "");
    if (event.payload) lines.push(`## Payload (truncated to 4000 chars)`, String(event.payload).slice(0, 4000));

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// --- queue_retry ---
server.tool(
  "queue_retry",
  "Move failed events back to pending. Provide either `id` or `all=true`.",
  {
    id: z.string().optional().describe("Specific event id to retry"),
    all: z.boolean().default(false).describe("Retry every failed event"),
  },
  async ({ id, all }) => {
    if (!id && !all) {
      return { content: [{ type: "text", text: "Provide `id` or `all: true`." }] };
    }
    ensureDirs();

    const move = (name) => {
      const src = join(FAILED_DIR, name);
      const dst = join(PENDING_DIR, name);
      try {
        const ev = JSON.parse(readFileSync(src, "utf8"));
        ev.retry_count = 0;
        ev.error_message = null;
        writeFileSync(src, JSON.stringify(ev, null, 2));
        renameSync(src, dst);
        return true;
      } catch {
        return false;
      }
    };

    let moved = 0;
    if (id) {
      const name = `${id}.json`;
      if (existsSync(join(FAILED_DIR, name)) && move(name)) moved = 1;
    } else {
      const names = readdirSync(FAILED_DIR).filter((f) => f.endsWith(".json"));
      for (const n of names) if (move(n)) moved++;
    }
    return { content: [{ type: "text", text: `Reset ${moved} event(s) to pending.` }] };
  }
);

// --- queue_process: ensure daemon is alive (will drain pending immediately) ---
server.tool("queue_process", "Ensure the background daemon is running to drain pending events", {}, async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const daemonPath = join(__dirname, "..", "worker", "daemon.mjs");
  const r = ensureDaemon(daemonPath);
  const msg = r.spawned ? `Daemon spawned (pid=${r.pid}).` : "Daemon already running.";
  return { content: [{ type: "text", text: msg }] };
});

// --- memory_stats: text-format stats ---
server.tool("memory_stats", "Memory-keeper stats report", {}, async () => {
  const s = stats();
  const total = s.pending + s.processing + s.failed;
  let persisted = null;
  if (existsSync(STATS_FILE)) {
    try { persisted = JSON.parse(readFileSync(STATS_FILE, "utf8")); } catch {}
  }
  const lines = [
    "Memory Keeper Stats",
    "",
    `Queue total : ${total}`,
    `pending     : ${s.pending}`,
    `processing  : ${s.processing}`,
    `failed      : ${s.failed}`,
    "",
    `Daemon      : ${daemonRunning() ? "running" : "stopped"}`,
  ];
  if (persisted?.updated_at) lines.push(`Last update : ${persisted.updated_at}`);
  return { content: [{ type: "text", text: lines.join("\n") }] };
});

// --- memory_queue_stats: condensed alias ---
server.tool("memory_queue_stats", "Show queue counts (condensed)", {}, async () => {
  const s = stats();
  const total = s.pending + s.processing + s.failed;
  const lines = [
    "Queue Status",
    `  pending    : ${s.pending}`,
    `  processing : ${s.processing}`,
    `  failed     : ${s.failed}`,
    `  total      : ${total}`,
  ];
  return { content: [{ type: "text", text: lines.join("\n") }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);

#!/usr/bin/env node
/**
 * Memory Keeper Daemon — long-lived process serving MCP over SSE + HTTP.
 * Owns: SQLite queue, drain loop, logger, stats.
 *
 * Usage: npx tsx daemon.ts
 * Or via ensure-daemon.sh (SessionStart hook)
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { execSync, execFileSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";

import {
  logger,
  createLogger,
  LOG_DIR,
  loadConfig,
  detectProject,
  findProjectSummary,
  saveInsight,
  loadTokenStatsByDay,
  formatStatsTable,
  formatStatsDayDetail,
  formatHealthBanner,
  listTopics,
  type Config,
  type QmdSearchFn,
  type QmdHit,
  type TokenUsage,
} from "../index.js";

import {
  openQueue,
  enqueue,
  getQueueStats,
  gcSessions,
  closeQueue,
} from "../queue.js";

import { processQueue } from "../processor.js";

const log = createLogger("daemon");

// ─── Config ──────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.MK_PORT || "7420", 10);
const PID_FILE = join(LOG_DIR, "memory-keeper.pid");
const DRAIN_INTERVAL_MS = 30_000;

// ─── PID lifecycle ───────────────────────────────────────────────────────

export function isRunning(): boolean {
  try {
    if (!existsSync(PID_FILE)) return false;
    const pid = parseInt(readFileSync(PID_FILE, "utf8").trim(), 10);
    if (isNaN(pid)) return false;
    process.kill(pid, 0); // test if process exists
    return true;
  } catch {
    return false;
  }
}

function writePid(): void {
  writeFileSync(PID_FILE, String(process.pid));
}

function removePid(): void {
  try {
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
  } catch {}
}

// ─── QMD search via CLI ─────────────────────────────────────────────────

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

const qmdSearch: QmdSearchFn = (
  query: string,
  collection = "ctx",
  n = 3,
  minScore = 0.5
): QmdHit[] => {
  try {
    const q = query
      .replace(/[`#*|[\]"'$\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    const out = execSync(
      `qmd search ${shellEscape(q)} -c ${collection} -n ${n} --min-score ${minScore} --json`,
      { encoding: "utf8", timeout: 5000 }
    );
    const results = JSON.parse(out);
    return results.map((r: { file: string; score: number; title: string }) => {
      const match = r.file.match(/insights\/([^/]+)\//);
      return {
        project: match ? match[1] : "unknown",
        file: r.file.replace(/^qmd:\/\/ctx\//, ""),
        score: r.score,
        title: r.title,
      };
    });
  } catch {
    return [];
  }
};

// ─── Pi CLI LLM call (for drain loop) ───────────────────────────────────

function createLlmCallFn(config: Config): (prompt: string) => Promise<{ text: string; usage: TokenUsage }> {
  const provider = config.llm_provider || "openrouter";
  const model = config.llm_model || config.openrouter_model || "google/gemma-4-31b-it:free";
  const apiKey = config.llm_api_key || config.openrouter_api_key || "";

  log.info({ provider, model }, "LLM via Pi CLI");

  return async (prompt: string) => {
    const env: Record<string, string> = { ...process.env as Record<string, string> };
    if (apiKey) {
      if (provider === "openrouter") env.OPENROUTER_API_KEY = apiKey;
      else if (provider === "google") env.GOOGLE_API_KEY = apiKey;
      else if (provider === "openai") env.OPENAI_API_KEY = apiKey;
    }

    const args = [
      "-p",
      "--mode", "json",
      "--no-tools",
      "--no-extensions",
      "--no-skills",
      "--no-session",
      "--no-prompt-templates",
      "--provider", provider,
      "--model", model,
    ];

    // Pass prompt via stdin to handle large prompts safely
    const output = execFileSync("pi", args, {
      encoding: "utf8",
      timeout: 60_000,
      input: prompt,
      env,
      maxBuffer: 10 * 1024 * 1024,
    });

    // Parse JSONL — find turn_end with assistant content + usage
    let text = "";
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    for (const line of output.split("\n").filter(Boolean)) {
      try {
        const event = JSON.parse(line);
        if (event.type === "turn_end" && event.message?.role === "assistant") {
          const content = event.message.content || [];
          text = content
            .filter((b: { type: string }) => b.type === "text")
            .map((b: { text: string }) => b.text)
            .join("");
          const u = event.message.usage;
          if (u) {
            usage = {
              inputTokens: u.input ?? 0,
              outputTokens: u.output ?? 0,
              totalTokens: u.totalTokens ?? ((u.input ?? 0) + (u.output ?? 0)),
            };
          }
        }
      } catch {}
    }

    if (!text) {
      const errorLine = output.split("\n").find(l => l.includes('"errorMessage"'));
      if (errorLine) {
        try {
          const parsed = JSON.parse(errorLine);
          throw new Error(parsed.message?.errorMessage || "Pi CLI returned no text");
        } catch (e) {
          if (e instanceof Error && e.message !== "Pi CLI returned no text") throw e;
        }
      }
      throw new Error("Pi CLI returned no assistant text");
    }

    return { text, usage };
  };
}

// ─── MCP Server (tools) ─────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "memory-keeper",
    version: "0.2.0",
  });

  // --- Tool: memory_context ---
  server.tool(
    "memory_context",
    "Get project context from persistent memory (summary + topics + health banner).",
    { cwd: z.string().optional().describe("Working directory") },
    async ({ cwd }) => {
      const config = loadConfig();
      if (!config.insights_root) {
        return { content: [{ type: "text" as const, text: "No insights_root configured." }] };
      }

      const dir = cwd || process.env.WORK_CWD || process.cwd();
      const project = detectProject(dir);
      const summary = findProjectSummary(config.insights_root, dir);
      const topics = listTopics(config.insights_root, project);

      // Health banner
      const days = loadTokenStatsByDay(1);
      const qs = getQueueStats();
      const banner = formatHealthBanner(days, {
        pending: qs.pending,
        failed: qs.failed,
        totalSessions: qs.total,
      });

      let text = `${banner}\n\n# Project: ${project}\n\n`;
      if (summary) text += summary + "\n\n";
      if (topics.length > 0) {
        text += "## Known Topics\n\n";
        for (const cat of topics) {
          text += `### ${cat.category}\n`;
          for (const t of cat.topics) text += `- ${t}\n`;
          text += "\n";
        }
      }
      if (!summary && topics.length === 0) {
        text += "No persistent memory found for this project yet.\n";
      }

      return { content: [{ type: "text" as const, text }] };
    }
  );

  // --- Tool: memory_save ---
  server.tool(
    "memory_save",
    "Save a single insight/task/agent_edit to persistent memory with dedup check.",
    {
      classification: z.enum(["insight", "task", "agent_edit"]).describe("Entry type"),
      topic: z.string().describe("Keyword-rich title, 3-7 words"),
      body: z.string().describe("Markdown body (lead sentence + details)"),
      category: z.string().optional().describe("Technology category slug"),
      repo: z.string().optional().describe("Target repository"),
    },
    async ({ classification, topic, body, category, repo }) => {
      const config = loadConfig();
      if (!config.insights_root) {
        return { content: [{ type: "text" as const, text: "Error: no insights_root configured." }] };
      }

      const project = repo || detectProject(process.env.WORK_CWD || process.cwd());
      const savedTo = saveInsight(config.insights_root, project, classification, topic, body, category);

      if (savedTo) {
        logger.info({ topic, file: savedTo }, "memory_save: saved");
        return { content: [{ type: "text" as const, text: `Saved "${topic}" to ${savedTo}` }] };
      } else {
        logger.debug({ topic }, "memory_save: dedup skipped");
        return { content: [{ type: "text" as const, text: `Skipped "${topic}" (duplicate detected)` }] };
      }
    }
  );

  // --- Tool: memory_extract (enqueue for async processing) ---
  server.tool(
    "memory_extract",
    "Enqueue conversation for async insight extraction. The daemon drain loop processes it in the background.",
    {
      conversation: z.string().describe("Recent conversation text to analyze"),
      project: z.string().optional().describe("Project name"),
      source: z.enum(["claude", "pi-cron", "pi-shutdown", "pi-manual"]).optional().describe("Source adapter"),
    },
    async ({ conversation, project: projectArg, source }) => {
      const config = loadConfig();
      if (!config.insights_root) {
        return { content: [{ type: "text" as const, text: "Error: no insights_root configured." }] };
      }

      const project = projectArg || detectProject(process.env.WORK_CWD || process.cwd());
      const sessionId = `mcp-${Date.now()}`;

      const id = enqueue({
        sessionId,
        project,
        conversation,
        source: source || "claude",
      });

      log.info({ id, project, sessionId }, "conversation enqueued");
      return {
        content: [{
          type: "text" as const,
          text: `Enqueued for processing (queue id: ${id}). Drain loop will process shortly.`,
        }],
      };
    }
  );

  // --- Tool: memory_stats ---
  server.tool(
    "memory_stats",
    "Show token usage statistics (last N days). Pass detail index for drill-down.",
    {
      days: z.number().optional().describe("Number of days (default: 10)"),
      detail: z.number().optional().describe("Day index (1-based) for detail"),
    },
    async ({ days, detail }) => {
      const stats = loadTokenStatsByDay(days || 10);

      if (detail != null) {
        const idx = detail - 1;
        if (idx >= 0 && idx < stats.length) {
          return { content: [{ type: "text" as const, text: formatStatsDayDetail(stats[idx]) }] };
        }
        return { content: [{ type: "text" as const, text: `Day ${detail} not found. Range: 1-${stats.length}` }] };
      }

      return { content: [{ type: "text" as const, text: formatStatsTable(stats) }] };
    }
  );

  // --- Tool: memory_topics ---
  server.tool(
    "memory_topics",
    "List existing topics/categories for a project.",
    { project: z.string().optional().describe("Project name") },
    async ({ project: projectArg }) => {
      const config = loadConfig();
      if (!config.insights_root) {
        return { content: [{ type: "text" as const, text: "No insights_root configured." }] };
      }

      const project = projectArg || detectProject(process.env.WORK_CWD || process.cwd());
      const topics = listTopics(config.insights_root, project);

      if (topics.length === 0) {
        return { content: [{ type: "text" as const, text: `No topics found for project "${project}".` }] };
      }

      let text = `# Topics for ${project}\n\n`;
      for (const cat of topics) {
        text += `## ${cat.category} (${cat.topics.length})\n`;
        for (const t of cat.topics) text += `- ${t}\n`;
        text += "\n";
      }
      return { content: [{ type: "text" as const, text }] };
    }
  );

  // --- Tool: memory_queue_stats ---
  server.tool(
    "memory_queue_stats",
    "Show queue status: pending, processing, done, failed counts.",
    {},
    async () => {
      const qs = getQueueStats();
      const text =
        `Queue Status\n` +
        `  Pending   : ${qs.pending}\n` +
        `  Processing: ${qs.processing}\n` +
        `  Done      : ${qs.done}\n` +
        `  Failed    : ${qs.failed}\n` +
        `  Total     : ${qs.total}`;
      return { content: [{ type: "text" as const, text }] };
    }
  );

  return server;
}

// ─── HTTP + SSE Server ──────────────────────────────────────────────────

export async function startDaemon(): Promise<void> {
  if (isRunning()) {
    log.warn("another daemon is already running — exiting");
    process.exit(0);
  }

  writePid();

  // Initialize queue + GC
  openQueue();
  const gcCount = gcSessions(30);
  if (gcCount > 0) log.info({ deleted: gcCount }, "gc: cleaned old sessions");

  const config = loadConfig();
  const insightsRoot = config.insights_root;
  const llmCallFn = createLlmCallFn(config);

  // Background drain loop
  let drainRunning = false;
  const drainTimer = setInterval(async () => {
    if (!insightsRoot || drainRunning) return;
    drainRunning = true;
    try {
      const result = await processQueue({
        batchSize: 5,
        llmCallFn,
        qmdSearchFn: qmdSearch,
        insightsRoot,
      });
      if (result.processed > 0) {
        log.info(result, "drain loop cycle complete");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ err: msg }, "drain loop error");
    } finally {
      drainRunning = false;
    }
  }, DRAIN_INTERVAL_MS);

  // MCP server
  const mcpServer = createMcpServer();

  // Track SSE transports for multi-client support
  const transports = new Map<string, SSEServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url || "";

    // ─── Health endpoint ───
    if (url === "/health" && req.method === "GET") {
      const qs = getQueueStats();
      const days = loadTokenStatsByDay(1);
      const banner = formatHealthBanner(days, {
        pending: qs.pending,
        failed: qs.failed,
        totalSessions: qs.total,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        uptime: process.uptime(),
        banner,
        queue: qs,
      }));
      return;
    }

    // ─── REST: enqueue (for Pi adapter) ───
    if (url === "/api/enqueue" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const data = JSON.parse(body);
        const id = enqueue({
          sessionId: data.sessionId || `rest-${Date.now()}`,
          project: data.project || "unknown",
          conversation: data.conversation,
          source: data.source || "pi-manual",
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    // ─── REST: queue stats (for Pi adapter) ───
    if (url === "/api/queue-stats" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(getQueueStats()));
      return;
    }

    // ─── REST: health banner (for Pi adapter) ───
    if (url === "/api/health-banner" && req.method === "GET") {
      const qs = getQueueStats();
      const days = loadTokenStatsByDay(1);
      const banner = formatHealthBanner(days, {
        pending: qs.pending,
        failed: qs.failed,
        totalSessions: qs.total,
      });
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(banner);
      return;
    }

    // ─── REST: stats table (for Pi adapter) ───
    if (url === "/api/stats" && req.method === "GET") {
      const stats = loadTokenStatsByDay(10);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(formatStatsTable(stats));
      return;
    }

    // ─── REST: project context (for Pi adapter) ───
    if (url.startsWith("/api/context") && req.method === "GET") {
      const parsedUrl = new URL(url, `http://127.0.0.1:${PORT}`);
      const project = parsedUrl.searchParams.get("project") || "unknown";
      const cfg = loadConfig();
      if (!cfg.insights_root) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("");
        return;
      }
      const summary = findProjectSummary(cfg.insights_root, process.cwd());
      const topics = listTopics(cfg.insights_root, project);
      let text = "";
      if (summary) text += summary + "\n\n";
      if (topics.length > 0) {
        text += "## Known Topics\n\n";
        for (const cat of topics) {
          text += `### ${cat.category}\n`;
          for (const t of cat.topics) text += `- ${t}\n`;
          text += "\n";
        }
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(text);
      return;
    }

    // ─── REST: track QMD usage (for Pi adapter) ───
    if (url === "/api/track-qmd" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const data = JSON.parse(body);
        const { trackQmdUsage } = await import("../memory.js");
        trackQmdUsage(data.toolName, data.toolInput || {}, data.resultText || "");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400).end();
      }
      return;
    }

    // ─── SSE endpoint (MCP transport) ───
    if (url === "/sse" && req.method === "GET") {
      log.info("SSE client connecting");
      const transport = new SSEServerTransport("/messages", res);
      transports.set(transport.sessionId, transport);
      res.on("close", () => {
        transports.delete(transport.sessionId);
        log.info({ sessionId: transport.sessionId }, "SSE client disconnected");
      });
      await mcpServer.connect(transport);
      return;
    }

    // ─── SSE message endpoint ───
    if (url.startsWith("/messages") && req.method === "POST") {
      const sessionId = new URL(url, `http://127.0.0.1:${PORT}`).searchParams.get("sessionId");
      const transport = sessionId ? transports.get(sessionId) : undefined;
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "session not found" }));
      }
      return;
    }

    res.writeHead(404).end("Not Found");
  });

  httpServer.listen(PORT, "127.0.0.1", () => {
    log.info({ port: PORT, pid: process.pid }, "daemon started");
  });

  // ─── Graceful shutdown ───
  const shutdown = () => {
    log.info("shutting down...");
    clearInterval(drainTimer);
    httpServer.close();
    closeQueue();
    removePid();
    log.info("shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ─── Main ────────────────────────────────────────────────────────────────

startDaemon().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : "";
  console.error("DAEMON STARTUP FAILED:", msg);
  console.error(stack);
  log.fatal({ err: msg }, "daemon startup failed");
  setTimeout(() => process.exit(1), 200);
});

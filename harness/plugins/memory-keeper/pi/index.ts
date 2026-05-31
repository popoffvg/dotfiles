import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import {
  PLUGIN_WORKFLOW_EVENTS,
  type PluginWorkflowStartPayload,
  type PluginWorkflowEndPayload,
  type PluginWorkflowEventPayload,
} from "./modules/plugin-workflow-events";
import { register as registerPluginWorkflowEvents } from "./modules/plugin-workflow-events";
import { register as registerPluginWorkflow } from "./modules/plugin-workflow";
import { register as registerSkillManager } from "./modules/skill-manager";
import { keyHint } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { readFileSync } from "fs";
import { join, basename, dirname, resolve } from "path";
import { homedir } from "os";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

// ─── Render helpers for collapsed tool output ──────────────────────────────

interface QmdDetails {
  exitCode: number;
  output: string;
  resultCount?: number;
}

function summarizeQmdOutput(output: string): { lines: number; resultCount: number; firstLines: string[] } {
  const allLines = output.split("\n");
  const lines = allLines.length;
  const resultCount = allLines.filter((l) => /^(---|===|\d+\.)/.test(l.trim())).length || 1;
  const firstLines = allLines.slice(0, 3).filter((l) => l.trim());
  return { lines, resultCount, firstLines };
}

function renderQmdCall(toolLabel: string, args: Record<string, any>, theme: Theme): Text {
  let text = theme.fg("toolTitle", theme.bold(toolLabel + " "));
  text += theme.fg("accent", `"${args.query || args.file || ""}"`);
  if (args.collection) text += theme.fg("dim", ` collection=${args.collection}`);
  if (args.n) text += theme.fg("dim", ` n=${args.n}`);
  if (args.from) text += theme.fg("dim", ` from=${args.from}`);
  if (args.lines) text += theme.fg("dim", ` lines=${args.lines}`);
  return new Text(text, 0, 0);
}

function renderQmdResult(
  result: { content: any[]; details?: QmdDetails },
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme
): Text {
  if (options.isPartial) {
    return new Text(theme.fg("warning", "Searching..."), 0, 0);
  }
  const details = result.details as QmdDetails | undefined;
  const output = details?.output || "";
  if (!output || output === "(no results)" || output === "(empty)") {
    return new Text(theme.fg("dim", "(no results)"), 0, 0);
  }
  if (details?.exitCode !== 0) {
    return new Text(theme.fg("error", `Exit code ${details?.exitCode}: ${output.slice(0, 200)}`), 0, 0);
  }
  const { lines, firstLines } = summarizeQmdOutput(output);
  if (options.expanded) {
    return new Text(output, 0, 0);
  }
  let text = theme.fg("success", `✓ `) + theme.fg("muted", `${lines} lines`);
  if (firstLines.length > 0) {
    text += "\n" + theme.fg("dim", firstLines.map((l) => (l.length > 80 ? l.slice(0, 77) + "..." : l)).join("\n"));
  }
  text += "\n" + theme.fg("dim", `(${keyHint("expandTools", "to expand")})`);
  return new Text(text, 0, 0);
}

// ─── Minimal config (only for exclude_paths + insights_root check) ────────

interface Config {
  insights_root?: string;
  exclude_paths?: string;
  [key: string]: string | undefined;
}

function loadConfig(): Config {
  const configPath = join(homedir(), ".claude", "memory-keeper.local.md");
  let content: string;
  try {
    content = readFileSync(configPath, "utf8");
  } catch {
    return {};
  }
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const config: Config = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith("~")) val = val.replace("~", homedir());
    if (key && val) config[key] = val;
  }
  return config;
}

// ─── Project detection (local, fast) ──────────────────────────────────────

function detectProject(cwd: string): string {
  const envProject = process.env.PI_PROJECT;
  if (envProject && envProject.trim()) return envProject.trim();
  return basename(cwd);
}

// ─── Conversation extraction from pi session ───────────────────────────────

const MAX_CONVERSATION_CHARS = 8000;

function extractEntryText(entry: any): string | null {
  if (entry.type !== "message") return null;
  const msg = entry.message;
  if (!msg) return null;

  if (msg.role === "user") {
    const text =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n")
          : "";
    if (text && !text.startsWith("<") && text.length > 5) {
      return `User: ${text}`;
    }
  } else if (msg.role === "assistant") {
    const blocks = msg.content || [];
    const texts = Array.isArray(blocks)
      ? blocks
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n")
      : typeof blocks === "string"
        ? blocks
        : "";
    if (texts) {
      return `Assistant: ${texts}`;
    }
  }
  return null;
}

function extractConversationSlice(
  entries: any[],
  fromIndex: number,
  maxChars = MAX_CONVERSATION_CHARS
): { text: string; newCursor: number } {
  const messages: string[] = [];
  let cursor = fromIndex;
  for (let i = fromIndex; i < entries.length; i++) {
    const text = extractEntryText(entries[i]);
    if (text) messages.push(text);
    cursor = i + 1;
  }

  let total = 0;
  const selected: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (total + messages[i].length > maxChars) break;
    selected.unshift(messages[i]);
    total += messages[i].length;
  }
  return { text: selected.join("\n\n"), newCursor: cursor };
}

// ─── Cron state ────────────────────────────────────────────────────────────

const CRON_INTERVAL_MS = 3 * 60 * 1000;
const MIN_CONVERSATION_LENGTH = 100;
const CURSOR_ENTRY_TYPE = "memory-keeper-cursor";

let cronTimer: ReturnType<typeof setInterval> | null = null;
let lastProcessedCursor = 0;
let cronProcessing = false;

function restoreCursor(entries: any[]): number {
  let cursor = 0;
  for (const entry of entries) {
    if (entry.type === "custom" && entry.customType === CURSOR_ENTRY_TYPE) {
      cursor = entry.data?.cursor ?? 0;
    }
  }
  return cursor;
}

// ─── Path exclusion (fast local check) ─────────────────────────────────────

function isExcluded(cwd: string, config: Config): boolean {
  const raw = config.exclude_paths;
  if (!raw) return false;
  const patterns = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (patterns.length === 0) return false;
  const normalizedCwd = cwd.replace(/\\/g, "/");
  return patterns.some((pattern) => globMatch(normalizedCwd, pattern.replace(/\\/g, "/")));
}

function globMatch(str: string, pattern: string): boolean {
  const specialChars = /[.+^${}()|[\]\\]/g;
  let re = "^";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      re += ".*";
      i += 2;
      if (pattern[i] === "/") i++;
    } else if (c === "*") {
      re += "[^/]*";
      i++;
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else {
      re += c.replace(specialChars, "\\$&");
      i++;
    }
  }
  re += "$";
  try {
    return new RegExp(re).test(str);
  } catch {
    return false;
  }
}

// ─── Daemon HTTP client ───────────────────────────────────────────────────

const DAEMON_URL = process.env.MK_DAEMON_URL || "http://127.0.0.1:7420";
const DAEMON_STARTUP_WAIT_MS = 5000;
const DAEMON_HEALTH_RETRY_MS = 250;
const DAEMON_REQUEST_TIMEOUT_MS = 1500;
const extensionDir = dirname(fileURLToPath(import.meta.url));
const daemonServerDir = resolve(extensionDir, "../common/server");

function createTimeoutSignal(timeoutMs = DAEMON_REQUEST_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

async function daemonGet(path: string): Promise<any> {
  try {
    const res = await fetch(`${DAEMON_URL}${path}`, { signal: createTimeoutSignal() });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("json")) return res.json();
    return res.text();
  } catch {
    return null;
  }
}

async function daemonPost(path: string, body: object): Promise<any> {
  try {
    const res = await fetch(`${DAEMON_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: createTimeoutSignal(),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function isDaemonRunning(): Promise<boolean> {
  const health = await daemonGet("/health");
  return health?.status === "ok";
}

async function ensureDaemonRunning(): Promise<boolean> {
  if (await isDaemonRunning()) return true;

  try {
    const child = spawn("npx", ["tsx", "daemon.ts"], {
      cwd: daemonServerDir,
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
  } catch {
    return false;
  }

  const deadline = Date.now() + DAEMON_STARTUP_WAIT_MS;
  while (Date.now() < deadline) {
    if (await isDaemonRunning()) return true;
    await new Promise((resolve) => setTimeout(resolve, DAEMON_HEALTH_RETRY_MS));
  }
  return false;
}

// ─── Extension ────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Absorbed modules (formerly standalone plugins)
  registerPluginWorkflowEvents(pi);
  registerPluginWorkflow(pi);
  registerSkillManager(pi);

  let workActive = false;

  function wfTaskId(task: string): string {
    return `memory-keeper:${task}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  }

  function wfEvent(event: string, details?: string): void {
    pi.events.emit(PLUGIN_WORKFLOW_EVENTS.EVENT, {
      plugin: "memory-keeper",
      event,
      details,
    } satisfies PluginWorkflowEventPayload);
  }

  const TOOL_GUIDE = `
# Memory Keeper Tool Translation

Skills reference MCP tool names. Use these native tools instead:

| Skill references | Use tool |
|---|---|
| mcp__qmd__search | qmd_search |
| mcp__qmd__deep_search | qmd_query |
| mcp__qmd__vector_search | qmd_query |
| mcp__qmd__get | qmd_get |
| mcp__qmd__multi_get | qmd_get (call per file) |

When a skill says "use mcp__firecrawl__*", use bash with curl or any available web search tool instead.
`;

  // --- Session Start: inject context from daemon + health banner ---
  pi.on("before_agent_start", async (event, ctx) => {
    const config = loadConfig();
    workActive = isExcluded(ctx.cwd, config);
    if (workActive) return;
    if (!config.insights_root) return;

    let extra = TOOL_GUIDE;

    // Fetch health banner + project context from daemon (parallel, timeout-bounded)
    const project = detectProject(ctx.cwd);
    const contextPath = `/api/context?project=${encodeURIComponent(project)}`;
    const [banner, context] = await Promise.all([
      daemonGet("/api/health-banner"),
      daemonGet(contextPath),
    ]);

    if (banner && typeof banner === "string") {
      extra += `\n${banner}\n`;
    }
    if (context && typeof context === "string" && context.length > 0) {
      extra += "\n# Context Knowledge Base\n\n" + context + "\n";
    }

    return {
      systemPrompt: event.systemPrompt + "\n" + extra,
    };
  });

  // --- Cron: periodic async insight extraction via daemon ---

  async function cronTick(ctx: any) {
    if (workActive) return;
    if (cronProcessing) return;
    cronProcessing = true;
    let taskId: string | null = null;

    try {
      const config = loadConfig();
      if (!config.insights_root) return;

      const entries = ctx.sessionManager.getBranch();
      if (lastProcessedCursor >= entries.length) return;

      const { text, newCursor } = extractConversationSlice(entries, lastProcessedCursor);
      if (!text || text.length < MIN_CONVERSATION_LENGTH) return;

      const project = detectProject(ctx.cwd);
      const sessionId = "pi-cron-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      taskId = wfTaskId("cron-process");

      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.START, {
        plugin: "memory-keeper",
        taskId,
        task: "cron-process",
        details: `entries [${lastProcessedCursor}..${newCursor})`,
      } satisfies PluginWorkflowStartPayload);

      const result = await daemonPost("/api/enqueue", {
        sessionId,
        project,
        conversation: text,
        source: "pi-cron",
      });

      lastProcessedCursor = newCursor;
      pi.appendEntry(CURSOR_ENTRY_TYPE, { cursor: newCursor });

      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
        plugin: "memory-keeper",
        taskId,
        status: "ok",
        details: result ? `enqueued id=${result.id}` : "daemon unreachable",
      } satisfies PluginWorkflowEndPayload);
    } catch (err: any) {
      if (taskId) {
        pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
          plugin: "memory-keeper",
          taskId,
          status: "error",
          details: err?.message || "unknown-error",
        } satisfies PluginWorkflowEndPayload);
      }
      wfEvent("cron:error", err?.message || "unknown-error");
    } finally {
      cronProcessing = false;
    }
  }

  // --- Session Shutdown: enqueue remaining entries ---
  pi.on("session_shutdown", async (_event, ctx) => {
    if (cronTimer) {
      clearInterval(cronTimer);
      cronTimer = null;
    }

    if (workActive) return;

    const config = loadConfig();
    if (!config.insights_root) return;

    const entries = ctx.sessionManager.getBranch();
    if (lastProcessedCursor >= entries.length) return;

    const { text } = extractConversationSlice(entries, lastProcessedCursor);
    if (!text || text.length < MIN_CONVERSATION_LENGTH) return;

    const project = detectProject(ctx.cwd);
    const sessionId = "pi-shutdown-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const taskId = wfTaskId("shutdown-flush");

    process.stdout.write(`\r\n⏳ memory-keeper: enqueuing insights for [${project}]...\r\n`);
    pi.events.emit(PLUGIN_WORKFLOW_EVENTS.START, {
      plugin: "memory-keeper",
      taskId,
      task: "shutdown-flush",
      details: `entries [${lastProcessedCursor}..${entries.length})`,
    } satisfies PluginWorkflowStartPayload);

    try {
      const result = await daemonPost("/api/enqueue", {
        sessionId,
        project,
        conversation: text,
        source: "pi-shutdown",
      });
      lastProcessedCursor = entries.length;
      pi.appendEntry(CURSOR_ENTRY_TYPE, { cursor: lastProcessedCursor });
      process.stdout.write(`✓ memory-keeper: enqueued${result ? ` (id=${result.id})` : ""} — daemon will process\r\n`);
      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
        plugin: "memory-keeper",
        taskId,
        status: "ok",
        details: result ? `enqueued id=${result.id}` : "sent",
      } satisfies PluginWorkflowEndPayload);
    } catch (err: any) {
      process.stdout.write(`✗ memory-keeper: failed — ${err.message}\r\n`);
      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
        plugin: "memory-keeper",
        taskId,
        status: "error",
        details: err?.message || "unknown-error",
      } satisfies PluginWorkflowEndPayload);
    }
  });

  // --- Command: /memory:stats (fetch from daemon) ---
  pi.registerCommand("memory:stats", {
    description: "Show per-day token usage for insight capture (last 10 days).",
    handler: async (_args, ctx) => {
      const stats = await daemonGet("/api/stats");
      if (!stats) {
        ctx.ui.notify("Daemon unreachable — cannot fetch stats", "error");
        return;
      }
      ctx.ui.notify(typeof stats === "string" ? stats : JSON.stringify(stats, null, 2), "info");
    },
  });

  // --- QMD tool post-use stats tracking (via daemon) ---
  pi.on("tool_result", async (event, _ctx) => {
    const name = event.toolName;
    if (name === "qmd_search" || name === "qmd_query" || name === "qmd_get") {
      const output = event.content?.[0]?.type === "text" ? (event.content[0] as any).text : "";
      // Fire-and-forget to daemon
      daemonPost("/api/track-qmd", {
        toolName: name,
        toolInput: event.input || {},
        resultText: output,
      });
    }
  });

  // --- Command: /context <subcommand> ---
  pi.registerCommand("context", {
    description: "Memory keeper — find, save, check, research, done, scan. Use /memory:process to trigger now.",
    handler: async (args, ctx) => {
      if (!args || !args.trim()) {
        ctx.ui.notify("Usage: /context <find|save|check|research|done|scan> [args]\nProcess now: /memory:process", "info");
        return;
      }

      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0];
      const rest = parts.slice(1).join(" ");

      const validSubcommands = ["find", "save", "check", "research", "done", "scan"];
      if (!validSubcommands.includes(subcommand)) {
        ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use: find, save, check, research, done, scan`, "error");
        return;
      }

      const skillInvocation = `/skill:context-${subcommand}${rest ? " " + rest : ""}`;
      pi.sendUserMessage(skillInvocation);
    },
  });

  // --- Command: /memory:process (enqueue to daemon) ---
  pi.registerCommand("memory:process", {
    description: "Enqueue unprocessed conversation for daemon processing",
    handler: async (_args, ctx) => {
      const config = loadConfig();
      if (!config.insights_root) {
        ctx.ui.notify("No insights_root configured in ~/.claude/memory-keeper.local.md", "error");
        return;
      }

      const entries = ctx.sessionManager.getBranch();
      if (lastProcessedCursor >= entries.length) {
        ctx.ui.notify("Nothing new to process since last run", "info");
        return;
      }

      const { text, newCursor } = extractConversationSlice(entries, lastProcessedCursor);
      if (!text || text.length < 50) {
        ctx.ui.notify("New conversation too short — nothing to process", "info");
        return;
      }

      const project = detectProject(ctx.cwd);
      const sessionId = "pi-manual-" + Date.now();
      const taskId = wfTaskId("manual-process");

      ctx.ui.notify(`Enqueuing entries [${lastProcessedCursor}..${newCursor}) for project: ${project}...`, "info");
      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.START, {
        plugin: "memory-keeper",
        taskId,
        task: "manual-process",
        details: `entries [${lastProcessedCursor}..${newCursor})`,
      } satisfies PluginWorkflowStartPayload);

      try {
        const result = await daemonPost("/api/enqueue", {
          sessionId,
          project,
          conversation: text,
          source: "pi-manual",
        });
        lastProcessedCursor = newCursor;
        pi.appendEntry(CURSOR_ENTRY_TYPE, { cursor: newCursor });
        pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
          plugin: "memory-keeper",
          taskId,
          status: "ok",
          details: result ? `enqueued id=${result.id}` : "sent",
        } satisfies PluginWorkflowEndPayload);
        ctx.ui.notify(result ? `Enqueued (id=${result.id}) — daemon will process shortly` : "Enqueued — daemon will process", "info");
      } catch (err: any) {
        pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
          plugin: "memory-keeper",
          taskId,
          status: "error",
          details: err?.message || "unknown-error",
        } satisfies PluginWorkflowEndPayload);
        ctx.ui.notify(`Failed: ${err.message}`, "error");
      }
    },
  });

  // --- QMD tools (registered as native pi tools) ---

  pi.registerTool({
    name: "qmd_search",
    label: "QMD Search",
    description: "Keyword search (BM25) across indexed markdown collections. Use for finding insights, notes, and documentation by keyword.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      collection: Type.Optional(Type.String({ description: 'Collection name (e.g. "ctx", "z-core"). Default: all.' })),
      n: Type.Optional(Type.Number({ description: "Number of results (default: 5)" })),
    }),
    async execute(_id, params, signal) {
      const args = ["search", params.query];
      if (params.collection) args.push("-c", params.collection);
      if (params.n) args.push("-n", String(params.n));
      const result = await pi.exec("qmd", args, { signal, timeout: 10000 });
      const output = (result.stdout || "") + (result.stderr || "");
      return {
        content: [{ type: "text", text: output || "(no results)" }],
        details: { exitCode: result.code, output } as QmdDetails,
      };
    },
    renderCall(args, theme) {
      return renderQmdCall("qmd_search", args, theme);
    },
    renderResult(result, options, theme) {
      return renderQmdResult(result, options, theme);
    },
  });

  pi.registerTool({
    name: "qmd_query",
    label: "QMD Deep Search",
    description: "Semantic search with query expansion and reranking. Use when keyword search returns few results or for conceptual queries.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      collection: Type.Optional(Type.String({ description: "Collection name" })),
      n: Type.Optional(Type.Number({ description: "Number of results (default: 5)" })),
    }),
    async execute(_id, params, signal) {
      const args = ["query", params.query];
      if (params.collection) args.push("-c", params.collection);
      if (params.n) args.push("-n", String(params.n));
      const result = await pi.exec("qmd", args, { signal, timeout: 30000 });
      const output = (result.stdout || "") + (result.stderr || "");
      return {
        content: [{ type: "text", text: output || "(no results)" }],
        details: { exitCode: result.code, output } as QmdDetails,
      };
    },
    renderCall(args, theme) {
      return renderQmdCall("qmd_query", args, theme);
    },
    renderResult(result, options, theme) {
      return renderQmdResult(result, options, theme);
    },
  });

  pi.registerTool({
    name: "qmd_get",
    label: "QMD Get",
    description: "Retrieve full document content by path from QMD index.",
    parameters: Type.Object({
      file: Type.String({ description: "Document path (e.g. ctx/project/insights.md)" }),
      from: Type.Optional(Type.Number({ description: "Start from line number" })),
      lines: Type.Optional(Type.Number({ description: "Max lines to return" })),
    }),
    async execute(_id, params, signal) {
      const args = ["get", params.file];
      if (params.from) args.push("--from", String(params.from));
      if (params.lines) args.push("-l", String(params.lines));
      const result = await pi.exec("qmd", args, { signal, timeout: 10000 });
      const output = (result.stdout || "") + (result.stderr || "");
      return {
        content: [{ type: "text", text: output || "(empty)" }],
        details: { exitCode: result.code, output } as QmdDetails,
      };
    },
    renderCall(args, theme) {
      return renderQmdCall("qmd_get", args, theme);
    },
    renderResult(result, options, theme) {
      return renderQmdResult(result, options, theme);
    },
  });

  // --- Startup: restore cursor, check daemon, start cron ---
  pi.on("session_start", async (_event, ctx) => {
    if (workActive) return;

    const config = loadConfig();
    if (!config.insights_root) {
      ctx.ui.notify("memory-keeper: no insights_root in ~/.claude/memory-keeper.local.md", "warning");
      return;
    }

    // Restore cursor from session
    const entries = ctx.sessionManager.getEntries();
    lastProcessedCursor = restoreCursor(entries);
    cronProcessing = false;

    // Check daemon health and try auto-start once
    let running = await isDaemonRunning();
    if (!running) {
      running = await ensureDaemonRunning();
    }
    if (!running) {
      ctx.ui.notify("memory-keeper: daemon not running on " + DAEMON_URL, "warning");
    }

    // Stop any existing timer
    if (cronTimer) {
      clearInterval(cronTimer);
      cronTimer = null;
    }

    // Start cron
    cronTimer = setInterval(() => {
      cronTick(ctx).catch(() => {});
    }, CRON_INTERVAL_MS);

    if (cronTimer && typeof cronTimer === "object" && "unref" in cronTimer) {
      cronTimer.unref();
    }
  });
}

#!/usr/bin/env node
/**
 * Memory Keeper MCP Server — thin adapter over core/memory.ts.
 * Exposes tools: memory_context, memory_save, memory_extract, memory_stats, memory_topics.
 * Runs as stdio MCP server, one process per Claude Code session.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";

import {
  loadConfig,
  detectProject,
  findProjectSummary,
  collectExistingTopics,
  buildClassifyPrompt,
  parseClassification,
  processInsights,
  saveInsight,
  trackTokenUsage,
  loadTokenStatsByDay,
  listTopics,
  log,
  rotateLog,
  type Config,
  type QmdSearchFn,
  type QmdHit,
  type TokenUsage,
} from "../index.js";

// ─── Environment ──────────────────────────────────────────────────────────

const CWD = process.env.WORK_CWD || process.cwd();

// ─── QMD search via CLI (injected into core as QmdSearchFn) ──────────────

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

// ─── Anthropic SDK for classification ─────────────────────────────────────

const anthropic = new Anthropic(); // uses ANTHROPIC_API_KEY from env

async function classifyConversation(
  project: string,
  conversation: string,
  config: Config
): Promise<{ text: string; usage: TokenUsage }> {
  const insightsRoot = config.insights_root!;
  const existingTopics = collectExistingTopics(insightsRoot, project);
  const prompt = buildClassifyPrompt(project, existingTopics, conversation);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens:
        response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

// ─── MCP Server ───────────────────────────────────────────────────────────

const server = new McpServer({
  name: "memory-keeper",
  version: "0.1.0",
});

// --- Tool: memory_context ---
server.tool(
  "memory_context",
  "Get project context from persistent memory (summary + topics). Call at session start or when switching projects.",
  { cwd: z.string().optional().describe("Working directory (default: WORK_CWD env)") },
  async ({ cwd }) => {
    const config = loadConfig();
    if (!config.insights_root) {
      return { content: [{ type: "text" as const, text: "No insights_root configured." }] };
    }

    const dir = cwd || CWD;
    const project = detectProject(dir);
    const summary = findProjectSummary(config.insights_root, dir);
    const topics = listTopics(config.insights_root, project);

    let text = `# Project: ${project}\n\n`;
    if (summary) {
      text += summary + "\n\n";
    }
    if (topics.length > 0) {
      text += "## Known Topics\n\n";
      for (const cat of topics) {
        text += `### ${cat.category}\n`;
        for (const t of cat.topics) {
          text += `- ${t}\n`;
        }
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
    category: z.string().optional().describe("Technology category slug (e.g. 'go', 'k8s', 'typescript')"),
    repo: z.string().optional().describe("Target repository (default: detected from cwd)"),
  },
  async ({ classification, topic, body, category, repo }) => {
    const config = loadConfig();
    if (!config.insights_root) {
      return { content: [{ type: "text" as const, text: "Error: no insights_root configured." }] };
    }

    const project = repo || detectProject(CWD);
    const savedTo = saveInsight(
      config.insights_root,
      project,
      classification,
      topic,
      body,
      category
    );

    if (savedTo) {
      log(`MCP memory_save: saved "${topic}" to ${savedTo}`);
      return {
        content: [{ type: "text" as const, text: `Saved "${topic}" to ${savedTo}` }],
      };
    } else {
      log(`MCP memory_save: dedup skipped "${topic}"`);
      return {
        content: [
          { type: "text" as const, text: `Skipped "${topic}" (duplicate detected)` },
        ],
      };
    }
  }
);

// --- Tool: memory_extract ---
server.tool(
  "memory_extract",
  "Extract insights from conversation text. Classifies via LLM, deduplicates, and saves. Use at session end or periodically.",
  {
    conversation: z.string().describe("Recent conversation text to analyze"),
    project: z.string().optional().describe("Project name (default: detected from cwd)"),
  },
  async ({ conversation, project: projectArg }) => {
    const config = loadConfig();
    if (!config.insights_root) {
      return { content: [{ type: "text" as const, text: "Error: no insights_root configured." }] };
    }

    const project = projectArg || detectProject(CWD);
    const sessionId = `mcp-extract-${Date.now()}`;

    try {
      const { text, usage } = await classifyConversation(
        project,
        conversation,
        config
      );
      const insights = parseClassification(text);

      if (insights.length === 0) {
        trackTokenUsage(sessionId, project, usage, 0);
        return {
          content: [
            {
              type: "text" as const,
              text: `No insights found. (${usage.totalTokens} tokens used)`,
            },
          ],
        };
      }

      const { savedCount, skippedCount } = processInsights(
        insights,
        config.insights_root,
        project,
        qmdSearch
      );

      trackTokenUsage(sessionId, project, usage, savedCount);
      log(
        `MCP memory_extract: saved=${savedCount} skipped=${skippedCount} tokens=${usage.totalTokens}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Extracted ${insights.length} entries: ${savedCount} saved, ${skippedCount} skipped. (${usage.totalTokens} tokens)`,
          },
        ],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`ERROR MCP memory_extract: ${msg}`);
      return {
        content: [
          { type: "text" as const, text: `Extraction failed: ${msg}` },
        ],
      };
    }
  }
);

// --- Tool: memory_stats ---
server.tool(
  "memory_stats",
  "Show token usage statistics for insight extraction (last N days).",
  { days: z.number().optional().describe("Number of days to show (default: 10)") },
  async ({ days }) => {
    const stats = loadTokenStatsByDay(days || 10);
    if (stats.length === 0) {
      return { content: [{ type: "text" as const, text: "No token stats yet." }] };
    }

    const totals = stats.reduce(
      (acc, d) => {
        acc.sessions += d.sessions;
        acc.totalTokens += d.totalTokens;
        acc.savedCount += d.savedCount;
        return acc;
      },
      { sessions: 0, totalTokens: 0, savedCount: 0 }
    );

    let text = `Memory Keeper Stats — last ${stats.length} day(s)\n\n`;
    text += `  #  Date         Sessions   Tokens  Insights\n`;
    text += `  —— ———————————— ———————— ———————— ————————\n`;
    for (let i = 0; i < stats.length; i++) {
      const d = stats[i];
      const idx = String(i + 1).padStart(2);
      const sess = String(d.sessions).padStart(8);
      const tok = d.totalTokens.toLocaleString().padStart(8);
      const ins = String(d.savedCount).padStart(8);
      text += `  ${idx} ${d.date} ${sess} ${tok} ${ins}${i === 0 ? " ◀" : ""}\n`;
    }
    text += `  —— ———————————— ———————— ———————— ————————\n`;
    text += `     Total       ${String(totals.sessions).padStart(8)} ${totals.totalTokens.toLocaleString().padStart(8)} ${String(totals.savedCount).padStart(8)}\n`;

    return { content: [{ type: "text" as const, text }] };
  }
);

// --- Tool: memory_topics ---
server.tool(
  "memory_topics",
  "List existing topics/categories for a project in persistent memory.",
  {
    project: z.string().optional().describe("Project name (default: detected from cwd)"),
  },
  async ({ project: projectArg }) => {
    const config = loadConfig();
    if (!config.insights_root) {
      return { content: [{ type: "text" as const, text: "No insights_root configured." }] };
    }

    const project = projectArg || detectProject(CWD);
    const topics = listTopics(config.insights_root, project);

    if (topics.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `No topics found for project "${project}".` },
        ],
      };
    }

    let text = `# Topics for ${project}\n\n`;
    for (const cat of topics) {
      text += `## ${cat.category} (${cat.topics.length})\n`;
      for (const t of cat.topics) {
        text += `- ${t}\n`;
      }
      text += "\n";
    }

    return { content: [{ type: "text" as const, text }] };
  }
);

// ─── Start server ─────────────────────────────────────────────────────────

async function main() {
  rotateLog();
  log(`INFO MCP server starting cwd=${CWD}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log(`INFO MCP server connected`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  log(`FATAL MCP server error: ${msg}`);
  process.exit(1);
});

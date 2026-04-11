#!/usr/bin/env node
/**
 * Drain worker process.
 * Runs one queue-processing pass (batchSize=1) in an isolated process so
 * blocking CLI calls (pi/qmd) do not block daemon HTTP/SSE event loop.
 */

import { execSync, execFileSync } from "child_process";
import {
  openQueue,
  closeQueue,
  processQueue,
  type Config,
  type QmdSearchFn,
  type QmdHit,
  type TokenUsage,
} from "../index.js";

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

function createLlmCallFn(config: Config): (prompt: string) => Promise<{ text: string; usage: TokenUsage }> {
  const provider = config.llm_provider || "openrouter";
  const model = config.llm_model || config.openrouter_model || "google/gemma-4-31b-it:free";
  const apiKey = config.llm_api_key || config.openrouter_api_key || "";

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

    const output = execFileSync("pi", args, {
      encoding: "utf8",
      timeout: 60_000,
      input: prompt,
      env,
      maxBuffer: 10 * 1024 * 1024,
    });

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

    if (!text) throw new Error("Pi CLI returned no assistant text");
    return { text, usage };
  };
}

async function main() {
  const configEncoded = process.env.MK_WORKER_CONFIG_B64 || "";
  const insightsRoot = process.env.MK_WORKER_INSIGHTS_ROOT || "";
  if (!configEncoded || !insightsRoot) {
    throw new Error("worker missing MK_WORKER_CONFIG_B64 or MK_WORKER_INSIGHTS_ROOT");
  }

  const config = JSON.parse(Buffer.from(configEncoded, "base64").toString("utf8")) as Config;

  openQueue();
  try {
    const result = await processQueue({
      batchSize: 1,
      llmCallFn: createLlmCallFn(config),
      qmdSearchFn: qmdSearch,
      insightsRoot,
    });
    process.stdout.write(JSON.stringify(result));
  } finally {
    closeQueue();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(msg + "\n");
  process.exit(1);
});

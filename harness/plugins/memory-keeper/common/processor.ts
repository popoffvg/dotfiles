/**
 * Queue processor — drain function that takes items off the SQLite queue
 * and processes them through classify → dedup → save pipeline.
 *
 * Injected dependencies (llmCallFn, qmdSearchFn) allow both Claude and Pi
 * adapters to provide their own LLM + search backends.
 */

import { createLogger } from "./logger.js";
import { dequeue, markDone, markFailed } from "./queue.js";
import {
  collectExistingTopics,
  buildClassifyPrompt,
  parseClassification,
  processInsights,
  trackTokenUsage,
  type TokenUsage,
  type QmdSearchFn,
} from "./memory.js";

const log = createLogger("drain");

// ─── Types ───────────────────────────────────────────────────────────────

export interface ProcessQueueOptions {
  batchSize?: number; // default: 5
  llmCallFn: (prompt: string) => Promise<{ text: string; usage: TokenUsage }>;
  qmdSearchFn?: QmdSearchFn;
  insightsRoot: string;
  onItemDone?: (
    id: number,
    result: { savedCount: number; usage: TokenUsage }
  ) => void;
}

export interface ProcessQueueResult {
  processed: number;
  saved: number;
  skipped: number;
  failed: number;
}

// ─── Main ────────────────────────────────────────────────────────────────

export async function processQueue(
  opts: ProcessQueueOptions
): Promise<ProcessQueueResult> {
  const { batchSize = 5, llmCallFn, qmdSearchFn, insightsRoot, onItemDone } =
    opts;

  const items = dequeue(batchSize);
  if (items.length === 0) {
    return { processed: 0, saved: 0, skipped: 0, failed: 0 };
  }

  let totalSaved = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const item of items) {
    try {
      const existingTopics = collectExistingTopics(insightsRoot, item.project);
      const prompt = buildClassifyPrompt(
        item.project,
        existingTopics,
        item.conversation
      );

      const { text, usage } = await llmCallFn(prompt);
      const insights = parseClassification(text);

      let savedCount = 0;
      let skippedCount = 0;

      if (insights.length > 0) {
        const result = processInsights(
          insights,
          insightsRoot,
          item.project,
          qmdSearchFn
        );
        savedCount = result.savedCount;
        skippedCount = result.skippedCount;
      }

      trackTokenUsage(
        item.sessionId,
        item.project,
        usage,
        savedCount,
        item.source === "claude" ? "claude" : "pi"
      );
      markDone(item.id);

      totalSaved += savedCount;
      totalSkipped += skippedCount;

      log.info(
        { id: item.id, sessionId: item.sessionId, savedCount, skippedCount },
        "item processed"
      );

      onItemDone?.(item.id, { savedCount, usage });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      markFailed(item.id, msg, item.retryCount + 1);
      totalFailed++;
      log.error({ id: item.id, err: msg, retryCount: item.retryCount }, "item failed");
    }
  }

  return {
    processed: items.length,
    saved: totalSaved,
    skipped: totalSkipped,
    failed: totalFailed,
  };
}

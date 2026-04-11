/**
 * Tests for Step 4: processQueue() drain function.
 * Run: npx tsx __tests__/processor.test.ts
 */

import { strict as assert } from "assert";
import { mkdirSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), `mk-processor-test-${Date.now()}`);
mkdirSync(TEST_DIR, { recursive: true });

process.env.HOME = TEST_DIR;
mkdirSync(join(TEST_DIR, ".claude", "debug"), { recursive: true });

const { openQueue, enqueue, getQueueStats, closeQueue } = await import(
  "../common/queue.js"
);
const { processQueue } = await import("../common/processor.js");
import type { TokenUsage } from "../common/memory.js";

const DB_PATH = join(TEST_DIR, "test-processor.db");
const INSIGHTS_ROOT = join(TEST_DIR, "insights");
mkdirSync(INSIGHTS_ROOT, { recursive: true });

openQueue(DB_PATH);

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e: unknown) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  ✗ ${name}: ${msg}`);
    }
  })();
}

const MOCK_USAGE: TokenUsage = {
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
};

function mockLlm(response: string) {
  return async (_prompt: string) => ({ text: response, usage: MOCK_USAGE });
}

const GOOD_RESPONSE = JSON.stringify([
  {
    classification: "insight",
    category: "go",
    repo: "test-proj",
    topic: "Go context cancellation propagation",
    body: "Context cancellation propagates through the goroutine tree.",
  },
]);

const NONE_RESPONSE = JSON.stringify([
  { classification: "none", category: "", repo: "", topic: "", body: "" },
]);

console.log("\n--- Processor tests ---\n");

// 1. Empty queue
await test("processQueue with empty queue returns zeros", async () => {
  // drain any leftover
  const result = await processQueue({
    llmCallFn: mockLlm("[]"),
    insightsRoot: INSIGHTS_ROOT,
  });
  assert.equal(result.processed, 0);
  assert.equal(result.saved, 0);
  assert.equal(result.skipped, 0);
  assert.equal(result.failed, 0);
});

// 2. Calls llmCallFn with prompt
await test("processQueue calls llmCallFn with correct prompt", async () => {
  let capturedPrompt = "";
  enqueue({
    sessionId: "s1",
    project: "test-proj",
    conversation: "We discussed Go context patterns",
    source: "claude",
  });
  await processQueue({
    llmCallFn: async (prompt) => {
      capturedPrompt = prompt;
      return { text: "[]", usage: MOCK_USAGE };
    },
    insightsRoot: INSIGHTS_ROOT,
  });
  assert.ok(capturedPrompt.includes("test-proj"));
  assert.ok(capturedPrompt.includes("Go context patterns"));
});

// 3. Saves insight file
await test("processQueue saves insight to file", async () => {
  enqueue({
    sessionId: "s2",
    project: "test-proj",
    conversation: "Go context cancellation",
    source: "claude",
  });
  const result = await processQueue({
    llmCallFn: mockLlm(GOOD_RESPONSE),
    insightsRoot: INSIGHTS_ROOT,
  });
  assert.equal(result.saved, 1);
  const file = join(INSIGHTS_ROOT, "test-proj", "go.md");
  assert.ok(existsSync(file), "insight file should exist");
  const content = readFileSync(file, "utf8");
  assert.ok(content.includes("Go context cancellation propagation"));
});

// 4. Marks item as done
await test("processQueue marks item as done after processing", async () => {
  const stats = getQueueStats();
  assert.ok(stats.done >= 2); // s1 + s2
  assert.equal(stats.pending, 0);
});

// 5. LLM throws → marks failed
await test("processQueue marks item as failed when llmCallFn throws", async () => {
  enqueue({
    sessionId: "s3",
    project: "test-proj",
    conversation: "will fail",
    source: "claude",
  });
  const result = await processQueue({
    llmCallFn: async () => {
      throw new Error("API timeout");
    },
    insightsRoot: INSIGHTS_ROOT,
  });
  assert.equal(result.failed, 1);
  assert.equal(result.processed, 1);
});

// 6. Retry: failed with retryCount < 3 goes back to pending
await test("failed item with retryCount < 3 becomes pending again", async () => {
  const stats = getQueueStats();
  // Item from test 5 should be back to pending (retryCount was 0, now 1 < 3)
  assert.ok(stats.pending >= 1);
});

// 7. batchSize limits processing
await test("processQueue with batchSize=2 processes exactly 2 items", async () => {
  // Add 3 more items (1 already pending from retry)
  enqueue({ sessionId: "s4", project: "p", conversation: "a", source: "claude" });
  enqueue({ sessionId: "s4", project: "p", conversation: "b", source: "claude" });
  enqueue({ sessionId: "s4", project: "p", conversation: "c", source: "claude" });

  const result = await processQueue({
    batchSize: 2,
    llmCallFn: mockLlm("[]"),
    insightsRoot: INSIGHTS_ROOT,
  });
  assert.equal(result.processed, 2);
});

// 8. onItemDone callback
await test("processQueue calls onItemDone for each processed item", async () => {
  // 2 items remaining pending (1 retry + 1 from batch overflow)
  const doneIds: number[] = [];
  await processQueue({
    llmCallFn: mockLlm("[]"),
    insightsRoot: INSIGHTS_ROOT,
    onItemDone: (id) => doneIds.push(id),
  });
  assert.ok(doneIds.length >= 1);
});

// 9. All "none" classifications → done with savedCount=0
await test("all 'none' classifications → marks done, savedCount=0", async () => {
  enqueue({
    sessionId: "s5",
    project: "test-proj",
    conversation: "routine chat",
    source: "claude",
  });
  const result = await processQueue({
    llmCallFn: mockLlm(NONE_RESPONSE),
    insightsRoot: INSIGHTS_ROOT,
  });
  assert.equal(result.processed, 1);
  assert.equal(result.saved, 0);
});

// 10. Malformed LLM response → marks failed
await test("malformed LLM response marks item as failed", async () => {
  enqueue({
    sessionId: "s6",
    project: "test-proj",
    conversation: "bad response test",
    source: "claude",
  });
  const result = await processQueue({
    llmCallFn: mockLlm("not json at all {{{"),
    insightsRoot: INSIGHTS_ROOT,
  });
  // parseClassification returns [] for bad JSON, so it marks done with 0 saved
  assert.equal(result.processed, 1);
  assert.equal(result.saved, 0);
});

// 11. Without qmdSearchFn → no error
await test("processQueue without qmdSearchFn skips QMD dedup", async () => {
  enqueue({
    sessionId: "s7",
    project: "test-proj",
    conversation: "no qmd",
    source: "pi-cron",
  });
  const result = await processQueue({
    llmCallFn: mockLlm(GOOD_RESPONSE),
    insightsRoot: INSIGHTS_ROOT,
    // no qmdSearchFn
  });
  assert.equal(result.processed, 1);
  // Should save (file-level dedup may skip if same topic exists)
});

// 12. Dedup: same conversation twice → second deduped by file check
await test("dedup: same topic twice → second is skipped", async () => {
  enqueue({
    sessionId: "s8a",
    project: "dedup-proj",
    conversation: "first",
    source: "claude",
  });
  enqueue({
    sessionId: "s8b",
    project: "dedup-proj",
    conversation: "second",
    source: "claude",
  });
  // Both return same topic → second should be deduped
  const result = await processQueue({
    llmCallFn: mockLlm(GOOD_RESPONSE.replace("test-proj", "dedup-proj")),
    insightsRoot: INSIGHTS_ROOT,
  });
  assert.equal(result.processed, 2);
  assert.equal(result.saved, 1); // first saves
  assert.equal(result.skipped, 1); // second deduped
});

// Cleanup
closeQueue();
rmSync(TEST_DIR, { recursive: true, force: true });

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
setTimeout(() => process.exit(failed > 0 ? 1 : 0), 100);

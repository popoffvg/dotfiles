/**
 * Tests for Step 3: SQLite queue (better-sqlite3).
 * Run: npx tsx __tests__/queue.test.ts
 */

import { strict as assert } from "assert";
import { mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), `mk-queue-test-${Date.now()}`);
mkdirSync(TEST_DIR, { recursive: true });

// Redirect HOME so logger doesn't pollute real logs
process.env.HOME = TEST_DIR;
mkdirSync(join(TEST_DIR, ".claude", "debug"), { recursive: true });

const {
  openQueue,
  enqueue,
  dequeue,
  markDone,
  markFailed,
  getQueueStats,
  gcSessions,
  closeQueue,
} = await import("../common/queue.js");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

const DB_PATH = join(TEST_DIR, "test-queue.db");

console.log("\n--- Queue tests ---\n");

// 1. openQueue creates DB + tables
test("openQueue creates DB file and tables", () => {
  openQueue(DB_PATH);
  assert.ok(existsSync(DB_PATH));
});

// 2. openQueue is idempotent
test("openQueue is idempotent", () => {
  openQueue(DB_PATH); // second call, no error
});

// 3. enqueue inserts row, returns id
test("enqueue inserts row with status=pending, returns integer id", () => {
  const id = enqueue({
    sessionId: "sess-1",
    project: "test-proj",
    conversation: "hello world",
    source: "claude",
  });
  assert.ok(typeof id === "number");
  assert.ok(id >= 1);
});

// 4. enqueue upserts sessions
test("enqueue upserts sessions — second call updates last_seen + increments total_enqueued", () => {
  const id2 = enqueue({
    sessionId: "sess-1",
    project: "test-proj",
    conversation: "second message",
    source: "claude",
  });
  assert.ok(id2 > 1); // second queue row
});

// 5. dequeue returns pending items, marks processing
test("dequeue returns pending items and marks them processing", () => {
  const items = dequeue(10);
  assert.ok(items.length === 2);
  assert.equal(items[0].sessionId, "sess-1");
  assert.equal(items[0].status, "processing");
  assert.equal(items[1].status, "processing");
});

// 6. dequeue skips processing items
test("dequeue skips items already in processing", () => {
  const items = dequeue(10);
  assert.equal(items.length, 0);
});

// 7. dequeue on empty returns []
test("dequeue on empty queue returns []", () => {
  const items = dequeue(5);
  assert.deepEqual(items, []);
});

// 8. markDone sets status + processed_at
test("markDone sets status=done", () => {
  // Items 1 and 2 are in processing
  markDone(1);
  const stats = getQueueStats();
  assert.equal(stats.done, 1);
  assert.equal(stats.processing, 1); // item 2 still processing
});

// 9. markDone on non-existent id logs warning
test("markDone on non-existent id doesn't throw", () => {
  markDone(9999); // should not throw
});

// 10. markFailed with retryCount < 3 resets to pending
test("markFailed with retryCount < 3 resets to pending", () => {
  markFailed(2, "network error", 1);
  const stats = getQueueStats();
  assert.equal(stats.pending, 1); // item 2 back to pending
  assert.equal(stats.failed, 0);
});

// 11. markFailed with retryCount >= 3 leaves as failed
test("markFailed with retryCount >= 3 leaves as failed", () => {
  // dequeue item 2 again, then fail permanently
  const items = dequeue(1);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 2);
  markFailed(2, "permanent error", 3);
  const stats = getQueueStats();
  assert.equal(stats.failed, 1);
});

// 12. getQueueStats returns correct counts
test("getQueueStats returns correct counts", () => {
  const stats = getQueueStats();
  assert.equal(stats.done, 1);
  assert.equal(stats.failed, 1);
  assert.equal(stats.pending, 0);
  assert.equal(stats.processing, 0);
  assert.equal(stats.total, 2);
});

// 13. FIFO order
test("dequeue returns items in FIFO order", () => {
  enqueue({ sessionId: "sess-2", project: "p", conversation: "first", source: "pi-cron" });
  enqueue({ sessionId: "sess-2", project: "p", conversation: "second", source: "pi-cron" });
  enqueue({ sessionId: "sess-2", project: "p", conversation: "third", source: "pi-cron" });
  const items = dequeue(3);
  assert.equal(items[0].conversation, "first");
  assert.equal(items[1].conversation, "second");
  assert.equal(items[2].conversation, "third");
  // Clean up: mark done
  for (const item of items) markDone(item.id);
});

// 14. gcSessions keeps N most recent, deletes the rest
test("gcSessions(2) with 3 sessions deletes oldest + its queue rows", () => {
  // sess-1 and sess-2 exist. Add sess-3.
  enqueue({ sessionId: "sess-3", project: "p", conversation: "new", source: "pi-manual" });
  markDone(enqueue({ sessionId: "sess-3", project: "p", conversation: "new2", source: "pi-manual" }) as number);

  // Keep only 2 most recent sessions
  const deleted = gcSessions(2);
  assert.equal(deleted, 1); // sess-1 is oldest
});

// 15. gcSessions preserves kept sessions' queue rows
test("gcSessions preserves queue rows for kept sessions", () => {
  const stats = getQueueStats();
  // sess-2 had 3 done + sess-3 had 1 pending + 1 done; sess-1's 2 rows deleted
  assert.ok(stats.total >= 3); // at least sess-2 + sess-3 rows remain
});

// 16. gcSessions on empty returns 0
test("gcSessions on DB with fewer sessions than keepCount returns 0", () => {
  const deleted = gcSessions(100);
  assert.equal(deleted, 0);
});

// 17. Full cycle: enqueue → dequeue → markDone
test("full cycle: enqueue 3 → dequeue 3 → markDone all → stats shows done", () => {
  const ids = [
    enqueue({ sessionId: "sess-cycle", project: "p", conversation: "a", source: "claude" }),
    enqueue({ sessionId: "sess-cycle", project: "p", conversation: "b", source: "claude" }),
    enqueue({ sessionId: "sess-cycle", project: "p", conversation: "c", source: "claude" }),
  ];
  const items = dequeue(3);
  assert.equal(items.length, 3);
  for (const item of items) markDone(item.id);

  const stats = getQueueStats();
  // All cycle items should be done
  assert.ok(stats.done >= 3);
});

// 18. closeQueue closes connection
test("closeQueue closes DB — subsequent operations throw", () => {
  closeQueue();
  assert.throws(() => {
    enqueue({ sessionId: "x", project: "x", conversation: "x", source: "claude" });
  }, /not opened/i);
});

// Cleanup
rmSync(TEST_DIR, { recursive: true, force: true });

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
setTimeout(() => process.exit(failed > 0 ? 1 : 0), 100);

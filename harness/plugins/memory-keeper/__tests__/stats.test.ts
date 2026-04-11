/**
 * Tests for Step 2: stats formatting, QMD tracking, health banner.
 * Run: npx tsx __tests__/stats.test.ts
 */

import { strict as assert } from "assert";
import { mkdirSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// We test the functions directly from memory.ts via dynamic import
// but first we need to set up env so LOG_DIR doesn't pollute real logs.
const TEST_DIR = join(tmpdir(), `mk-stats-test-${Date.now()}`);
mkdirSync(TEST_DIR, { recursive: true });

// Patch homedir so LOG_DIR goes to temp
process.env.HOME = TEST_DIR;
// logger.ts reads homedir() at import time, so we create the expected dir
mkdirSync(join(TEST_DIR, ".claude", "debug"), { recursive: true });

const {
  trackTokenUsage,
  trackQmdUsage,
  loadTokenStatsByDay,
  formatStatsTable,
  formatStatsDayDetail,
  formatHealthBanner,
  TOKEN_STATS_FILE,
  QMD_STATS_FILE,
} = await import("../common/memory.js");

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

console.log("\n--- Stats tests ---\n");

// 1. trackTokenUsage appends JSONL
test("trackTokenUsage appends JSONL line with correct fields", () => {
  trackTokenUsage("sess-1", "test-proj", { inputTokens: 100, outputTokens: 50, totalTokens: 150 }, 3);
  assert.ok(existsSync(TOKEN_STATS_FILE), "stats file should exist");
  const line = readFileSync(TOKEN_STATS_FILE, "utf8").trim().split("\n").pop()!;
  const entry = JSON.parse(line);
  assert.equal(entry.session, "sess-1");
  assert.equal(entry.project, "test-proj");
  assert.equal(entry.input_tokens, 100);
  assert.equal(entry.output_tokens, 50);
  assert.equal(entry.total_tokens, 150);
  assert.equal(entry.saved_count, 3);
  assert.ok(entry.timestamp);
});

// 2. loadTokenStatsByDay returns correct aggregation
test("loadTokenStatsByDay aggregates multiple sessions on same day", () => {
  trackTokenUsage("sess-2", "test-proj", { inputTokens: 200, outputTokens: 100, totalTokens: 300 }, 2);
  const days = loadTokenStatsByDay(10);
  assert.ok(days.length >= 1);
  const today = days[0];
  assert.equal(today.sessions, 2); // sess-1 + sess-2
  assert.equal(today.totalTokens, 450); // 150 + 300
  assert.equal(today.savedCount, 5); // 3 + 2
});

// 3. loadTokenStatsByDay respects limit
test("loadTokenStatsByDay(1) returns max 1 day", () => {
  const days = loadTokenStatsByDay(1);
  assert.ok(days.length <= 1);
});

// 4. loadTokenStatsByDay returns array
test("loadTokenStatsByDay returns array", () => {
  const days = loadTokenStatsByDay(10);
  assert.ok(Array.isArray(days));
});

// 5. trackQmdUsage
test("trackQmdUsage appends JSONL with tool, query, result_count", () => {
  trackQmdUsage("qmd_search", { query: "test query" }, "## Result 1\n---\n## Result 2");
  assert.ok(existsSync(QMD_STATS_FILE));
  const line = readFileSync(QMD_STATS_FILE, "utf8").trim().split("\n").pop()!;
  const entry = JSON.parse(line);
  assert.equal(entry.tool, "qmd_search");
  assert.equal(entry.query, "test query");
  assert.ok(entry.result_count > 0);
  assert.equal(entry.zero_results, false);
});

// 6. trackQmdUsage counts zero results
test("trackQmdUsage detects zero results", () => {
  trackQmdUsage("qmd_search", { query: "nothing" }, "");
  const lines = readFileSync(QMD_STATS_FILE, "utf8").trim().split("\n");
  const entry = JSON.parse(lines[lines.length - 1]);
  assert.equal(entry.zero_results, true);
  assert.equal(entry.result_count, 0);
});

// 7. formatStatsTable
test("formatStatsTable produces table with header, rows, totals", () => {
  const days = loadTokenStatsByDay(10);
  const table = formatStatsTable(days);
  assert.ok(table.includes("Memory Keeper Stats"));
  assert.ok(table.includes("Date"));
  assert.ok(table.includes("Sessions"));
  assert.ok(table.includes("Tokens"));
  assert.ok(table.includes("Insights"));
  assert.ok(table.includes("Total"));
  assert.ok(table.includes("◀")); // latest day marker
});

// 8. formatStatsTable empty
test("formatStatsTable([]) returns 'No token stats yet.'", () => {
  assert.equal(formatStatsTable([]), "No token stats yet.");
});

// 9. formatStatsDayDetail
test("formatStatsDayDetail includes all fields", () => {
  const detail = formatStatsDayDetail({
    date: "2026-04-11",
    sessions: 5,
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
    savedCount: 10,
  });
  assert.ok(detail.includes("2026-04-11"));
  assert.ok(detail.includes("5")); // sessions
  assert.ok(detail.includes("1,500")); // total tokens
  assert.ok(detail.includes("1,000")); // input
  assert.ok(detail.includes("500")); // output
  assert.ok(detail.includes("10")); // insights
});

// 10. formatHealthBanner with stats
test("formatHealthBanner with today's stats", () => {
  const banner = formatHealthBanner(
    [{ date: "2026-04-11", sessions: 3, inputTokens: 800, outputTokens: 400, totalTokens: 1200, savedCount: 5 }],
    { pending: 0, failed: 0, totalSessions: 42 }
  );
  assert.ok(banner.includes("memory-keeper:"));
  assert.ok(banner.includes("5 insights today"));
  assert.ok(banner.includes("1.2k tokens"));
  assert.ok(banner.includes("42 sessions tracked"));
  // No queue section when pending=0 and failed=0
  assert.ok(!banner.includes("queue:"));
});

// 11. formatHealthBanner no stats
test("formatHealthBanner with no stats", () => {
  const banner = formatHealthBanner();
  assert.ok(banner.includes("✗ no stats yet"));
});

// 12. formatHealthBanner with failed queue items
test("formatHealthBanner shows warning for failed queue items", () => {
  const banner = formatHealthBanner(
    [{ date: "2026-04-11", sessions: 1, inputTokens: 500, outputTokens: 350, totalTokens: 850, savedCount: 0 }],
    { pending: 2, failed: 5, totalSessions: 30 }
  );
  assert.ok(banner.includes("⚠ 5 failed in queue"));
  assert.ok(banner.includes("queue: 2 pending"));
});

// 13. formatHealthBanner token formatting
test("formatHealthBanner formats tokens correctly (850 → '850', 1200 → '1.2k', 15300 → '15.3k')", () => {
  const b1 = formatHealthBanner(
    [{ date: "2026-04-11", sessions: 1, inputTokens: 0, outputTokens: 0, totalTokens: 850, savedCount: 0 }]
  );
  assert.ok(b1.includes("850 tokens"));

  const b2 = formatHealthBanner(
    [{ date: "2026-04-11", sessions: 1, inputTokens: 0, outputTokens: 0, totalTokens: 1200, savedCount: 0 }]
  );
  assert.ok(b2.includes("1.2k tokens"));

  const b3 = formatHealthBanner(
    [{ date: "2026-04-11", sessions: 1, inputTokens: 0, outputTokens: 0, totalTokens: 15300, savedCount: 0 }]
  );
  assert.ok(b3.includes("15.3k tokens"));
});

// Cleanup
rmSync(TEST_DIR, { recursive: true, force: true });

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
// Use setTimeout to let pino's sonic-boom finish before exit
setTimeout(() => process.exit(failed > 0 ? 1 : 0), 100);

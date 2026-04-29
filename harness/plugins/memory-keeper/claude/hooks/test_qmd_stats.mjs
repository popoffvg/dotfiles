#!/usr/bin/env node
// Tests for qmd-stats.mjs hook
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOK = join(__dirname, "qmd-stats.mjs");

const testHome = mkdtempSync(join(tmpdir(), "qmd-test-"));
const statsFile = join(testHome, ".claude", "debug", "qmd-stats.jsonl");
const logFile = join(testHome, ".claude", "debug", "qmd-stats.log");

let pass = 0;
let fail = 0;

function assertEq(desc, expected, actual) {
  if (expected === actual) {
    console.log(`  PASS: ${desc}`);
    pass++;
  } else {
    console.log(`  FAIL: ${desc}`);
    console.log(`    expected: ${expected}`);
    console.log(`    actual:   ${actual}`);
    fail++;
  }
}

function assertContains(desc, needle, haystack) {
  if (haystack.includes(needle)) {
    console.log(`  PASS: ${desc}`);
    pass++;
  } else {
    console.log(`  FAIL: ${desc}`);
    console.log(`    expected to contain: ${needle}`);
    console.log(`    actual: ${haystack}`);
    fail++;
  }
}

function runHook(input) {
  execFileSync("node", [HOOK], {
    input: JSON.stringify(input),
    env: { ...process.env, HOME: testHome },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function lastJsonl() {
  const lines = readFileSync(statsFile, "utf8").trim().split("\n");
  return JSON.parse(lines[lines.length - 1]);
}

function lastLog() {
  const lines = readFileSync(logFile, "utf8").trim().split("\n");
  return lines[lines.length - 1];
}

// --- Test 1: Non-QMD tool is ignored ---
console.log("Test 1: Non-QMD tool is ignored");
runHook({ tool_name: "Bash", tool_input: {}, tool_output: "" });
if (!existsSync(statsFile)) {
  console.log("  PASS: No log file created for non-QMD tool");
  pass++;
} else {
  console.log("  FAIL: Log file should not exist for non-QMD tool");
  fail++;
}

// --- Test 2: QMD search with results ---
console.log("Test 2: QMD search with results");
runHook({
  tool_name: "mcp__qmd__search",
  tool_input: { query: "golang error handling", collection: "ctx" },
  tool_output: "## Result 1\ndocid: #abc123\nSome content\n---\n## Result 2\ndocid: #def456\nMore content",
});

let entry = lastJsonl();
assertEq("tool is search", "mcp__qmd__search", entry.tool);
assertEq("query captured", "golang error handling", entry.query);
assertEq("zero_results is false", false, entry.zero_results);
assertContains("log says OK", "OK", lastLog());

// --- Test 3: QMD search with zero results ---
console.log("Test 3: QMD search with zero results");
runHook({
  tool_name: "mcp__qmd__vector_search",
  tool_input: { query: "nonexistent topic xyz" },
  tool_output: "",
});

entry = lastJsonl();
assertEq("tool is vector_search", "mcp__qmd__vector_search", entry.tool);
assertEq("zero_results is true", true, entry.zero_results);
assertContains("log says ZERO_RESULTS", "ZERO_RESULTS", lastLog());

// --- Test 4: QMD deep_search ---
console.log("Test 4: QMD deep_search logged");
runHook({
  tool_name: "mcp__qmd__deep_search",
  tool_input: { query: "kubernetes patterns" },
  tool_output: "## Found\ndocid: #aaa111\nk8s stuff\n---\n## Found 2\ndocid: #bbb222\nmore k8s",
});

entry = lastJsonl();
assertEq("tool is deep_search", "mcp__qmd__deep_search", entry.tool);

// --- Test 5: QMD get (single doc retrieval) ---
console.log("Test 5: QMD get with content");
runHook({
  tool_name: "mcp__qmd__get",
  tool_input: { path: "journals/2025-01-15.md" },
  tool_output: "# Journal Entry\nSome long content here that is definitely more than 10 chars",
});

entry = lastJsonl();
assertEq("tool is get", "mcp__qmd__get", entry.tool);
assertEq("zero_results false for get with content", false, entry.zero_results);

// --- Test 6: JSONL file has correct line count ---
console.log("Test 6: JSONL line count");
const lineCount = readFileSync(statsFile, "utf8").trim().split("\n").length;
assertEq("4 entries in JSONL (tests 2-5)", 4, lineCount);

// --- Cleanup ---
rmSync(testHome, { recursive: true, force: true });

// --- Summary ---
console.log(`\nResults: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

#!/usr/bin/env node
// PostToolUse hook: Log QMD MCP tool usage — queries, result counts, zero-result flags.
import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const QMD_TOOLS = new Set([
  "mcp__qmd__search",
  "mcp__qmd__vector_search",
  "mcp__qmd__deep_search",
  "mcp__qmd__get",
  "mcp__qmd__multi_get",
]);

const LOG_DIR = join(homedir(), ".claude", "debug");
const LOG_FILE = join(LOG_DIR, "qmd-stats.log");
const STATS_FILE = join(LOG_DIR, "qmd-stats.jsonl");

function countResults(tool, output) {
  if (!output) return 0;
  const matches = output.match(/docid|^##|^---$/gm);
  let count = matches ? matches.length : 0;
  if ((tool === "mcp__qmd__get" || tool === "mcp__qmd__multi_get") && count === 0 && output.length > 10) {
    count = 1;
  }
  return count;
}

function extractQuery(input) {
  return input.query ?? input.queries ?? input.path ?? input.paths ?? input.pattern ?? "n/a";
}

function run() {
  const raw = readFileSync("/dev/stdin", "utf8");
  const input = JSON.parse(raw);
  const tool = input.tool_name ?? "";

  if (!QMD_TOOLS.has(tool)) return;

  mkdirSync(LOG_DIR, { recursive: true });

  const toolInput = input.tool_input ?? {};
  const toolOutput = input.tool_output ?? "";
  const query = extractQuery(toolInput);
  const resultCount = countResults(tool, toolOutput);
  const zeroResults = resultCount === 0;
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);

  const entry = JSON.stringify({
    timestamp: ts,
    tool,
    query,
    result_count: resultCount,
    zero_results: zeroResults,
    raw_input: toolInput,
  });

  appendFileSync(STATS_FILE, entry + "\n");

  const logLine = zeroResults
    ? `${ts} ZERO_RESULTS tool=${tool} query=${query}`
    : `${ts} OK tool=${tool} query=${query} results=${resultCount}`;

  appendFileSync(LOG_FILE, logLine + "\n");
}

run();

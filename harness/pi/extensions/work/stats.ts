/**
 * Work Manager token usage statistics.
 *
 * Tracks token consumption by category across sessions.
 * Stored in <task>/_notes/stats.json alongside plan.md and worklog.md.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface TokenBucket {
  /** Total input tokens */
  input: number;
  /** Total output tokens */
  output: number;
  /** Total cache-read tokens */
  cacheRead: number;
  /** Total cost (USD) */
  cost: number;
  /** Number of LLM turns in this bucket */
  turns: number;
}

export interface WorkStats {
  /** Tokens for actual work: plan authoring, code implementation, research */
  work: TokenBucket;
  /** Tokens for extension overhead: skill re-injection, phase routing */
  overhead: TokenBucket;
  /** Tokens consumed by compaction passes */
  compaction: TokenBucket;
  /** Tokens for memory/insight operations (context save/load) */
  insight: TokenBucket;
  /** Session count */
  sessions: number;
  /** Total compaction count */
  compactions: number;
  /** First recorded timestamp */
  startedAt: string | null;
  /** Last updated timestamp */
  updatedAt: string | null;
}

function emptyBucket(): TokenBucket {
  return { input: 0, output: 0, cacheRead: 0, cost: 0, turns: 0 };
}

export function emptyStats(): WorkStats {
  return {
    work: emptyBucket(),
    overhead: emptyBucket(),
    compaction: emptyBucket(),
    insight: emptyBucket(),
    sessions: 0,
    compactions: 0,
    startedAt: null,
    updatedAt: null,
  };
}

export function statsPath(notesDir: string): string {
  return path.join(notesDir, "stats.json");
}

export function readStats(notesDir: string): WorkStats {
  const p = statsPath(notesDir);
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    return emptyStats();
  }
}

export function writeStats(notesDir: string, stats: WorkStats): void {
  stats.updatedAt = new Date().toISOString();
  if (!stats.startedAt) stats.startedAt = stats.updatedAt;
  fs.writeFileSync(statsPath(notesDir), JSON.stringify(stats, null, 2) + "\n");
}

export interface UsageData {
  input: number;
  output: number;
  cacheRead: number;
  cost: number;
}

export function addUsage(bucket: TokenBucket, usage: UsageData): void {
  bucket.input += usage.input;
  bucket.output += usage.output;
  bucket.cacheRead += usage.cacheRead;
  bucket.cost += usage.cost;
  bucket.turns += 1;
}

/** Format a token bucket as a single-line summary */
export function formatBucket(label: string, b: TokenBucket): string {
  const totalTok = b.input + b.output;
  const costStr = b.cost > 0 ? ` $${b.cost.toFixed(4)}` : "";
  return `${label}: ${fmtK(totalTok)} tok (${b.turns} turns)${costStr}`;
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

/** Format full stats report */
export function formatStats(stats: WorkStats): string {
  const totalInput = stats.work.input + stats.overhead.input + stats.compaction.input + stats.insight.input;
  const totalOutput = stats.work.output + stats.overhead.output + stats.compaction.output + stats.insight.output;
  const totalCost = stats.work.cost + stats.overhead.cost + stats.compaction.cost + stats.insight.cost;
  const totalTurns = stats.work.turns + stats.overhead.turns + stats.compaction.turns + stats.insight.turns;

  const lines: string[] = [
    `## Token Usage Stats`,
    ``,
    formatBucket("  Work      ", stats.work),
    formatBucket("  Overhead  ", stats.overhead),
    formatBucket("  Compaction", stats.compaction),
    formatBucket("  Insight   ", stats.insight),
    ``,
    `  Total: ${fmtK(totalInput + totalOutput)} tok (${totalTurns} turns) $${totalCost.toFixed(4)}`,
    `  Sessions: ${stats.sessions} | Compactions: ${stats.compactions}`,
  ];

  if (totalTurns > 0) {
    const workPct = ((stats.work.turns / totalTurns) * 100).toFixed(0);
    const overheadPct = ((stats.overhead.turns / totalTurns) * 100).toFixed(0);
    lines.push(`  Efficiency: ${workPct}% work / ${overheadPct}% overhead`);
  }

  if (stats.startedAt) {
    lines.push(`  Since: ${stats.startedAt.slice(0, 16).replace("T", " ")}`);
  }

  return lines.join("\n");
}

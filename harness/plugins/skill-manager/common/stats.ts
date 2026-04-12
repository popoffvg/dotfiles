/**
 * Shared stats I/O for skill-manager (Pi + Claude Code).
 * Pure TS — no Pi or MCP dependencies.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { SkillStat, Stats, DailySkillEntry, DailyScores } from "./types";

const PI_AGENT_DIR = join(homedir(), ".pi", "agent");
export const STATS_FILE = join(PI_AGENT_DIR, "skills-stats.json");
export const SCORES_DIR = join(PI_AGENT_DIR, "skills-scores");
export const SCORES_RETENTION_DAYS = 10;

// --- Stats I/O ---

export function loadStats(): Stats {
  if (!existsSync(STATS_FILE)) return {};
  try { return JSON.parse(readFileSync(STATS_FILE, "utf8")); } catch { return {}; }
}

export function saveStats(stats: Stats): void {
  writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2) + "\n", "utf8");
}

export function ensureStat(stats: Stats, name: string): SkillStat {
  if (!stats[name]) {
    stats[name] = {
      uses: 0, manualComments: 0, lastUsed: "", agentTurns: 0,
      completedTodos: 0, toolFailures: 0, sessions: 0, successes: 0,
      failures: 0, contentHash: "", contentHashDate: "",
    };
  }
  // Migrate old entries missing new fields
  const s = stats[name];
  if (s.agentTurns === undefined) s.agentTurns = 0;
  if (s.completedTodos === undefined) s.completedTodos = 0;
  if (s.toolFailures === undefined) s.toolFailures = 0;
  if (s.sessions === undefined) s.sessions = 0;
  if (s.successes === undefined) s.successes = 0;
  if (s.failures === undefined) s.failures = 0;
  if (s.contentHash === undefined) s.contentHash = "";
  if (s.contentHashDate === undefined) s.contentHashDate = "";
  if ((s as any).sessionScores !== undefined) delete (s as any).sessionScores;
  return s;
}

// --- Daily scores I/O ---

function ensureScoresDir(): void {
  if (!existsSync(SCORES_DIR)) mkdirSync(SCORES_DIR, { recursive: true });
}

export function dailyScoresPath(date: string): string {
  return join(SCORES_DIR, `${date}.json`);
}

export function loadDailyScores(date: string): DailyScores {
  const p = dailyScoresPath(date);
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
}

export function saveDailyScores(date: string, data: DailyScores): void {
  ensureScoresDir();
  writeFileSync(dailyScoresPath(date), JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function recordDailyScore(skillName: string, score: number, contentHash: string): void {
  const d = new Date().toISOString().slice(0, 10);
  const data = loadDailyScores(d);
  if (!data[skillName]) data[skillName] = { contentHash: "", scores: [] };
  data[skillName].contentHash = contentHash;
  data[skillName].scores.push(score);
  saveDailyScores(d, data);
}

export function rotateDailyScores(): void {
  ensureScoresDir();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SCORES_RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  try {
    for (const file of readdirSync(SCORES_DIR)) {
      if (!file.endsWith(".json")) continue;
      const dateStr = file.replace(".json", "");
      if (dateStr < cutoffStr) {
        try { rmSync(join(SCORES_DIR, file)); } catch {}
      }
    }
  } catch {}
}

export function loadAllDailyScores(): Map<string, { date: string; contentHash: string; scores: number[] }[]> {
  ensureScoresDir();
  const result = new Map<string, { date: string; contentHash: string; scores: number[] }[]>();
  try {
    const files = readdirSync(SCORES_DIR).filter((f) => f.endsWith(".json")).sort();
    for (const file of files) {
      const dateStr = file.replace(".json", "");
      const data = loadDailyScores(dateStr);
      for (const [skill, entry] of Object.entries(data)) {
        if (!result.has(skill)) result.set(skill, []);
        result.get(skill)!.push({ date: dateStr, contentHash: entry.contentHash, scores: entry.scores });
      }
    }
  } catch {}
  return result;
}

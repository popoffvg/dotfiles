/**
 * Shared types for skill-manager (Pi + Claude Code).
 */

export interface SkillStat {
  uses: number;
  manualComments: number;
  lastUsed: string;
  agentTurns: number;
  completedTodos: number;
  toolFailures: number;
  sessions: number;
  successes: number;
  failures: number;
  contentHash: string;
  contentHashDate: string;
}

export type Stats = Record<string, SkillStat>;

export interface DailySkillEntry {
  contentHash: string;
  scores: number[];
}

export type DailyScores = Record<string, DailySkillEntry>;

export interface SessionEstimate {
  combined: number;
  quality: number;
  efficiency: number;
  stability: number;
}

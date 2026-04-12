/**
 * Score a Claude Code session from JSONL events.
 *
 * Reads ~/.pi/agent/skill-stats-session.jsonl, computes quality/efficiency/stability
 * scores (matching Pi side formula), updates skills-stats.json and daily scores,
 * then removes the processed JSONL.
 */

import { readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import { loadStats, saveStats, ensureStat, loadDailyScores, saveDailyScores, rotateDailyScores } from "../../common/stats";
import { computeSessionScore, scoreLabel } from "../../common/scoring";

const PI_AGENT_DIR = join(homedir(), ".pi", "agent");
const JSONL_FILE = join(PI_AGENT_DIR, "skill-stats-session.jsonl");

interface JournalEvent {
  type: string;
  skill?: string;
  path?: string;
  ts: string;
}

function main(): void {
  if (!existsSync(JSONL_FILE)) {
    process.exit(0);
  }

  const raw = readFileSync(JSONL_FILE, "utf8").trim();
  if (!raw) {
    rmSync(JSONL_FILE, { force: true });
    process.exit(0);
  }

  const events: JournalEvent[] = raw.split("\n").map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  if (events.length === 0) {
    rmSync(JSONL_FILE, { force: true });
    process.exit(0);
  }

  // Aggregate events
  const activeSkills = new Set<string>();
  const editsPerFile = new Map<string, number>();
  let frictionCount = 0;
  let userMessageCount = 0;
  let toolUseCount = 0;
  let toolFailures = 0;

  for (const event of events) {
    switch (event.type) {
      case "skill_activate":
        if (event.skill) activeSkills.add(event.skill);
        break;
      case "file_edit":
        if (event.path) {
          editsPerFile.set(event.path, (editsPerFile.get(event.path) || 0) + 1);
        }
        toolUseCount++;
        break;
      case "friction":
        frictionCount++;
        break;
      case "user_message":
        userMessageCount++;
        break;
      case "tool_use":
        toolUseCount++;
        break;
      case "tool_failure":
        toolFailures++;
        toolUseCount++;
        break;
    }
  }

  // Compute session score
  const score = computeSessionScore(frictionCount, userMessageCount, toolUseCount, editsPerFile, toolFailures);
  const today = new Date().toISOString().slice(0, 10);

  // Update per-skill stats
  const stats = loadStats();
  for (const skillName of activeSkills) {
    const stat = ensureStat(stats, skillName);
    stat.uses++;
    stat.sessions++;
    stat.lastUsed = today;
    stat.agentTurns += toolUseCount;
    stat.toolFailures += toolFailures;
    stat.manualComments += frictionCount;
  }
  saveStats(stats);

  // Record daily score for each active skill
  const dailyData = loadDailyScores(today);
  for (const skillName of activeSkills) {
    if (!dailyData[skillName]) dailyData[skillName] = { contentHash: "", scores: [] };
    dailyData[skillName].scores.push(score.combined);
  }
  saveDailyScores(today, dailyData);

  // Rotate old score files
  rotateDailyScores();

  // Clean up processed JSONL
  rmSync(JSONL_FILE, { force: true });

  console.error(`[skill-stats] Session scored: ${score.combined}/10 (${scoreLabel(score.combined)}) — q=${score.quality} e=${score.efficiency} s=${score.stability} | skills=${activeSkills.size} friction=${frictionCount} edits=${[...editsPerFile.values()].reduce((a, b) => a + b, 0)}`);
}

main();

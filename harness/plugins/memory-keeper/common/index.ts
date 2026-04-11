export { logger, createLogger, LOG_DIR, LOG_FILE } from "./logger.js";

export {
  // Types
  type Config,
  type Insight,
  type TokenUsage,
  type ProcessResult,
  type DayStats,
  type QmdSearchFn,
  type QmdHit,

  // Constants
  TOKEN_STATS_FILE,
  CLASSIFY_PROMPT,

  // Config
  loadConfig,

  // Project
  detectProject,
  findProjectSummary,
  isExcluded,

  // Classification
  buildClassifyPrompt,
  parseClassification,
  collectExistingTopics,

  // Dedup
  extractHeadings,
  wordOverlap,
  deduplicateCheck,
  qmdDedup,

  // Saving
  saveInsight,
  processInsights,

  // Stats
  trackTokenUsage,
  loadTokenStatsByDay,
  listTopics,
} from "./memory.js";

export { logger, createLogger, LOG_DIR, LOG_FILE } from "./logger.js";

export {
  // Types
  type Config,
  type Insight,
  type TokenUsage,
  type ProcessResult,
  type DayStats,
  type QueueStats,
  type QmdSearchFn,
  type QmdHit,

  // Constants
  TOKEN_STATS_FILE,
  QMD_STATS_FILE,
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
  trackQmdUsage,
  loadTokenStatsByDay,
  formatStatsTable,
  formatStatsDayDetail,
  formatHealthBanner,

  // Topics
  listTopics,
} from "./memory.js";

export {
  openQueue,
  enqueue,
  dequeue,
  markDone,
  markFailed,
  getQueueStats,
  gcSessions,
  closeQueue,
  type QueueItem,
  type QueueStats as DbQueueStats,
  type EnqueueInput,
} from "./queue.js";

export {
  processQueue,
  type ProcessQueueOptions,
  type ProcessQueueResult,
} from "./processor.js";

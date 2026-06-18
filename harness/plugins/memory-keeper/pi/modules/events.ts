/**
 * Shared event names and payload types for skill-manager.
 * Other extensions (e.g. wm) import these to request skills.
 */

export const SKILL_EVENTS = {
  /** Request skill content by name. Skill-manager resolves with content and tracks usage. */
  LOAD: "skill:load",
  /** Report whether a skill performed correctly this session */
  FEEDBACK: "skill:feedback",
  /** Reset session stats (active skills, friction, counters). Emitter can optionally preserve active skills. */
  RESET_SESSION: "skill:reset-session",
  /** Request AGENTS_EVALS directives for specific skills. Returns common + per-skill sections. */
  GET_EVALS: "skill:get-evals",
  /** Emitted at session_shutdown with per-skill session scores. Other extensions can listen to aggregate. */
  SESSION_SCORES: "skill:session-scores",
} as const;

export interface SkillFile {
  /** Relative path within the skill directory (e.g. "SKILL.md", "references/rule_reference.md") */
  relativePath: string;
  /** Full file content */
  content: string;
}

export interface SkillLoadResult {
  /** SKILL.md content (main file) */
  skillMd: string;
  /** All files in the skill directory (including SKILL.md) */
  files: SkillFile[];
  /** Absolute path to the skill directory */
  skillDir: string;
}

export interface SkillLoadPayload {
  /** Skill name (e.g. "implement", "go-modify") */
  name: string;
  /** Callback: resolve with skill content (null if not found) */
  resolve: (result: SkillLoadResult | null) => void;
}

export interface SkillResetSessionPayload {
  /** If true, keep activeSkills map (only reset counters). Default: full reset. */
  keepActiveSkills?: boolean;
}

export interface SkillFeedbackPayload {
  /** Skill name */
  skill: string;
  /** true = skill worked correctly, false = skill failed / needed correction */
  correct: boolean;
  /** Short reason (e.g. "verify rejected: wrong approach", "plan approved") */
  reason?: string;
}

export interface SkillGetEvalsPayload {
  /** Skill names to get evaluations for. Common section is always included. */
  skills: string[];
  /** Callback: resolve with formatted eval directives string (empty if none) */
  resolve: (evals: string) => void;
}

export interface SkillSessionScoreEntry {
  /** Skill name */
  skill: string;
  /** Session score 1-10 */
  score: number;
  /** SHA-256 content hash (first 12 hex chars) of SKILL.md at session time */
  contentHash: string;
}

export interface SkillSessionScoresPayload {
  /** Date string YYYY-MM-DD */
  date: string;
  /** Per-skill scores for this session */
  entries: SkillSessionScoreEntry[];
}

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import {
  WORK_EVENTS,
  type TodoCompletedPayload,
  type ReturnToPlanPayload,
} from "../../work/pi/events";
import { SKILL_EVENTS, type SkillLoadPayload, type SkillLoadResult, type SkillFile, type SkillFeedbackPayload, type SkillResetSessionPayload, type SkillGetEvalsPayload, type SkillSessionScoresPayload, type SkillSessionScoreEntry } from "./events";
import {
  PLUGIN_WORKFLOW_EVENTS,
  type PluginWorkflowStartPayload,
  type PluginWorkflowEndPayload,
  type PluginWorkflowEventPayload,
} from "../../plugin-workflow-events/pi/index.ts";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  cpSync,
  rmSync,
  symlinkSync,
  lstatSync,
  readlinkSync,
} from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const SKILLS_DIR = join(homedir(), ".pi", "agent", "skills");
const PI_AGENT_DIR = join(homedir(), ".pi", "agent");
const STATS_FILE = join(PI_AGENT_DIR, "skills-stats.json");
const OVERRIDES_FILE = join(PI_AGENT_DIR, "skills-overrides.json");
const AGENTS_EVALS_FILE = join(homedir(), ".pi", "agent", "AGENTS_EVALS.md");
// jiti provides __dirname for TypeScript modules
const SOURCES_FILE = join(__dirname, "sources.json");

interface PluginSource {
  skillsDir: string;
  symlinkBack: boolean;
}

type Sources = Record<string, PluginSource>;

interface AutoImproveSettings {
  enabled: boolean;
  /** Trigger when manualComments/uses exceeds this value */
  correctionThreshold: number;
  /** Don't trigger until skill has this many uses */
  minUses: number;
}

interface AutoResearchSettings {
  enabled: boolean;
  /** Max number of skills to process per session shutdown */
  maxSkillsPerShutdown: number;
  /** Only auto-run when median quality is <= this value */
  maxMedianScore: number;
}

interface Settings {
  autoImprove: AutoImproveSettings;
  autoResearch: AutoResearchSettings;
}

const SETTINGS_FILE = join(__dirname, "settings.json");

const DEFAULT_SETTINGS: Settings = {
  autoImprove: {
    enabled: true,
    correctionThreshold: 0.5,
    minUses: 3,
  },
  autoResearch: {
    enabled: true,
    maxSkillsPerShutdown: 1,
    maxMedianScore: 8,
  },
};

function loadSettings(): Settings {
  if (!existsSync(SETTINGS_FILE)) return DEFAULT_SETTINGS;
  try {
    const raw = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
    return {
      autoImprove: { ...DEFAULT_SETTINGS.autoImprove, ...raw.autoImprove },
      autoResearch: { ...DEFAULT_SETTINGS.autoResearch, ...raw.autoResearch },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface Override {
  originalPath: string; // absolute path to the project skill
  project: string; // project directory (cwd when override was created)
  created: string; // ISO date
}

type Overrides = Record<string, Override>;

function expandHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

function loadOverrides(): Overrides {
  if (!existsSync(OVERRIDES_FILE)) return {};
  try {
    return JSON.parse(readFileSync(OVERRIDES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Overrides): void {
  writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2) + "\n", "utf8");
}

function loadSources(): Sources {
  if (!existsSync(SOURCES_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SOURCES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function ensureAgentsEvalsFile(): void {
  if (existsSync(AGENTS_EVALS_FILE)) return;
  mkdirSync(dirname(AGENTS_EVALS_FILE), { recursive: true });
  writeFileSync(
    AGENTS_EVALS_FILE,
    "# AGENTS_EVALS\n\nEvaluation notes that **overlay skill instructions**. Injected into the system prompt automatically.\n\n- `## Common` — directives applied to every session regardless of loaded skills.\n- `## <skill-name>` — directives applied only when that skill is active.\n\nWrite actionable directives (\"always X\", \"never Y\", \"when Z do W\"), not observations.\n\n## Common\n\n## work-plan\n\n## work-implement\n\n## work-verify\n",
    "utf8",
  );
}

interface SkillEvalEntry {
  id: number;
  date: string;
  skill: string;
  score: number;
  note: string;
  lineIndex: number;
}

const SKILL_EVAL_RE = /^- \[(\d+)\] (\d{4}-\d{2}-\d{2}) skill=([^\s]+) score=(10|[1-9]) note=(.*)$/;

function parseSkillEvalEntries(lines: string[]): SkillEvalEntry[] {
  const entries: SkillEvalEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(SKILL_EVAL_RE);
    if (!match) continue;
    entries.push({
      id: Number.parseInt(match[1], 10),
      date: match[2],
      skill: match[3],
      score: Number.parseInt(match[4], 10),
      note: match[5],
      lineIndex: i,
    });
  }
  return entries;
}

function formatSkillEvalEntry(entry: Omit<SkillEvalEntry, "lineIndex">): string {
  return `- [${entry.id}] ${entry.date} skill=${entry.skill} score=${entry.score} note=${entry.note}`;
}

function readAgentsEvalsLines(): string[] {
  ensureAgentsEvalsFile();
  return readFileSync(AGENTS_EVALS_FILE, "utf8").split("\n");
}

function writeAgentsEvalsLines(lines: string[]): void {
  writeFileSync(AGENTS_EVALS_FILE, `${lines.join("\n").replace(/\n*$/, "\n")}`, "utf8");
}

function upsertEvaluationsSection(lines: string[]): string[] {
  const hasSection = lines.some((line) => line.trim() === "## Evaluations");
  if (hasSection) return lines;
  const result = [...lines];
  if (result.length > 0 && result[result.length - 1].trim() !== "") result.push("");
  result.push("## Evaluations", "");
  return result;
}

function nextSkillEvalId(entries: SkillEvalEntry[]): number {
  return entries.length === 0 ? 1 : Math.max(...entries.map((e) => e.id)) + 1;
}

function sanitizeEvalNote(note: string): string {
  return note.replace(/\s+/g, " ").trim();
}

/**
 * Sync skills from plugin sources into the global store.
 * - New skills: copy in + git commit
 * - Existing skills: skip (user may have improved them)
 * - symlinkBack: replace plugin's original dir with symlink to global store
 *   so ${CLAUDE_PLUGIN_ROOT}/skills/<name> still resolves
 */
function syncPluginSkills(pi: ExtensionAPI): void {
  const sources = loadSources();
  const imported: string[] = [];

  for (const [pluginName, source] of Object.entries(sources)) {
    const srcDir = expandHome(source.skillsDir);
    if (!existsSync(srcDir)) continue;

    const entries = readdirSync(srcDir);
    for (const entry of entries) {
      const srcSkillDir = join(srcDir, entry);
      const srcSkillFile = join(srcSkillDir, "SKILL.md");

      // Skip if not a skill directory (could be a symlink to global store already)
      // Check if it's a symlink first — if it points to SKILLS_DIR, already synced
      try {
        const lst = lstatSync(srcSkillDir);
        if (lst.isSymbolicLink()) continue; // already a symlink, skip
      } catch {
        continue;
      }

      if (!existsSync(srcSkillFile)) continue;

      const destSkillDir = join(SKILLS_DIR, entry);

      if (!existsSync(destSkillDir)) {
        // New skill — copy into global store
        cpSync(srcSkillDir, destSkillDir, { recursive: true });
        imported.push(entry);
      }

      // Create reverse symlink if configured
      if (source.symlinkBack) {
        try {
          rmSync(srcSkillDir, { recursive: true, force: true });
          symlinkSync(destSkillDir, srcSkillDir);
        } catch {
          // symlink failed, not critical
        }
      }
    }
  }

  if (imported.length > 0) {
    // Git commit the new skills
    try {
      execSync("git add -A", { cwd: SKILLS_DIR, stdio: "pipe" });
      execSync(
        `git commit -m "import skills: ${imported.join(", ")}"`,
        { cwd: SKILLS_DIR, stdio: "pipe" }
      );
    } catch {
      // commit may fail if nothing changed
    }
  }
}

interface SkillStat {
  uses: number;
  manualComments: number;
  lastUsed: string;
  /** Total agent turns across all sessions while this skill was active */
  agentTurns: number;
  /** Number of completed TODOs while this skill was active */
  completedTodos: number;
  /** Total tool failures across all sessions while this skill was active */
  toolFailures: number;
  /** Number of sessions this skill was active in */
  sessions: number;
  /** Times skill received positive feedback */
  successes: number;
  /** Times skill received negative feedback */
  failures: number;
  /** SHA-256 hash of SKILL.md content (first 12 hex chars) */
  contentHash: string;
  /** ISO date when contentHash was last updated */
  contentHashDate: string;
}

type Stats = Record<string, SkillStat>;

function loadStats(): Stats {
  if (!existsSync(STATS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveStats(stats: Stats): void {
  writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2) + "\n", "utf8");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureStat(stats: Stats, name: string): SkillStat {
  if (!stats[name]) {
    stats[name] = { uses: 0, manualComments: 0, lastUsed: "", agentTurns: 0, completedTodos: 0, toolFailures: 0, sessions: 0, successes: 0, failures: 0, contentHash: "", contentHashDate: "" };
  }
  // Migrate old entries missing new fields
  if (stats[name].agentTurns === undefined) stats[name].agentTurns = 0;
  if (stats[name].completedTodos === undefined) stats[name].completedTodos = 0;
  if (stats[name].toolFailures === undefined) stats[name].toolFailures = 0;
  if (stats[name].sessions === undefined) stats[name].sessions = 0;
  if (stats[name].successes === undefined) stats[name].successes = 0;
  if (stats[name].failures === undefined) stats[name].failures = 0;
  if (stats[name].contentHash === undefined) stats[name].contentHash = "";
  if (stats[name].contentHashDate === undefined) stats[name].contentHashDate = "";
  // Remove legacy sessionScores array (moved to daily files)
  if ((stats[name] as any).sessionScores !== undefined) delete (stats[name] as any).sessionScores;
  return stats[name];
}

// --- Daily score files: ~/.pi/agent/skills-scores/YYYY-MM-DD.json ---
// Each file: Record<skillName, { contentHash: string, scores: number[] }>

const SCORES_DIR = join(PI_AGENT_DIR, "skills-scores");
const SCORES_RETENTION_DAYS = 10;

interface DailySkillEntry {
  contentHash: string;
  scores: number[];
}

type DailyScores = Record<string, DailySkillEntry>;

function ensureScoresDir(): void {
  if (!existsSync(SCORES_DIR)) mkdirSync(SCORES_DIR, { recursive: true });
}

function dailyScoresPath(date: string): string {
  return join(SCORES_DIR, `${date}.json`);
}

function loadDailyScores(date: string): DailyScores {
  const p = dailyScoresPath(date);
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return {}; }
}

function saveDailyScores(date: string, data: DailyScores): void {
  ensureScoresDir();
  writeFileSync(dailyScoresPath(date), JSON.stringify(data, null, 2) + "\n", "utf8");
}

/** Append a session score for a skill into today's daily file, updating content hash. */
function recordDailyScore(skillName: string, score: number, contentHash: string): void {
  const d = today();
  const data = loadDailyScores(d);
  if (!data[skillName]) data[skillName] = { contentHash: "", scores: [] };
  data[skillName].contentHash = contentHash;
  data[skillName].scores.push(score);
  saveDailyScores(d, data);
}

/** Remove daily score files older than SCORES_RETENTION_DAYS. */
function rotateDailyScores(): void {
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

/** Load all daily scores within retention window. Returns map: skillName → { date, contentHash, scores }[] */
function loadAllDailyScores(): Map<string, { date: string; contentHash: string; scores: number[] }[]> {
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

/** Compute median of a number array. Returns 0 for empty. */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Compute SHA-256 hash of content, return first 12 hex chars. */
function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

const AUTORESEARCH_FILE = join(PI_AGENT_DIR, "skills-autoresearch.json");
const AUTORESEARCH_LOCK_FILE = join(PI_AGENT_DIR, "skills-autoresearch.lock.json");
const AUTORESEARCH_LOCK_TTL_MS = 60 * 60 * 1000; // 1 hour

interface AutoresearchRules {
  evalChecklist: string[];
  testInputs: string[];
  canChange: string;
  cannotChange: string;
  minSessionsBeforeEval: number;
  runsPerExperiment: number;
}

interface AutoresearchHistoryEntry {
  skill: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  reason: string;
  baselineMedian: number;
  baselineSessions: number;
  runsPerExperiment: number;
  minSessionsBeforeEval: number;
}

interface AutoresearchState {
  active: Record<string, AutoresearchHistoryEntry>;
  history: AutoresearchHistoryEntry[];
}

function loadAutoresearchState(): AutoresearchState {
  if (!existsSync(AUTORESEARCH_FILE)) return { active: {}, history: [] };
  try {
    const parsed = JSON.parse(readFileSync(AUTORESEARCH_FILE, "utf8"));
    return {
      active: parsed.active || {},
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { active: {}, history: [] };
  }
}

function saveAutoresearchState(state: AutoresearchState): void {
  writeFileSync(AUTORESEARCH_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

interface AutoresearchLock {
  date: string;
  startedAt: string;
  skill: string;
}

function readAutoresearchLock(): AutoresearchLock | null {
  if (!existsSync(AUTORESEARCH_LOCK_FILE)) return null;
  try {
    return JSON.parse(readFileSync(AUTORESEARCH_LOCK_FILE, "utf8"));
  } catch {
    return null;
  }
}

function hasAutoresearchLockForToday(): boolean {
  const lock = readAutoresearchLock();
  if (!lock) return false;

  // Clear lock if day changed
  if (lock.date !== today()) {
    try { rmSync(AUTORESEARCH_LOCK_FILE, { force: true }); } catch {}
    return false;
  }

  // Clear stale lock after TTL
  const startedAtMs = Date.parse(lock.startedAt || "");
  if (!Number.isFinite(startedAtMs) || (Date.now() - startedAtMs) > AUTORESEARCH_LOCK_TTL_MS) {
    try { rmSync(AUTORESEARCH_LOCK_FILE, { force: true }); } catch {}
    return false;
  }

  return true;
}

function acquireAutoresearchLock(skill: string): boolean {
  if (hasAutoresearchLockForToday()) return false;
  const lock: AutoresearchLock = {
    date: today(),
    startedAt: new Date().toISOString(),
    skill,
  };
  try {
    writeFileSync(AUTORESEARCH_LOCK_FILE, JSON.stringify(lock, null, 2) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

function releaseAutoresearchLock(): void {
  try { rmSync(AUTORESEARCH_LOCK_FILE, { force: true }); } catch {}
}

function parseAutoresearchRules(skillMd: string): AutoresearchRules | null {
  const sectionMatch = skillMd.match(/## Autoresearch rules\n([\s\S]*)$/);
  if (!sectionMatch) return null;

  const section = sectionMatch[1];
  const lines = section.split("\n");

  const evalChecklist: string[] = [];
  const testInputs: string[] = [];

  let inEval = false;
  let inTests = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("**Eval checklist:**")) {
      inEval = true;
      inTests = false;
      continue;
    }
    if (line.startsWith("**Test inputs:**")) {
      inEval = false;
      inTests = true;
      continue;
    }
    if (line.startsWith("**Can change:**") || line.startsWith("**Cannot change:**") || line.startsWith("**Min sessions before eval:**") || line.startsWith("**Runs per experiment:**")) {
      inEval = false;
      inTests = false;
    }

    if (inEval) {
      const m = line.match(/^\d+\.\s+(.*)$/);
      if (m && m[1].trim()) evalChecklist.push(m[1].trim());
      continue;
    }

    if (inTests) {
      const m = line.match(/^-\s+(.*)$/);
      if (m && m[1].trim()) testInputs.push(m[1].trim());
      continue;
    }
  }

  const canChange = (section.match(/\*\*Can change:\*\*\s*(.*)/)?.[1] || "").trim();
  const cannotChange = (section.match(/\*\*Cannot change:\*\*\s*(.*)/)?.[1] || "").trim();
  const minSessionsBeforeEval = Number.parseInt(section.match(/\*\*Min sessions before eval:\*\*\s*(\d+)/)?.[1] || "5", 10);
  const runsPerExperiment = Number.parseInt(section.match(/\*\*Runs per experiment:\*\*\s*(\d+)/)?.[1] || "3", 10);

  if (evalChecklist.length === 0 || testInputs.length === 0) return null;

  return {
    evalChecklist,
    testInputs,
    canChange,
    cannotChange,
    minSessionsBeforeEval: Number.isFinite(minSessionsBeforeEval) ? Math.max(1, minSessionsBeforeEval) : 5,
    runsPerExperiment: Number.isFinite(runsPerExperiment) ? Math.max(1, runsPerExperiment) : 3,
  };
}

function incrementUse(skillName: string): void {
  const stats = loadStats();
  ensureStat(stats, skillName);
  stats[skillName].uses++;
  stats[skillName].lastUsed = today();
  saveStats(stats);
}

function incrementComments(skillName: string, count: number): void {
  if (count <= 0) return;
  const stats = loadStats();
  ensureStat(stats, skillName);
  stats[skillName].manualComments += count;
  saveStats(stats);
}

function incrementAgentTurns(skillName: string, turns: number): void {
  if (turns <= 0) return;
  const stats = loadStats();
  ensureStat(stats, skillName);
  stats[skillName].agentTurns += turns;
  saveStats(stats);
}

function incrementSessions(skillName: string): void {
  const stats = loadStats();
  ensureStat(stats, skillName);
  stats[skillName].sessions++;
  saveStats(stats);
}

/** Extract skill name from a SKILL.md path */
function skillNameFromPath(path: string): string | null {
  if (!path.endsWith("SKILL.md")) return null;
  // Parent dir name is the skill name
  return basename(dirname(path));
}

export default function (pi: ExtensionAPI) {
  // Sync plugin skills on startup and reload
  pi.on("session_start", async (_event, ctx) => {
    ensureAgentsEvalsFile();
    syncPluginSkills(pi);
    rotateDailyScores();
  });

  /** Discover project-level resource directories from cwd + 1 level of subdirectories */
  function discoverProjectResourcePaths(cwd: string): { skillPaths: string[]; promptPaths: string[] } {
    const skillPaths = new Set<string>();
    const promptPaths = new Set<string>();
    const searchDirs = [cwd];

    try {
      for (const entry of readdirSync(cwd)) {
        const sub = join(cwd, entry);
        try {
          if (statSync(sub).isDirectory() && !entry.startsWith(".")) {
            searchDirs.push(sub);
          }
        } catch {}
      }
    } catch {}

    for (const dir of searchDirs) {
      const claudeSkills = join(dir, ".claude", "skills");
      if (existsSync(claudeSkills)) skillPaths.add(claudeSkills);

      const claudeRules = join(dir, ".claude", "rules");
      if (existsSync(claudeRules)) promptPaths.add(claudeRules);
    }

    return {
      skillPaths: [...skillPaths],
      promptPaths: [...promptPaths],
    };
  }

  // Register project-level skills and rules with pi's discovery system
  pi.on("resources_discover", async (event) => {
    const { skillPaths, promptPaths } = discoverProjectResourcePaths(event.cwd);
    if (skillPaths.length === 0 && promptPaths.length === 0) return;
    return { skillPaths, promptPaths };
  });

  // Track which skills were loaded in current agent run
  let activeSkills: Map<string, string> = new Map(); // name → source
  let userMessageCount = 0;
  /** Total user messages in this session (all activity, skill-agnostic) */
  let sessionUserMessageCount = 0;
  /** Total assistant turns in this session (all activity, skill-agnostic) */
  let sessionAssistantTurns = 0;
  /** Session-level edit attempts per file (detects global thrashing) */
  let sessionEditsPerFile: Map<string, number> = new Map();
  /** Count of non-command user follow-ups in session (rough friction proxy) */
  let sessionFrictionCount = 0;
  /** Agent turns since last TODO completion (measures per-TODO effort) */
  let turnsSinceLastTodo = 0;
  /** Edit attempts per file since last TODO (detects thrashing) */
  let editsPerFile: Map<string, number> = new Map();
  /** Tool failures since last TODO */
  let toolFailures = 0;
  /** Total tool failures this session */
  let sessionToolFailures = 0;
  /** Whether session count was already incremented for active skills */
  let sessionCounted = false;
  /** Friction log: captures user correction messages during skill usage */
  let frictionLog: string[] = [];
  /** Accumulated TODO summaries for context in skill review */
  let todoSummaries: string[] = [];
  /** Map of resolved skill file paths → skill names, built from system prompt */
  let knownSkillPaths: Map<string, string> = new Map();

  function wfTaskId(task: string): string {
    return `skill-manager:${task}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  }

  function wfEvent(event: string, details?: string): void {
    pi.events.emit(PLUGIN_WORKFLOW_EVENTS.EVENT, {
      plugin: "skill-manager",
      event,
      details,
    } satisfies PluginWorkflowEventPayload);
  }

  interface SessionEstimate {
    combined: number;
    quality: number;
    efficiency: number;
    stability: number;
  }

  function currentSessionEstimate(): SessionEstimate {
    const thrashFiles = [...sessionEditsPerFile.values()].filter((count) => count >= 4).length;

    let quality = 10;
    quality -= Math.min(4, Math.round(sessionFrictionCount * 0.6));
    quality -= Math.min(4, Math.floor(sessionUserMessageCount / 5));

    let efficiency = 10;
    if (sessionAssistantTurns > 40) efficiency -= 5;
    else if (sessionAssistantTurns > 24) efficiency -= 3;
    else if (sessionAssistantTurns > 12) efficiency -= 1;
    efficiency -= Math.min(3, thrashFiles);

    let stability = 10;
    stability -= Math.min(6, Math.round(sessionToolFailures * 1.4));
    stability -= Math.min(2, thrashFiles);

    quality = Math.max(1, Math.min(10, quality));
    efficiency = Math.max(1, Math.min(10, efficiency));
    stability = Math.max(1, Math.min(10, stability));

    const weighted = (quality * 0.45) + (efficiency * 0.3) + (stability * 0.25);
    const combined = Math.max(1, Math.min(10, Math.round(weighted)));

    return { combined, quality, efficiency, stability };
  }

  function currentSessionScore(): number {
    return currentSessionEstimate().combined;
  }

  function scoreLabel(score: number): string {
    if (score >= 9) return "excellent";
    if (score >= 7) return "good";
    if (score >= 5) return "mixed";
    if (score >= 3) return "poor";
    return "awful";
  }

  let footerInstalled = false;

  function refreshFooterStatus(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    if (!footerInstalled) {
      footerInstalled = true;
      ctx.ui.setFooter((tui, theme, footerData) => {
        const unsub = footerData.onBranchChange(() => tui.requestRender());
        return {
          dispose: unsub,
          invalidate() {},
          render(width: number): string[] {
            // -- Token stats --
            let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheWrite = 0, totalCost = 0;
            for (const e of ctx.sessionManager.getBranch()) {
              if (e.type === "message" && e.message.role === "assistant") {
                const m = e.message as AssistantMessage;
                totalInput += m.usage.input;
                totalOutput += m.usage.output;
                totalCacheRead += m.usage.cacheRead;
                totalCacheWrite += m.usage.cacheWrite;
                totalCost += m.usage.cost.total;
              }
            }

            // -- PWD + branch --
            let pwd = process.cwd();
            const home = process.env.HOME || process.env.USERPROFILE;
            if (home && pwd.startsWith(home)) pwd = `~${pwd.slice(home.length)}`;
            const branch = footerData.getGitBranch();
            if (branch) pwd = `${pwd} (${branch})`;
            const sessionName = ctx.sessionManager.getSessionName();
            if (sessionName) pwd = `${pwd} • ${sessionName}`;

            // -- Stats left side --
            const fmt = (n: number) => {
              if (n < 1000) return n.toString();
              if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
              if (n < 1000000) return `${Math.round(n / 1000)}k`;
              return `${(n / 1000000).toFixed(1)}M`;
            };
            const statsParts: string[] = [];
            if (totalInput) statsParts.push(`↑${fmt(totalInput)}`);
            if (totalOutput) statsParts.push(`↓${fmt(totalOutput)}`);
            if (totalCacheRead) statsParts.push(`R${fmt(totalCacheRead)}`);
            if (totalCacheWrite) statsParts.push(`W${fmt(totalCacheWrite)}`);
            if (totalCost) statsParts.push(`$${totalCost.toFixed(3)}`);
            // Context % not available via public API, skip it
            let statsLeft = statsParts.join(" ");
            let statsLeftWidth = visibleWidth(statsLeft);
            if (statsLeftWidth > width) {
              statsLeft = truncateToWidth(statsLeft, width, "...");
              statsLeftWidth = visibleWidth(statsLeft);
            }

            // -- Right side: model --
            const modelName = ctx.model?.id || "no-model";
            let rightSide = modelName;
            if (ctx.model?.reasoning) {
              rightSide = `${modelName} • thinking`;
            }
            const rightSideWidth = visibleWidth(rightSide);
            const minPadding = 2;
            const totalNeeded = statsLeftWidth + minPadding + rightSideWidth;
            let statsLine: string;
            if (totalNeeded <= width) {
              const padding = " ".repeat(width - statsLeftWidth - rightSideWidth);
              statsLine = statsLeft + padding + rightSide;
            } else {
              const avail = width - statsLeftWidth - minPadding;
              if (avail > 0) {
                const tr = truncateToWidth(rightSide, avail, "");
                const padding = " ".repeat(Math.max(0, width - statsLeftWidth - visibleWidth(tr)));
                statsLine = statsLeft + padding + tr;
              } else {
                statsLine = statsLeft;
              }
            }

            const dimStatsLeft = theme.fg("dim", statsLeft);
            const remainder = statsLine.slice(statsLeft.length);
            const dimRemainder = theme.fg("dim", remainder);
            const pwdLine = truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."));

            // -- Extension statuses (excluding plugin-monitor) --
            const extStatuses = footerData.getExtensionStatuses();
            const otherParts: string[] = [];
            let pluginMonitorText = "";
            if (extStatuses.size > 0) {
              for (const [key, text] of Array.from(extStatuses.entries()).sort(([a], [b]) => a.localeCompare(b))) {
                const clean = text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
                if (key === "plugin-monitor") {
                  pluginMonitorText = clean;
                } else {
                  otherParts.push(clean);
                }
              }
            }

            // Line 3: other extension statuses (MCP, terminal, etc.)
            const extLine = otherParts.length > 0
              ? truncateToWidth(otherParts.join(" "), width, theme.fg("dim", "..."))
              : "";

            // Line 4: plugin-monitor + skill-manager combined
            const score = currentSessionScore();
            const active = activeSkills.size;
            const total = knownSkillPaths.size;
            const smParts: string[] = [];
            if (pluginMonitorText) smParts.push(pluginMonitorText);
            smParts.push(`🧠 session ${score}/10 (${scoreLabel(score)}) · ${active}/${total} skills`);
            const smLine = truncateToWidth(smParts.join(" "), width, theme.fg("dim", "..."));

            const lines = [pwdLine, dimStatsLeft + dimRemainder];
            if (extLine) lines.push(extLine);
            lines.push(smLine);
            return lines;
          },
        };
      });
    }
  }

  /** Content hashes for active skills (computed on first load) */
  let activeSkillHashes: Map<string, string> = new Map(); // name → hash

  function trackSkill(name: string, source: string, ctx?: ExtensionContext): void {
    if (!activeSkills.has(name)) {
      activeSkills.set(name, source);
      incrementUse(name);

      // Compute and store content hash on first activation
      if (!activeSkillHashes.has(name)) {
        const skillDir = findSkillDir(name);
        if (skillDir) {
          const skillMdPath = join(skillDir, "SKILL.md");
          try {
            const content = readFileSync(skillMdPath, "utf8");
            const hash = contentHash(content);
            activeSkillHashes.set(name, hash);
            // Update persistent stat
            const stats = loadStats();
            ensureStat(stats, name);
            stats[name].contentHash = hash;
            stats[name].contentHashDate = today();
            saveStats(stats);
          } catch {}
        }
      }
    }
    if (ctx) refreshFooterStatus(ctx);
  }

  /** Comments already attributed to stats (to avoid double-counting across agent turns) */
  let attributedComments = 0;
  const LOW_SCORE_EVAL_THRESHOLD = 6;
  /** Skills already sent to improve agent this session */
  let improvedSkills: Set<string> = new Set();
  /** Friction log length at last improve trigger — skip if no new friction */
  let frictionAtLastImprove = 0;
  /** Prevent duplicate low-score background evaluation in a single session */
  let lowScoreEvalTriggered = false;
  /** Prevent duplicate critical (<3) background evaluation in a single session */
  let criticalScoreEvalTriggered = false;

  // Reset per session, not per agent turn — skills and friction accumulate across turns
  pi.on("session_start", async (_event, ctx) => {
    activeSkills = new Map();
    activeSkillHashes = new Map();
    userMessageCount = 0;
    sessionUserMessageCount = 0;
    sessionAssistantTurns = 0;
    sessionEditsPerFile = new Map();
    sessionFrictionCount = 0;
    turnsSinceLastTodo = 0;
    editsPerFile = new Map();
    toolFailures = 0;
    sessionToolFailures = 0;
    sessionCounted = false;
    attributedComments = 0;
    improvedSkills = new Set();
    frictionAtLastImprove = 0;
    lowScoreEvalTriggered = false;
    criticalScoreEvalTriggered = false;
    frictionLog = [];
    todoSummaries = [];
    footerInstalled = false;
    refreshFooterStatus(ctx);
  });

  /** Parse AGENTS_EVALS.md into sections keyed by header name (lowercase). */
  function parseEvalsSection(): Map<string, string> {
    const sections = new Map<string, string>();
    if (!existsSync(AGENTS_EVALS_FILE)) return sections;
    const content = readFileSync(AGENTS_EVALS_FILE, "utf8");
    const lines = content.split("\n");
    let currentSection = "";
    let currentLines: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^## (.+)$/);
      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          const body = currentLines.join("\n").trim();
          if (body) sections.set(currentSection, body);
        }
        currentSection = headerMatch[1].trim().toLowerCase();
        currentLines = [];
      } else if (currentSection) {
        currentLines.push(line);
      }
    }
    // Save last section
    if (currentSection) {
      const body = currentLines.join("\n").trim();
      if (body) sections.set(currentSection, body);
    }
    return sections;
  }

  /** Build AGENTS_EVALS system prompt snippet: Common directives only. */
  function buildEvalsPromptSnippet(): string {
    const sections = parseEvalsSection();

    const parts: string[] = [
      "",
      "# Skill Discovery",
      "",
      "You have access to skills listed in `<available_skills>`. Before starting any non-trivial task:",
      "1. Scan the skill descriptions in `<available_skills>` to identify skills relevant to the task.",
      "2. Load helpful skills by reading their SKILL.md (use the absolute path from `<location>`).",
      "3. Follow loaded skill instructions throughout the task.",
      "",
      "Prefer loading skills over relying on general knowledge — skills encode project-specific patterns, tool usage, and guardrails.",
    ];

    if (sections.size > 0) {
      const common = sections.get("common");
      if (common) {
        parts.push(
          "",
          "# Skill Evaluation Overrides",
          "",
          "The following directives amend loaded skill instructions. Apply them on top of the skill's own SKILL.md.",
          "",
          "## Common",
          common,
        );
      }
    }

    return parts.join("\n");
  }

  /** Build skill-specific evaluation snippet appended when a skill is loaded/read. */
  function buildSkillEvalSnippet(skillName: string): string {
    const sections = parseEvalsSection();
    const section = sections.get(skillName.toLowerCase());
    if (!section) return "";
    return [
      "",
      "## Skill-Specific Evaluation Overrides",
      "",
      `## ${skillName}`,
      section,
    ].join("\n");
  }

  // Parse <available_skills> from system prompt to build path→name map.
  // Inject AGENTS_EVALS into system prompt.
  pi.on("before_agent_start", async (event) => {
    knownSkillPaths = new Map();
    const prompt = event.systemPrompt || "";

    const skillBlock = prompt.match(/<available_skills>([\s\S]*?)<\/available_skills>/);
    if (skillBlock) {
      const skillRegex = /<skill>\s*<name>(.*?)<\/name>\s*<description>[\s\S]*?<\/description>\s*<location>(.*?)<\/location>\s*<\/skill>/g;
      let match;
      while ((match = skillRegex.exec(skillBlock[1])) !== null) {
        const name = match[1].trim();
        const location = match[2].trim();
        // Resolve ~ and relative paths
        const resolved = location.startsWith("~")
          ? join(homedir(), location.slice(2))
          : location;
        knownSkillPaths.set(resolved, name);
      }
    }

    // Inject AGENTS_EVALS snippet into system prompt
    const evalsSnippet = buildEvalsPromptSnippet();
    if (evalsSnippet) {
      return { systemPrompt: prompt + evalsSnippet };
    }
  });

  /** Recursively collect all files in a directory */
  function collectSkillFiles(skillDir: string): SkillFile[] {
    const files: SkillFile[] = [];
    function walk(dir: string, prefix: string): void {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const rel = prefix ? `${prefix}/${entry}` : entry;
        try {
          if (statSync(full).isDirectory()) {
            walk(full, rel);
          } else {
            files.push({ relativePath: rel, content: readFileSync(full, "utf8") });
          }
        } catch {}
      }
    }
    walk(skillDir, "");
    return files;
  }

  /** Find skill directory by name: global store first, then known paths from system prompt */
  function findSkillDir(name: string): string | null {
    // Global store
    const globalDir = join(SKILLS_DIR, name);
    if (existsSync(join(globalDir, "SKILL.md"))) return globalDir;

    // Search knownSkillPaths (location → name) for matching name
    for (const [location, knownName] of knownSkillPaths) {
      if (knownName === name) {
        // location is the SKILL.md path; parent is the skill dir
        const dir = dirname(location);
        if (existsSync(location)) return dir;
      }
    }

    return null;
  }

  // --- Skill load API: other extensions request skills through this ---
  pi.events.on(SKILL_EVENTS.LOAD, (payload: SkillLoadPayload) => {
    const { name } = payload;
    const taskId = wfTaskId(`load:${name}`);
    pi.events.emit(PLUGIN_WORKFLOW_EVENTS.START, {
      plugin: "skill-manager",
      taskId,
      task: "skill-load",
      details: name,
    } satisfies PluginWorkflowStartPayload);

    const skillDir = findSkillDir(name);

    if (!skillDir) {
      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
        plugin: "skill-manager",
        taskId,
        status: "error",
        details: `not-found:${name}`,
      } satisfies PluginWorkflowEndPayload);
      payload.resolve(null);
      return;
    }

    let skillMd = "";
    try { skillMd = readFileSync(join(skillDir, "SKILL.md"), "utf8"); } catch {}

    const skillEvalSnippet = buildSkillEvalSnippet(name);
    if (skillEvalSnippet) {
      skillMd = `${skillMd}\n${skillEvalSnippet}`;
    }

    const files = collectSkillFiles(skillDir);
    trackSkill(name, "event");

    pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
      plugin: "skill-manager",
      taskId,
      status: "ok",
      details: `${name} (${files.length} files)`,
    } satisfies PluginWorkflowEndPayload);

    payload.resolve({ skillMd, files, skillDir });
  });

  // --- Feedback API: other extensions report skill correctness ---
  pi.events.on(SKILL_EVENTS.FEEDBACK, (payload: SkillFeedbackPayload) => {
    wfEvent(`feedback:${payload.correct ? "ok" : "fail"}`, `${payload.skill}${payload.reason ? ` — ${payload.reason}` : ""}`);
    const stats = loadStats();
    ensureStat(stats, payload.skill);
    if (payload.correct) {
      stats[payload.skill].successes++;
    } else {
      stats[payload.skill].failures++;
      if (payload.reason) {
        frictionLog.push(`[feedback] ${payload.skill}: ${payload.reason}`);
      }
    }
    saveStats(stats);
  });

  // --- Reset session stats: other extensions can trigger a fresh start ---
  pi.events.on(SKILL_EVENTS.RESET_SESSION, (payload?: SkillResetSessionPayload) => {
    wfEvent("reset-session", payload?.keepActiveSkills ? "keep-skills" : "full");
    if (!payload?.keepActiveSkills) {
      activeSkills = new Map();
      activeSkillHashes = new Map();
    }
    userMessageCount = 0;
    sessionUserMessageCount = 0;
    sessionAssistantTurns = 0;
    sessionEditsPerFile = new Map();
    sessionFrictionCount = 0;
    turnsSinceLastTodo = 0;
    editsPerFile = new Map();
    toolFailures = 0;
    sessionToolFailures = 0;
    sessionCounted = false;
    attributedComments = 0;
    improvedSkills = new Set();
    frictionAtLastImprove = 0;
    lowScoreEvalTriggered = false;
    criticalScoreEvalTriggered = false;
    frictionLog = [];
    todoSummaries = [];
  });

  // --- GET_EVALS API: other extensions request eval directives for specific skills ---
  pi.events.on(SKILL_EVENTS.GET_EVALS, (payload: SkillGetEvalsPayload) => {
    const sections = parseEvalsSection();
    if (sections.size === 0) {
      payload.resolve("");
      return;
    }

    const parts: string[] = [];

    // Common section always included
    const common = sections.get("common");
    if (common) {
      parts.push("## Common\n" + common);
    }

    // Per-skill sections for requested skills
    for (const skillName of payload.skills) {
      const section = sections.get(skillName.toLowerCase());
      if (section) {
        parts.push(`## ${skillName}\n` + section);
      }
    }

    if (parts.length === 0) {
      payload.resolve("");
      return;
    }

    payload.resolve([
      "# Skill Evaluation Overrides",
      "",
      "Apply these directives on top of the skill's SKILL.md instructions.",
      "",
      ...parts,
    ].join("\n"));
  });

  function buildCommonEvalPrompt(estimate: SessionEstimate, trigger: string, critical = false): string {
    return `Session ${critical ? "critical" : "low-score"} evaluation triggered by ${trigger}. No skills were loaded.

## Session Signals
- estimate ${estimate.combined}/10 (${scoreLabel(estimate.combined)})
- quality ${estimate.quality}/10
- efficiency ${estimate.efficiency}/10
- stability ${estimate.stability}/10
- user messages ${sessionUserMessageCount}
- correction-like friction ${sessionFrictionCount}
- tool failures ${sessionToolFailures}
- assistant turns ${sessionAssistantTurns}

## Friction Log
${frictionLog.map((f) => `- ${f}`).join("\n") || "(none)"}

## TODO Summaries
${todoSummaries.map((s) => `- ${s}`).join("\n") || "(none)"}

Task: Use the skill_eval tool to record reusable Common directives.
Rules:
1) Set skill="Common" for every added entry.
2) Add 1-3 directives when signals are meaningful (friction, tool failures, low estimate, repeated corrections).
3) Use imperative form: "always X", "never Y", "when Z do W".
4) Do NOT record one-off incidents, specific command behavior, or UI edge cases.
5) If signals are genuinely clean/neutral, skip adding entries and reply: No common improvements needed.`;
  }

  function buildLoadedSkillsEvalPrompt(estimate: SessionEstimate, trigger: string, critical = false): string {
    const loadedSkills = [...activeSkills.keys()];
    const stats = loadStats();
    const loadedSummary = loadedSkills.map((name) => {
      const stat = stats[name];
      if (!stat) return `- ${name}: no stats`;
      return `- ${name}: uses=${stat.uses}, corrections=${stat.manualComments}, failures=${stat.toolFailures}`;
    }).join("\n");

    return `Session ${critical ? "critical" : "low-score"} evaluation triggered by ${trigger} with score ${estimate.combined}/10 (${scoreLabel(estimate.combined)}).

## Session Signals
- quality ${estimate.quality}/10
- efficiency ${estimate.efficiency}/10
- stability ${estimate.stability}/10
- user messages ${sessionUserMessageCount}
- friction count ${sessionFrictionCount}
- tool failures ${sessionToolFailures}
- assistant turns ${sessionAssistantTurns}

## Loaded Skills
${loadedSummary}

## Friction Log
${frictionLog.map((f) => `- ${f}`).join("\n") || "(none)"}

## TODO Summaries
${todoSummaries.map((s) => `- ${s}`).join("\n") || "(none)"}

Task: Use the skill_eval tool to record actionable directives for the loaded skills.
- Write directives that would have prevented the friction observed in this session.
- Use imperative form: "always X", "never Y", "when Z do W".
- Do NOT record one-off incidents or UI edge cases.
- If nothing actionable, skip.`;
  }

  function spawnEvaluation(trigger: "agent_end" | "session_shutdown", critical = false): void {
    const estimate = currentSessionEstimate();
    const prompt = activeSkills.size > 0
      ? buildLoadedSkillsEvalPrompt(estimate, trigger, critical)
      : buildCommonEvalPrompt(estimate, trigger, critical);

    // Fire-and-forget background evaluation
    pi.exec("pi", ["-p", prompt], { timeout: 120_000 }).catch(() => {});
  }

  // --- Session shutdown: record daily scores, emit event, auto-eval, rotate ---
  pi.on("session_shutdown", async () => {
    const estimate = currentSessionEstimate();
    const score = estimate.combined;

    // Record daily scores for all active skills
    if (activeSkills.size > 0) {
      const entries: SkillSessionScoreEntry[] = [];
      for (const name of activeSkills.keys()) {
        const hash = activeSkillHashes.get(name) || "";
        recordDailyScore(name, score, hash);
        entries.push({ skill: name, score, contentHash: hash });
      }

      // Emit event so other extensions can react
      pi.events.emit(SKILL_EVENTS.SESSION_SCORES, {
        date: today(),
        entries,
      } satisfies SkillSessionScoresPayload);
    }

    if (!criticalScoreEvalTriggered && estimate.combined < 3) {
      criticalScoreEvalTriggered = true;
      lowScoreEvalTriggered = true;
      spawnEvaluation("session_shutdown", true);
    } else if (!lowScoreEvalTriggered && estimate.combined <= LOW_SCORE_EVAL_THRESHOLD) {
      lowScoreEvalTriggered = true;
      spawnEvaluation("session_shutdown");
    }

    runAutoresearchLoop();
  });

  // Detect /skills:* command invocations + count user messages + capture corrections
  pi.on("input", async (event, ctx) => {
    const text = event.text?.trim() ?? "";
    sessionUserMessageCount++;

    const match = text.match(/^\/skills:([a-z0-9-]+)/);
    if (match) {
      trackSkill(match[1], "command", ctx);
    }

    // Track global friction proxy for session estimate (explicit correction signals only)
    if (sessionUserMessageCount > 1 && !text.startsWith("/")) {
      const lower = text.toLowerCase();
      const correctionSignal =
        lower.startsWith("fix") ||
        lower.includes("wrong") ||
        lower.includes("not what i asked") ||
        lower.includes("doesn't work") ||
        lower.includes("does not work") ||
        lower.includes("error") ||
        lower.includes("fail");
      if (correctionSignal) sessionFrictionCount++;
    }

    // Per-skill attribution remains scoped to periods where skills are active
    if (activeSkills.size > 0) {
      userMessageCount++;
      if (userMessageCount > 1 && !text.startsWith("/")) {
        frictionLog.push(text.slice(0, 300));
      }
    }

    refreshFooterStatus(ctx);
    return { action: "continue" as const };
  });

  // Detect when LLM reads a skill file via any tool — track usage only
  pi.on("tool_result", async (event, ctx) => {
    const input = event.input as Record<string, unknown> | undefined;
    const filePath = (input?.path ?? input?.query) as string | undefined;
    if (!filePath) return;

    const resolved = filePath.startsWith("~")
      ? join(homedir(), filePath.slice(2))
      : filePath.startsWith("/")
        ? filePath
        : resolve(filePath);

    const skillName = knownSkillPaths.get(resolved) ?? skillNameFromPath(resolved);
    if (skillName) trackSkill(skillName, "read", ctx);
    if (activeSkills.size > 0) refreshFooterStatus(ctx);
  });

  // Track tool failures
  pi.on("tool_execution_end", async (event, ctx) => {
    if (event.isError) {
      sessionToolFailures++;
      if (activeSkills.size > 0) {
        toolFailures++;
      }
    }
    refreshFooterStatus(ctx);
  });

  // Track edit attempts per file (detects thrashing)
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "edit") return;
    const filePath = (event.input as any)?.path as string | undefined;
    if (!filePath) return;

    sessionEditsPerFile.set(filePath, (sessionEditsPerFile.get(filePath) ?? 0) + 1);
    if (activeSkills.size > 0) {
      editsPerFile.set(filePath, (editsPerFile.get(filePath) ?? 0) + 1);
    }

    refreshFooterStatus(ctx);
  });

  // Count agent turns for efficiency metric
  pi.on("turn_end", async (event, ctx) => {
    if (event.message?.role === "assistant") {
      sessionAssistantTurns++;

      if (activeSkills.size > 0) {
        turnsSinceLastTodo++;

        // Increment session count once per session when skills are first active
        if (!sessionCounted) {
          sessionCounted = true;
          for (const name of activeSkills.keys()) {
            incrementSessions(name);
          }
        }
      }
    }
    refreshFooterStatus(ctx);
  });

  // --- LRU cache: track recent skill improvements across sessions ---
  const IMPROVE_CACHE_FILE = join(PI_AGENT_DIR, "skills-improve-cache.json");
  const IMPROVE_CACHE_MAX = 50;
  const IMPROVE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

  interface ImproveCacheEntry {
    skill: string;
    timestamp: number;
    frictionCount: number;
  }

  function loadImproveCache(): ImproveCacheEntry[] {
    if (!existsSync(IMPROVE_CACHE_FILE)) return [];
    try { return JSON.parse(readFileSync(IMPROVE_CACHE_FILE, "utf8")); } catch { return []; }
  }

  function saveImproveCache(cache: ImproveCacheEntry[]): void {
    // Keep only last N entries
    const trimmed = cache.slice(-IMPROVE_CACHE_MAX);
    writeFileSync(IMPROVE_CACHE_FILE, JSON.stringify(trimmed, null, 2) + "\n", "utf8");
  }

  function isRecentlyImproved(skillName: string): boolean {
    const cache = loadImproveCache();
    const now = Date.now();
    return cache.some(
      (e) => e.skill === skillName && (now - e.timestamp) < IMPROVE_COOLDOWN_MS
    );
  }

  function markImproved(skills: string[], frictionCount: number): void {
    const cache = loadImproveCache();
    const now = Date.now();
    for (const skill of skills) {
      cache.push({ skill, timestamp: now, frictionCount });
      improvedSkills.add(skill);
    }
    saveImproveCache(cache);
    frictionAtLastImprove = frictionLog.length;
  }

  /** Run skill improvement as a separate pi subagent (non-blocking) */
  function runImproveAgent(prompt: string, candidates: string[]): void {
    markImproved(candidates, frictionLog.length);
    const taskId = wfTaskId("auto-improve");
    pi.events.emit(PLUGIN_WORKFLOW_EVENTS.START, {
      plugin: "skill-manager",
      taskId,
      task: "auto-improve",
      details: candidates.join(", "),
    } satisfies PluginWorkflowStartPayload);

    pi.exec("pi", ["-p", prompt], { timeout: 120_000 })
      .then((result) => {
        pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
          plugin: "skill-manager",
          taskId,
          status: result.code === 0 ? "ok" : "error",
          details: `exit=${result.code}`,
        } satisfies PluginWorkflowEndPayload);
      })
      .catch((err: any) => {
        pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
          plugin: "skill-manager",
          taskId,
          status: "error",
          details: err?.message || "unknown-error",
        } satisfies PluginWorkflowEndPayload);
      });
  }

  function skillMedianAndSessions(skillName: string): { medianScore: number; sessions: number } {
    const allDaily = loadAllDailyScores();
    const entries = allDaily.get(skillName) || [];
    const allScores = entries.flatMap((e) => e.scores);
    return {
      medianScore: allScores.length > 0 ? median(allScores) : 0,
      sessions: allScores.length,
    };
  }

  function buildAutoresearchPrompt(skillName: string, rules: AutoresearchRules, baselineMedian: number, baselineSessions: number): string {
    const skillPath = join(SKILLS_DIR, skillName, "SKILL.md");
    return `Run a single autoresearch experiment for skill: ${skillName}

Skill file: ${skillPath}
Baseline median session score: ${baselineMedian.toFixed(1)} (n=${baselineSessions})

Autoresearch rules (authoritative constraints):
- Eval checklist:
${rules.evalChecklist.map((q, i) => `  ${i + 1}. ${q}`).join("\n")}
- Test inputs:
${rules.testInputs.map((t) => `  - ${t}`).join("\n")}
- Can change: ${rules.canChange || "not specified"}
- Cannot change: ${rules.cannotChange || "not specified"}
- Runs per experiment: ${rules.runsPerExperiment}

Method (strict):
1) Read the full SKILL.md.
2) Establish baseline against the eval checklist using the test inputs.
3) Make exactly ONE targeted mutation to SKILL.md aimed at the weakest failing checklist item.
4) Re-evaluate with the same checklist + test inputs.
5) Decision:
   - If improved: keep the mutation and commit in ${SKILLS_DIR} with message: auto-research ${skillName}: <short reason>
   - If equal or worse: revert SKILL.md to previous content and do not keep mutation.
6) Append a concise experiment note to ~/.pi/agent/skills-autoresearch.log with: skill, baseline, new score, keep/discard, rationale.

Rules:
- Binary criteria only (yes/no per checklist item).
- Do not perform broad rewrites. One mutation only.
- Respect "Cannot change" constraints exactly.
- If no safe useful mutation exists, reply exactly: No autoresearch mutation needed.`;
  }

  function runAutoresearchAgent(skillName: string, rules: AutoresearchRules): void {
    if (!acquireAutoresearchLock(skillName)) {
      wfEvent("auto-research:skip", `lock active for ${today()}`);
      return;
    }

    const { medianScore, sessions } = skillMedianAndSessions(skillName);
    const prompt = buildAutoresearchPrompt(skillName, rules, medianScore, sessions);

    markImproved([skillName], frictionLog.length);

    const state = loadAutoresearchState();
    state.active[skillName] = {
      skill: skillName,
      startedAt: new Date().toISOString(),
      status: "running",
      reason: "session_shutdown autoresearch",
      baselineMedian: medianScore,
      baselineSessions: sessions,
      runsPerExperiment: rules.runsPerExperiment,
      minSessionsBeforeEval: rules.minSessionsBeforeEval,
    };
    saveAutoresearchState(state);

    const taskId = wfTaskId("auto-research");
    pi.events.emit(PLUGIN_WORKFLOW_EVENTS.START, {
      plugin: "skill-manager",
      taskId,
      task: "auto-research",
      details: `${skillName} (median ${medianScore.toFixed(1)}, n=${sessions})`,
    } satisfies PluginWorkflowStartPayload);

    pi.exec("pi", ["-p", prompt], { timeout: 180_000 })
      .then((result) => {
        const next = loadAutoresearchState();
        const active = next.active[skillName];
        if (active) {
          active.completedAt = new Date().toISOString();
          active.status = result.code === 0 ? "completed" : "failed";
          next.history.push(active);
          delete next.active[skillName];
          saveAutoresearchState(next);
        }

        releaseAutoresearchLock();

        pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
          plugin: "skill-manager",
          taskId,
          status: result.code === 0 ? "ok" : "error",
          details: `exit=${result.code}`,
        } satisfies PluginWorkflowEndPayload);
      })
      .catch((err: any) => {
        const next = loadAutoresearchState();
        const active = next.active[skillName];
        if (active) {
          active.completedAt = new Date().toISOString();
          active.status = "failed";
          active.reason = `error: ${err?.message || "unknown-error"}`;
          next.history.push(active);
          delete next.active[skillName];
          saveAutoresearchState(next);
        }

        releaseAutoresearchLock();

        pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
          plugin: "skill-manager",
          taskId,
          status: "error",
          details: err?.message || "unknown-error",
        } satisfies PluginWorkflowEndPayload);
      });
  }

  function runAutoresearchLoop(): void {
    const settings = loadSettings();
    if (!settings.autoResearch.enabled) return;
    if (activeSkills.size === 0) return;
    if (hasAutoresearchLockForToday()) {
      const lock = readAutoresearchLock();
      wfEvent("auto-research:skip", `lock active for ${lock?.skill || "unknown-skill"}`);
      return;
    }

    const state = loadAutoresearchState();
    let launched = 0;

    for (const skillName of activeSkills.keys()) {
      if (launched >= settings.autoResearch.maxSkillsPerShutdown) break;
      if (state.active[skillName]) continue;
      if (isRecentlyImproved(skillName)) continue;

      const skillDir = findSkillDir(skillName);
      if (!skillDir) continue;

      let skillMd = "";
      try {
        skillMd = readFileSync(join(skillDir, "SKILL.md"), "utf8");
      } catch {
        continue;
      }

      const rules = parseAutoresearchRules(skillMd);
      if (!rules) continue;

      const { medianScore, sessions } = skillMedianAndSessions(skillName);
      if (sessions < rules.minSessionsBeforeEval) continue;
      if (medianScore > settings.autoResearch.maxMedianScore) continue;

      runAutoresearchAgent(skillName, rules);
      launched++;
    }
  }

  // --- Work event listeners: trigger skill improvement with context ---

  // TODO completed: accumulate context, check if immediate review needed
  pi.events.on(WORK_EVENTS.TODO_COMPLETED, (payload: TodoCompletedPayload) => {
    todoSummaries.push(payload.summary);

    // Record per-TODO efficiency metrics
    if (activeSkills.size > 0) {
      const maxEdits = editsPerFile.size > 0
        ? Math.max(...editsPerFile.values())
        : 0;
      const stats = loadStats();
      for (const name of activeSkills.keys()) {
        ensureStat(stats, name);
        stats[name].agentTurns += turnsSinceLastTodo;
        stats[name].completedTodos++;
        stats[name].toolFailures += toolFailures;
      }
      saveStats(stats);

      // Log thrashing if any file was edited 4+ times in one TODO
      if (maxEdits >= 4) {
        const thrashFiles = [...editsPerFile.entries()]
          .filter(([, count]) => count >= 4)
          .map(([f, count]) => `${f} (${count}x)`);
        frictionLog.push(`[thrashing] ${turnsSinceLastTodo} turns, repeated edits: ${thrashFiles.join(", ")}`);
      }

      // Log high failure rate (3+ failures in one TODO)
      if (toolFailures >= 3) {
        frictionLog.push(`[failures] ${toolFailures} tool failures in ${turnsSinceLastTodo} turns for TODO: ${payload.summary.slice(0, 100)}`);
      }
    }

    // Reset per-TODO counters
    turnsSinceLastTodo = 0;
    editsPerFile = new Map();
    toolFailures = 0;
  });

  // Return to plan: fire skill improvement with full context
  pi.events.on(WORK_EVENTS.RETURN_TO_PLAN, (payload: ReturnToPlanPayload) => {
    wfEvent("work:return-to-plan", payload.reason);
    if (activeSkills.size === 0) return;
    // Skip if no new friction since last improve
    if (frictionLog.length <= frictionAtLastImprove) return;

    const settings = loadSettings();
    if (!settings.autoImprove.enabled) return;

    const stats = loadStats();
    const candidates: string[] = [];

    for (const name of activeSkills.keys()) {
      if (improvedSkills.has(name)) continue;
      if (isRecentlyImproved(name)) continue;
      const stat = stats[name];
      const crossedThreshold = stat &&
        stat.uses >= settings.autoImprove.minUses &&
        (stat.manualComments / stat.uses) >= settings.autoImprove.correctionThreshold;
      if (crossedThreshold) {
        candidates.push(name);
      }
    }

    if (candidates.length === 0) {
      wfEvent("auto-improve:skip", "no candidates on return-to-plan");
      return;
    }

    wfEvent("auto-improve:candidates", candidates.join(", "));

    // Build context for the improvement review
    const contextParts: string[] = [];

    contextParts.push("## Session Context\n");
    contextParts.push(`**Reason for returning to plan:** ${payload.reason}\n`);

    if (todoSummaries.length > 0) {
      contextParts.push("### TODOs completed this session:");
      contextParts.push(todoSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n"));
      contextParts.push("");
    }

    if (frictionLog.length > 0) {
      contextParts.push("### User corrections/interventions during implementation:");
      contextParts.push(frictionLog.map((f) => `- "${f}"`).join("\n"));
      contextParts.push("");
    }

    if (payload.recentWorklog) {
      contextParts.push("### Recent worklog:");
      contextParts.push("```");
      contextParts.push(payload.recentWorklog);
      contextParts.push("```");
      contextParts.push("");
    }

    const skillList = candidates.map((name) => {
      const stat = stats[name];
      const skillPath = join(SKILLS_DIR, name, "SKILL.md");
      let content = "";
      try { content = readFileSync(skillPath, "utf8"); } catch {}
      return `### ${name}\n**Stats:** ${stat ? `${stat.uses} uses, ratio ${(stat.manualComments / stat.uses).toFixed(2)}` : "no stats"}\n**Path:** ${skillPath}\n\n\`\`\`markdown\n${content}\n\`\`\``;
    }).join("\n\n");

    const prompt = `You are reviewing skills that were active during an implementation session that just ended.

${contextParts.join("\n")}

## Skills to Review

${skillList}

## Instructions

For each skill above, analyze whether the session context reveals improvements needed:

1. **Did the skill's instructions cause any of the friction/corrections seen above?**
   - If yes: identify the specific instruction gap or ambiguity
   - If no: skip this skill

2. **Were there patterns or techniques used this session that the skill should document?**
   - New tool usage, workarounds, edge cases handled

3. For each skill that needs changes:
   - Show the specific edit (old text → new text)
   - Explain why this would have prevented the friction
   - Apply the edit and commit:
     \`\`\`bash
     cd ${SKILLS_DIR} && git add -A && git commit -m "auto-improve <skill>: <what changed>"
     \`\`\`

If no skills need changes based on this session's context, say "No skill improvements needed" and stop.`;

    runImproveAgent(prompt, candidates);
  });

  // At agent end, attribute NEW manual comments to active skills (incremental)
  pi.on("agent_end", async () => {
    const totalComments = Math.max(0, userMessageCount - 1);
    const newComments = totalComments - attributedComments;
    if (newComments > 0 && activeSkills.size > 0) {
      for (const name of activeSkills.keys()) {
        incrementComments(name, newComments);
      }
      attributedComments = totalComments;
    }

    const estimate = currentSessionEstimate();
    if (!criticalScoreEvalTriggered && estimate.combined < 3) {
      criticalScoreEvalTriggered = true;
      lowScoreEvalTriggered = true;
      spawnEvaluation("agent_end", true);
    } else if (!lowScoreEvalTriggered && estimate.combined <= LOW_SCORE_EVAL_THRESHOLD) {
      lowScoreEvalTriggered = true;
      spawnEvaluation("agent_end");
    }

    // Auto-improve: suggest improvement for skills that crossed threshold
    const settings = loadSettings();
    if (!settings.autoImprove.enabled || activeSkills.size === 0 || newComments === 0) return;

    const stats = loadStats();
    const { correctionThreshold, minUses } = settings.autoImprove;
    const candidates: string[] = [];

    for (const name of activeSkills.keys()) {
      if (improvedSkills.has(name)) continue;
      if (isRecentlyImproved(name)) continue;
      const stat = stats[name];
      if (!stat || stat.uses < minUses) continue;
      const ratio = stat.manualComments / stat.uses;
      if (ratio >= correctionThreshold) {
        candidates.push(name);
      }
    }

    if (candidates.length === 0) return;

    const skillList = candidates.map((name) => {
      const stat = stats[name];
      const ratio = (stat.manualComments / stat.uses).toFixed(2);
      return `- **${name}** (${stat.uses} uses, ratio ${ratio})`;
    }).join("\n");

    runImproveAgent(
      `The following skill(s) have a high correction ratio (threshold: ${correctionThreshold}, min uses: ${minUses}):

${skillList}

Friction log from this session:
${frictionLog.map((f) => `- "${f}"`).join("\n") || "(none)"}

For each skill above:
1. Read the SKILL.md at ${SKILLS_DIR}/<name>/SKILL.md
2. Based on the friction log, identify what instructions caused confusion or were missing
3. Apply specific edits to improve the skill
4. Commit: cd ${SKILLS_DIR} && git add -A && git commit -m "auto-improve <skill>: <what changed>"

If no improvements needed, skip.`,
      candidates
    );
  });

  // --- Tool: skill_eval — the ONLY way to modify AGENTS_EVALS.md ---
  pi.registerTool({
    name: "skill_eval",
    label: "Skill Eval",
    description: "Add, update, remove, or list evaluation directives in AGENTS_EVALS.md. This is the only way to modify skill evaluation overrides.",
    parameters: Type.Object({
      action: StringEnum(["add", "update", "remove", "list"] as const, {
        description: "Action to perform",
      }),
      skill: Type.Optional(Type.String({
        description: "Skill name (required for add; optional filter for list)",
      })),
      note: Type.Optional(Type.String({
        description: "Actionable directive text (required for add/update). Use imperative: 'always X', 'never Y', 'when Z do W'",
      })),
      id: Type.Optional(Type.Number({
        description: "Entry ID (required for update/remove)",
      })),
      score: Type.Optional(Type.Number({
        description: "Score 1-10 (required for add, optional for update)",
      })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      ensureAgentsEvalsFile();

      if (params.action === "list") {
        const lines = readAgentsEvalsLines();
        const entries = parseSkillEvalEntries(lines)
          .filter((e) => !params.skill || e.skill === params.skill)
          .sort((a, b) => b.id - a.id);

        if (entries.length === 0) {
          return {
            content: [{ type: "text", text: params.skill ? `No evaluations for "${params.skill}".` : "No evaluations recorded." }],
            details: {},
          };
        }

        const out = entries.map((e) => `#${e.id} ${e.date} skill=${e.skill} score=${e.score}/10 note=${e.note}`);
        return {
          content: [{ type: "text", text: out.join("\n") }],
          details: {},
        };
      }

      if (params.action === "add") {
        if (!params.skill) return { content: [{ type: "text", text: "Error: skill is required for add" }], details: {} };
        if (!params.note) return { content: [{ type: "text", text: "Error: note is required for add" }], details: {} };
        if (!params.score || params.score < 1 || params.score > 10) return { content: [{ type: "text", text: "Error: score 1-10 is required for add" }], details: {} };

        let lines = readAgentsEvalsLines();
        const entries = parseSkillEvalEntries(lines);
        const id = nextSkillEvalId(entries);
        const entry = formatSkillEvalEntry({ id, date: today(), skill: params.skill, score: params.score, note: sanitizeEvalNote(params.note) });

        // Find or create ## <skill> section
        const sectionHeader = `## ${params.skill}`;
        let sectionIdx = lines.findIndex((l) => l.trim() === sectionHeader);
        if (sectionIdx === -1) {
          if (lines.length > 0 && lines[lines.length - 1].trim() !== "") lines.push("");
          lines.push(sectionHeader, "");
          sectionIdx = lines.length - 2;
        }
        let insertIdx = sectionIdx + 1;
        while (insertIdx < lines.length && lines[insertIdx].trim() === "") insertIdx++;
        lines.splice(insertIdx, 0, entry);
        writeAgentsEvalsLines(lines);

        return {
          content: [{ type: "text", text: `Added evaluation #${id} for ${params.skill} (${params.score}/10).` }],
          details: {},
        };
      }

      if (params.action === "update") {
        if (params.id == null) return { content: [{ type: "text", text: "Error: id is required for update" }], details: {} };
        if (!params.note && !params.score) return { content: [{ type: "text", text: "Error: note or score is required for update" }], details: {} };

        const lines = readAgentsEvalsLines();
        const entries = parseSkillEvalEntries(lines);
        const existing = entries.find((e) => e.id === params.id);
        if (!existing) return { content: [{ type: "text", text: `Evaluation #${params.id} not found.` }], details: {} };

        lines[existing.lineIndex] = formatSkillEvalEntry({
          id: existing.id,
          date: existing.date,
          skill: existing.skill,
          score: params.score ?? existing.score,
          note: params.note ? sanitizeEvalNote(params.note) : existing.note,
        });
        writeAgentsEvalsLines(lines);

        return {
          content: [{ type: "text", text: `Updated evaluation #${params.id}.` }],
          details: {},
        };
      }

      if (params.action === "remove") {
        if (params.id == null) return { content: [{ type: "text", text: "Error: id is required for remove" }], details: {} };

        const lines = readAgentsEvalsLines();
        const entries = parseSkillEvalEntries(lines);
        const existing = entries.find((e) => e.id === params.id);
        if (!existing) return { content: [{ type: "text", text: `Evaluation #${params.id} not found.` }], details: {} };

        lines.splice(existing.lineIndex, 1);
        writeAgentsEvalsLines(lines);

        return {
          content: [{ type: "text", text: `Removed evaluation #${existing.id} (${existing.skill}).` }],
          details: {},
        };
      }

      return { content: [{ type: "text", text: `Unknown action: ${params.action}` }], details: {} };
    },
  });

  // --- Guard: block direct writes to AGENTS_EVALS.md ---
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;
    const target: string = event.input?.path || event.input?.file || "";
    if (!target) return;
    const resolved = target.startsWith("/") ? target : join(process.cwd(), target);
    if (resolve(resolved) === resolve(AGENTS_EVALS_FILE)) {
      return {
        block: true,
        reason: "AGENTS_EVALS.md can only be modified via the skill_eval tool. Use skill_eval with action: add/update/remove.",
      };
    }
  });

  // /skills:settings - view/toggle auto-improve settings
  pi.registerCommand("skills:settings", {
    description: "View or toggle skill-manager settings",
    handler: async (args, ctx) => {
      const settings = loadSettings();

      if (args?.trim() === "auto-improve on") {
        settings.autoImprove.enabled = true;
        writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf8");
        ctx.ui.notify("Auto-improve enabled.", "info");
        return;
      }
      if (args?.trim() === "auto-improve off") {
        settings.autoImprove.enabled = false;
        writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf8");
        ctx.ui.notify("Auto-improve disabled.", "info");
        return;
      }
      if (args?.trim() === "auto-research on") {
        settings.autoResearch.enabled = true;
        writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf8");
        ctx.ui.notify("Auto-research enabled.", "info");
        return;
      }
      if (args?.trim() === "auto-research off") {
        settings.autoResearch.enabled = false;
        writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf8");
        ctx.ui.notify("Auto-research disabled.", "info");
        return;
      }
      if (args?.trim().startsWith("max-per-shutdown ")) {
        const val = parseInt(args.trim().split(" ")[1], 10);
        if (!isNaN(val) && val >= 1 && val <= 10) {
          settings.autoResearch.maxSkillsPerShutdown = val;
          writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf8");
          ctx.ui.notify(`Auto-research max-per-shutdown set to ${val}.`, "info");
          return;
        }
        ctx.ui.notify("max-per-shutdown must be an integer between 1 and 10.", "error");
        return;
      }
      if (args?.trim().startsWith("max-median ")) {
        const val = parseFloat(args.trim().split(" ")[1]);
        if (!isNaN(val) && val >= 1 && val <= 10) {
          settings.autoResearch.maxMedianScore = val;
          writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf8");
          ctx.ui.notify(`Auto-research max-median set to ${val}.`, "info");
          return;
        }
        ctx.ui.notify("max-median must be a number between 1 and 10.", "error");
        return;
      }
      if (args?.trim().startsWith("threshold ")) {
        const val = parseFloat(args.trim().split(" ")[1]);
        if (!isNaN(val) && val > 0 && val <= 2) {
          settings.autoImprove.correctionThreshold = val;
          writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf8");
          ctx.ui.notify(`Correction threshold set to ${val}.`, "info");
          return;
        }
        ctx.ui.notify("Threshold must be a number between 0 and 2.", "error");
        return;
      }
      if (args?.trim().startsWith("min-uses ")) {
        const val = parseInt(args.trim().split(" ")[1], 10);
        if (!isNaN(val) && val >= 1) {
          settings.autoImprove.minUses = val;
          writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf8");
          ctx.ui.notify(`Min uses set to ${val}.`, "info");
          return;
        }
        ctx.ui.notify("Min uses must be a positive integer.", "error");
        return;
      }

      const lines = [
        "Skill Manager Settings",
        "",
        `  auto-improve:   ${settings.autoImprove.enabled ? "ON" : "OFF"}`,
        `  threshold:      ${settings.autoImprove.correctionThreshold} (correction ratio to trigger)`,
        `  min-uses:       ${settings.autoImprove.minUses} (minimum uses before triggering)`,
        `  auto-research:  ${settings.autoResearch.enabled ? "ON" : "OFF"}`,
        `  max-per-shutdown: ${settings.autoResearch.maxSkillsPerShutdown}`,
        `  max-median:     ${settings.autoResearch.maxMedianScore} (run only if median <= value)`,
        "",
        "Commands:",
        "  /skills:settings auto-improve on|off",
        "  /skills:settings threshold <0-2>",
        "  /skills:settings min-uses <n>",
        "  /skills:settings auto-research on|off",
        "  /skills:settings max-per-shutdown <1-10>",
        "  /skills:settings max-median <1-10>",
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  function lastAutoresearchDate(skill: string): string {
    const state = loadAutoresearchState();
    const dates: string[] = [];

    const active = state.active[skill];
    if (active?.startedAt) dates.push(active.startedAt);
    if (active?.completedAt) dates.push(active.completedAt);

    for (const entry of state.history) {
      if (entry.skill !== skill) continue;
      if (entry.startedAt) dates.push(entry.startedAt);
      if (entry.completedAt) dates.push(entry.completedAt);
    }

    if (dates.length === 0) return "—";
    const latest = dates.sort().slice(-1)[0];
    return latest.slice(0, 10);
  }

  // /skills:stats - show usage table. Pass skill name for extended view.
  pi.registerCommand("skills:stats", {
    description: "Show skill stats. Usage: /skills:stats [skill-name]",
    handler: async (args, ctx) => {
      const stats = loadStats();
      const skillName = args?.trim();

      // Extended view for a single skill
      if (skillName) {
        const stat = stats[skillName];
        if (!stat) {
          ctx.ui.notify(`No stats for "${skillName}".`, "info");
          return;
        }
        ensureStat(stats, skillName);
        const turnsPerTodo = stat.completedTodos > 0
          ? (stat.agentTurns / stat.completedTodos).toFixed(1)
          : "—";
        const failsPerTodo = stat.completedTodos > 0
          ? (stat.toolFailures / stat.completedTodos).toFixed(1)
          : "—";
        const corrPerSession = stat.sessions > 0
          ? (stat.manualComments / stat.sessions).toFixed(1)
          : "—";

        // Health assessment
        const issues: string[] = [];
        if (stat.completedTodos > 0 && stat.agentTurns / stat.completedTodos > 15)
          issues.push("⚠ High turns/TODO (>15) — agent may be struggling");
        if (stat.completedTodos > 0 && stat.toolFailures / stat.completedTodos > 2)
          issues.push("⚠ High failures/TODO (>2) — skill may reference wrong tools/paths");
        if (stat.sessions > 0 && stat.manualComments / stat.sessions > 3)
          issues.push("⚠ High corrections/session (>3) — instructions may be unclear");
        if (stat.uses > 0 && stat.sessions === 0)
          issues.push("⚠ Loaded but no session tracked — tracking may be broken");
        if (stat.failures >= 3 && stat.failures > stat.successes)
          issues.push("⚠ More negative than positive feedback — skill needs review");

        const lines = [
          `## ${skillName}`,
          "",
          `  Last used:         ${stat.lastUsed}`,
          `  Last autoresearch: ${lastAutoresearchDate(skillName)}`,
          `  Loads:             ${stat.uses}`,
          `  Sessions:          ${stat.sessions}`,
          "",
          "  Efficiency:",
          `    Completed TODOs: ${stat.completedTodos}`,
          `    Agent turns:     ${stat.agentTurns}`,
          `    Turns/TODO:      ${turnsPerTodo}`,
          "",
          "  Quality:",
          `    Tool failures:   ${stat.toolFailures} (${failsPerTodo}/TODO)`,
          `    Corrections:     ${stat.manualComments} (${corrPerSession}/session)`,
          `    Feedback:        ✓${stat.successes} ✗${stat.failures}${stat.successes + stat.failures > 0 ? ` (${((stat.successes / (stat.successes + stat.failures)) * 100).toFixed(0)}% success)` : ""}`,
          "",
        ];

        // Current session info
        if (activeSkills.has(skillName)) {
          const estimate = currentSessionEstimate();
          lines.push("  Current session:");
          lines.push(`    Source:           ${activeSkills.get(skillName)}`);
          lines.push(`    Session estimate: ${estimate.combined}/10 (${scoreLabel(estimate.combined)})`);
          lines.push(`    Breakdown:        quality ${estimate.quality}/10, efficiency ${estimate.efficiency}/10, stability ${estimate.stability}/10`);
          lines.push(`    Turns so far:     ${turnsSinceLastTodo}`);
          lines.push(`    Tool failures:    ${toolFailures}`);
          lines.push(`    Edits/file:       ${[...editsPerFile.entries()].map(([f, c]) => `${basename(f)}(${c})`).join(", ") || "—"}`);
          lines.push(`    Friction entries: ${frictionLog.length}`);
          lines.push("");
        }

        // Improve cache
        const cache = loadImproveCache();
        const recent = cache.filter((e) => e.skill === skillName);
        if (recent.length > 0) {
          lines.push("  Improve history:");
          for (const entry of recent.slice(-3)) {
            const date = new Date(entry.timestamp).toISOString().slice(0, 16).replace("T", " ");
            lines.push(`    ${date} (friction: ${entry.frictionCount})`);
          }
          lines.push("");
        }

        // Daily session scores
        const allDaily = loadAllDailyScores();
        const dailyEntries = allDaily.get(skillName);
        if (dailyEntries && dailyEntries.length > 0) {
          lines.push("  Daily scores (last 10d):");
          for (const day of dailyEntries) {
            const med = median(day.scores);
            lines.push(`    ${day.date}  median=${med.toFixed(1)}  n=${day.scores.length}  hash=${day.contentHash || "—"}`);
          }
          const allScores = dailyEntries.flatMap((d) => d.scores);
          lines.push(`    overall median: ${median(allScores).toFixed(1)} (${allScores.length} sessions)`);
          lines.push("");
        }

        if (issues.length > 0) {
          lines.push("  Health:");
          for (const issue of issues) lines.push(`    ${issue}`);
        } else {
          lines.push("  Health: ✓ OK");
        }

        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      // Summary view for all skills
      const entries = Object.entries(stats).sort((a, b) => b[1].uses - a[1].uses);

      if (entries.length === 0) {
        ctx.ui.notify("No skill stats recorded yet.", "info");
        return;
      }

      const lines: string[] = [];
      const estimate = currentSessionEstimate();
      lines.push(`Session estimate (all activity): ${estimate.combined}/10 (${scoreLabel(estimate.combined)})`);
      lines.push(`  quality ${estimate.quality}/10 · efficiency ${estimate.efficiency}/10 · stability ${estimate.stability}/10`);
      lines.push(`  loaded skills: ${activeSkills.size}`);
      lines.push("");
      const allDaily = loadAllDailyScores();
      lines.push("Skill                    Loads  Sess  TODOs  T/TODO  Fails  Corr  Med10d  Last Used   AR Last");
      lines.push("─".repeat(105));

      for (const [name, stat] of entries) {
        ensureStat(stats, name);
        const turnsPerTodo = stat.completedTodos > 0
          ? (stat.agentTurns / stat.completedTodos).toFixed(1)
          : "—";
        const dailyEntries = allDaily.get(name);
        const medStr = dailyEntries && dailyEntries.length > 0
          ? median(dailyEntries.flatMap((d) => d.scores)).toFixed(1)
          : "—";
        const nameCol = name.padEnd(24);
        const loadsCol = String(stat.uses).padStart(5);
        const sessCol = String(stat.sessions).padStart(4);
        const todosCol = String(stat.completedTodos).padStart(5);
        const tptCol = turnsPerTodo.padStart(6);
        const failCol = String(stat.toolFailures).padStart(5);
        const corrCol = String(stat.manualComments).padStart(5);
        const medCol = medStr.padStart(6);
        const arCol = lastAutoresearchDate(name);
        lines.push(`${nameCol} ${loadsCol}  ${sessCol}  ${todosCol}  ${tptCol}  ${failCol}  ${corrCol}  ${medCol}   ${stat.lastUsed}   ${arCol}`);
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // /skills:experiments - show autoresearch background state
  pi.registerCommand("skills:experiments", {
    description: "Show active and recent autoresearch experiments",
    handler: async (_args, ctx) => {
      const state = loadAutoresearchState();
      const activeEntries = Object.values(state.active);
      const history = [...state.history].slice(-10).reverse();

      const lines: string[] = [];
      lines.push("Autoresearch Experiments");
      lines.push("");

      if (activeEntries.length === 0) {
        lines.push("Active: none");
      } else {
        lines.push(`Active (${activeEntries.length}):`);
        for (const e of activeEntries) {
          lines.push(`  - ${e.skill}: baseline ${e.baselineMedian.toFixed(1)} (n=${e.baselineSessions}), started ${e.startedAt}`);
        }
      }

      lines.push("");
      lines.push("Recent history:");
      if (history.length === 0) {
        lines.push("  (none)");
      } else {
        for (const e of history) {
          lines.push(`  - ${e.skill}: ${e.status} · baseline ${e.baselineMedian.toFixed(1)} (n=${e.baselineSessions}) · ${e.startedAt}`);
        }
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // /skills:improve - LLM reviews and improves a skill
  pi.registerCommand("skills:improve", {
    description: "LLM improves one skill by name, or selects from current session when no name is passed",
    handler: async (args, ctx) => {
      const skillName = args?.trim();
      if (!skillName) {
        if (activeSkills.size === 0) {
          ensureAgentsEvalsFile();
          const estimate = currentSessionEstimate();
          const generalPrompt = `No skills are loaded in this session. Analyze the full session and record reusable Common improvements.

Session signals:
- estimate ${estimate.combined}/10 (${scoreLabel(estimate.combined)})
- quality ${estimate.quality}/10
- efficiency ${estimate.efficiency}/10
- stability ${estimate.stability}/10
- user messages ${sessionUserMessageCount}
- correction-like friction ${sessionFrictionCount}
- tool failures ${sessionToolFailures}
- assistant turns ${sessionAssistantTurns}

Rules:
1) Use the skill_eval tool to add evaluation entries. Do NOT write to ${AGENTS_EVALS_FILE} directly.
2) With no loaded skills, target skill="Common" (shared directives for all sessions).
3) Add 1-3 directives when there are meaningful signals (friction, tool failures, low estimate, repeated corrections).
4) Write actionable directives ("always X", "never Y", "when Z do W"), not observations.
5) Do NOT record one-off incidents, specific command behavior, or UI edge cases.
6) If signals are genuinely clean/neutral, add nothing and reply exactly: No common improvements needed.
7) Never reply with "No skills were loaded" as the conclusion.
`;
          pi.sendUserMessage(generalPrompt, { deliverAs: "followUp" });
          ctx.ui.notify(`No loaded skills. Wrote general-improvement task targeting ${AGENTS_EVALS_FILE}.`, "info");
          return;
        }

        ensureAgentsEvalsFile();
        const stats = loadStats();
        const estimate = currentSessionEstimate();
        const loadedSkills = [...activeSkills.keys()];
        const loadedSummary = loadedSkills.map((name) => {
          const stat = stats[name];
          if (!stat) return `- ${name}: no historical stats`;
          const ratio = (stat.manualComments / Math.max(stat.uses, 1)).toFixed(2);
          const successTotal = stat.successes + stat.failures;
          const successRate = successTotal > 0
            ? `${Math.round((stat.successes / successTotal) * 100)}%`
            : "n/a";
          return `- ${name}: uses=${stat.uses}, correction-ratio=${ratio}, failures=${stat.toolFailures}, feedback-success=${successRate}`;
        }).join("\n");

        const prompt = `You are selecting which loaded skill(s) should be improved based on current session quality and loaded skill history.

## Current Session
- Estimate: ${estimate.combined}/10 (${scoreLabel(estimate.combined)})
- Quality: ${estimate.quality}/10
- Efficiency: ${estimate.efficiency}/10
- Stability: ${estimate.stability}/10
- User messages: ${sessionUserMessageCount}
- Friction count: ${sessionFrictionCount}
- Tool failures: ${sessionToolFailures}
- Assistant turns: ${sessionAssistantTurns}

## Loaded Skills
${loadedSummary}

## Friction Log (current session)
${frictionLog.map((f) => `- ${f}`).join("\n") || "(none)"}

Task:
1) Select up to 2 loaded skills that are most likely causing session friction.
2) For each selected skill:
   - read ${SKILLS_DIR}/<skill>/SKILL.md
   - propose concrete edits and apply them
   - commit changes in ${SKILLS_DIR} with message: improve <skill>: <short reason>
3) If no loaded skill needs changes, use the skill_eval tool to add actionable directives. Do NOT write to ${AGENTS_EVALS_FILE} directly.
4) Write directives ("always X", "never Y", "when Z do W"), not observations. Do NOT add one-off incidents.
5) If there are neither skill-specific nor evaluation findings, output exactly: No skill improvements needed.

Do not modify skills that are not in the loaded list.`;

        runImproveAgent(prompt, loadedSkills);
        ctx.ui.notify(`Started session-based skill improvement review for ${loadedSkills.length} loaded skill(s).`, "info");
        return;
      }

      // Search order: global store → project .pi/skills/ → project .claude/skills/
      let skillPath = "";
      let isProjectSkill = false;

      const candidates = [
        join(SKILLS_DIR, skillName, "SKILL.md"),
        join(ctx.cwd, ".pi", "skills", skillName, "SKILL.md"),
        join(ctx.cwd, ".claude", "skills", skillName, "SKILL.md"),
      ];

      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          skillPath = candidate;
          isProjectSkill = !candidate.startsWith(SKILLS_DIR);
          break;
        }
      }

      if (!skillPath) {
        ctx.ui.notify(`Skill "${skillName}" not found in global store or project.`, "error");
        return;
      }

      const stats = loadStats();
      const stat = stats[skillName];
      const location = isProjectSkill ? `project skill at ${skillPath}` : `global skill at ${skillPath}`;

      let statsBlock = "";
      if (stat) {
        const ratio = (stat.manualComments / Math.max(stat.uses, 1)).toFixed(2);
        statsBlock = `## Usage Stats
- Uses: ${stat.uses}
- Manual comments (user corrections): ${stat.manualComments}
- Correction ratio: ${ratio} (lower is better, 0 = no corrections needed)
- Last used: ${stat.lastUsed}
${parseFloat(ratio) > 0.5 ? "\n⚠️ HIGH correction ratio — users frequently intervene when this skill is active. Focus on clarity and completeness." : ""}`;
      } else {
        statsBlock = "## Usage Stats\nNo usage data yet.";
      }

      const prompt = `You are reviewing a skill to improve it. Read the ${location} first.

${statsBlock}

## Review Checklist

Evaluate each dimension. For each, state PASS or FAIL with a one-line reason.

### 1. Description quality
- Does the \`description\` frontmatter clearly state WHEN to use this skill?
- Does it list specific trigger phrases or scenarios?
- Would an LLM correctly match a user request to this skill based on the description alone?

### 2. Instruction clarity
- Are steps numbered and unambiguous?
- Could an LLM follow them without guessing?
- Are there implicit assumptions that should be explicit?
- Are there vague phrases like "consider", "you may want to", "if appropriate"? Replace with concrete conditions.

### 3. Tool and path references
- Does it reference tools that actually exist in the current environment?
- Are file paths correct and resolvable?
- Are relative paths anchored to the skill directory?

### 4. Completeness
- Are there common scenarios the skill doesn't handle?
- Are error/edge cases covered?
- Does it say what to do when things go wrong?

### 5. Structure
- Does it follow the Agent Skills spec? (name, description frontmatter required)
- Is the name lowercase, a-z/0-9/hyphens, matches parent directory?
- Is the description under 1024 chars?

### 6. Actionability
- Does every instruction result in a concrete action?
- Are there instructions that the LLM cannot actually execute?
- If the skill says "check X" — does it say what to do with the result?

## Output Format

1. Show the checklist results (PASS/FAIL per dimension)
2. List specific improvements as a numbered list
3. Show the full improved SKILL.md content
4. Ask for confirmation
5. If confirmed:${isProjectSkill
  ? `
   This is a **project skill** (original: ${skillPath}).
   Write the improved version to the GLOBAL store as an override:
   \`\`\`bash
   mkdir -p ${join(SKILLS_DIR, skillName)}
   \`\`\`
   Then write the improved SKILL.md to \`${join(SKILLS_DIR, skillName, "SKILL.md")}\`
   Then commit:
   \`\`\`bash
   cd ${SKILLS_DIR} && git add -A && git commit -m "override ${skillName}: <one-line summary of changes>"
   \`\`\`
   The global version will take precedence over the project version (pi loads global skills first).
   Original project file is NOT modified.`
  : `
   Write the improved SKILL.md to \`${skillPath}\`
   Then commit:
   \`\`\`bash
   cd ${SKILLS_DIR} && git add -A && git commit -m "improve ${skillName}: <one-line summary of changes>"
   \`\`\``}`;

      // For project skills, pre-record the override
      // even before the LLM finishes writing
      if (isProjectSkill) {
        const overrides = loadOverrides();
        overrides[skillName] = {
          originalPath: skillPath,
          project: ctx.cwd,
          created: today(),
        };
        saveOverrides(overrides);
      }

      pi.sendUserMessage(prompt, { deliverAs: "followUp" });
    },
  });

  // /skills:loaded - list skills active in current session
  pi.registerCommand("skills:loaded", {
    description: "List skills loaded in the current session with source",
    handler: async (_args, ctx) => {
      const stats = loadStats();
      const lines = [`${activeSkills.size} skill(s) loaded this session:`, ""];
      if (activeSkills.size === 0) {
        lines.push("  (none)");
      }
      for (const [name, source] of [...activeSkills.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const stat = stats[name];
        const uses = stat ? `${stat.uses} uses` : "new";
        const ratio = stat && stat.uses > 0
          ? `, ratio ${(stat.manualComments / stat.uses).toFixed(2)}`
          : "";
        lines.push(`  ${name} [${source}] (${uses}${ratio})`);
      }

      const estimate = currentSessionEstimate();
      lines.push("");
      lines.push(`Session estimate (all activity): ${estimate.combined}/10 (${scoreLabel(estimate.combined)})`);
      lines.push(`  quality ${estimate.quality}/10 · efficiency ${estimate.efficiency}/10 · stability ${estimate.stability}/10`);
      lines.push(`Session messages: ${sessionUserMessageCount}, Session friction: ${sessionFrictionCount}, Tool failures: ${sessionToolFailures}`);

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // /skills:eval:template - show expected evaluation entry format
  pi.registerCommand("skills:eval:template", {
    description: "Show AGENTS_EVALS skill evaluation entry template",
    handler: async (_args, ctx) => {
      const lines = [
        `File: ${AGENTS_EVALS_FILE} (read-only, modify via skill_eval tool or /skills:eval:* commands)`,
        "",
        "Entry format:",
        "  - [<id>] <YYYY-MM-DD> skill=<skill-name> score=<1-10> note=<short note>",
        "",
        "Tool usage (LLM):",
        '  skill_eval { action: "add", skill: "context-find", score: 8, note: "always check memory before web search" }',
        '  skill_eval { action: "update", id: 12, score: 6, note: "never use broad triggers for short prompts" }',
        "",
        "Command usage (user):",
        "  /skills:eval:add context-find 8 always check memory before web search",
        "  /skills:eval:update 12 6 never use broad triggers for short prompts",
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // /skills:eval:add <skill> <score> <note>
  pi.registerCommand("skills:eval:add", {
    description: "Add a skill evaluation entry to AGENTS_EVALS.md",
    handler: async (args, ctx) => {
      const raw = (args || "").trim();
      const match = raw.match(/^(\S+)\s+(10|[1-9])\s+(.+)$/);
      if (!match) {
        ctx.ui.notify("Usage: /skills:eval:add <skill> <1-10> <note>", "error");
        return;
      }

      const skill = match[1].trim();
      const score = Number.parseInt(match[2], 10);
      const note = sanitizeEvalNote(match[3]);
      if (!note) {
        ctx.ui.notify("Note must be non-empty.", "error");
        return;
      }

      let lines = readAgentsEvalsLines();
      const entries = parseSkillEvalEntries(lines);
      const id = nextSkillEvalId(entries);
      const entry = formatSkillEvalEntry({ id, date: today(), skill, score, note });

      // Find or create ## <skill> section and insert entry there
      const sectionHeader = `## ${skill}`;
      let sectionIdx = lines.findIndex((l) => l.trim() === sectionHeader);
      if (sectionIdx === -1) {
        // Create section at end of file
        if (lines.length > 0 && lines[lines.length - 1].trim() !== "") lines.push("");
        lines.push(sectionHeader, "");
        sectionIdx = lines.length - 2;
      }
      // Insert after the section header (and any blank line following it)
      let insertIdx = sectionIdx + 1;
      while (insertIdx < lines.length && lines[insertIdx].trim() === "") insertIdx++;
      lines.splice(insertIdx, 0, entry);
      writeAgentsEvalsLines(lines);
      ctx.ui.notify(`Added evaluation #${id} for ${skill} (${score}/10).`, "success");
    },
  });

  // /skills:eval:list [skill]
  pi.registerCommand("skills:eval:list", {
    description: "List skill evaluation entries, optionally filtered by skill",
    handler: async (args, ctx) => {
      const skillFilter = (args || "").trim();
      const lines = readAgentsEvalsLines();
      const entries = parseSkillEvalEntries(lines)
        .filter((e) => !skillFilter || e.skill === skillFilter)
        .sort((a, b) => b.id - a.id);

      if (entries.length === 0) {
        ctx.ui.notify(skillFilter
          ? `No evaluations for skill \"${skillFilter}\".`
          : "No skill evaluations recorded.", "info");
        return;
      }

      const out = [
        skillFilter
          ? `Skill evaluations for ${skillFilter} (${entries.length}):`
          : `Skill evaluations (${entries.length}):`,
        "",
      ];

      for (const e of entries) {
        out.push(`  #${e.id}  ${e.date}  ${e.skill}  ${e.score}/10`);
        out.push(`    ${e.note}`);
      }

      ctx.ui.notify(out.join("\n"), "info");
    },
  });

  // /skills:eval:last [n]
  pi.registerCommand("skills:eval:last", {
    description: "Show last N skill evaluation entries (default 10)",
    handler: async (args, ctx) => {
      const n = Number.parseInt((args || "10").trim(), 10);
      const limit = Number.isFinite(n) && n > 0 ? n : 10;

      const entries = parseSkillEvalEntries(readAgentsEvalsLines())
        .sort((a, b) => b.id - a.id)
        .slice(0, limit);

      if (entries.length === 0) {
        ctx.ui.notify("No skill evaluations recorded.", "info");
        return;
      }

      const out = [`Last ${entries.length} skill evaluations:`, ""];
      for (const e of entries) {
        out.push(`  #${e.id}  ${e.date}  ${e.skill}  ${e.score}/10`);
        out.push(`    ${e.note}`);
      }

      ctx.ui.notify(out.join("\n"), "info");
    },
  });

  // /skills:eval:update <id> <score> <note>
  pi.registerCommand("skills:eval:update", {
    description: "Update score/note for an existing evaluation entry by id",
    handler: async (args, ctx) => {
      const raw = (args || "").trim();
      const match = raw.match(/^(\d+)\s+(10|[1-9])\s+(.+)$/);
      if (!match) {
        ctx.ui.notify("Usage: /skills:eval:update <id> <1-10> <note>", "error");
        return;
      }

      const id = Number.parseInt(match[1], 10);
      const score = Number.parseInt(match[2], 10);
      const note = sanitizeEvalNote(match[3]);

      const lines = readAgentsEvalsLines();
      const entries = parseSkillEvalEntries(lines);
      const existing = entries.find((e) => e.id === id);
      if (!existing) {
        ctx.ui.notify(`Evaluation #${id} not found.`, "error");
        return;
      }

      lines[existing.lineIndex] = formatSkillEvalEntry({
        id: existing.id,
        date: existing.date,
        skill: existing.skill,
        score,
        note,
      });

      writeAgentsEvalsLines(lines);
      ctx.ui.notify(`Updated evaluation #${id}.`, "success");
    },
  });

  // /skills:eval:remove <id>
  pi.registerCommand("skills:eval:remove", {
    description: "Remove an evaluation entry by id",
    handler: async (args, ctx) => {
      const id = Number.parseInt((args || "").trim(), 10);
      if (!Number.isFinite(id) || id <= 0) {
        ctx.ui.notify("Usage: /skills:eval:remove <id>", "error");
        return;
      }

      const lines = readAgentsEvalsLines();
      const entries = parseSkillEvalEntries(lines);
      const existing = entries.find((e) => e.id === id);
      if (!existing) {
        ctx.ui.notify(`Evaluation #${id} not found.`, "error");
        return;
      }

      lines.splice(existing.lineIndex, 1);
      writeAgentsEvalsLines(lines);
      ctx.ui.notify(`Removed evaluation #${id}.`, "success");
    },
  });

  // /skills:list - list all skills with source info
  pi.registerCommand("skills:list", {
    description: "List all skills: global store + project-level",
    handler: async (_args, ctx) => {
      const home = homedir();
      const shortPath = (p: string) => p.startsWith(home) ? "~" + p.slice(home.length) : p;

      const stats = loadStats();
      const overrides = loadOverrides();
      const lines: string[] = [];

      // --- Global skills ---
      const globalEntries = readdirSync(SKILLS_DIR)
        .filter((name) => {
          try { return statSync(join(SKILLS_DIR, name, "SKILL.md")).isFile(); } catch { return false; }
        })
        .sort();

      lines.push(`## Global (${globalEntries.length}) — ${shortPath(SKILLS_DIR)}`);
      lines.push("");
      for (const name of globalEntries) {
        const stat = stats[name];
        const usage = stat ? ` (${stat.uses} uses)` : "";
        const overrideTag = overrides[name] ? " [override]" : "";
        const loadedSource = activeSkills.get(name);
        const loadedTag = loadedSource ? ` [${loadedSource}]` : "";
        lines.push(`  ${name}${usage}${overrideTag}${loadedTag}`);
      }

      // --- Project skills ---
      const projectPaths = discoverProjectSkillPaths(ctx.cwd);
      for (const skillsDir of projectPaths) {
        let projectEntries: string[];
        try {
          projectEntries = readdirSync(skillsDir)
            .filter((name) => {
              try { return statSync(join(skillsDir, name, "SKILL.md")).isFile(); } catch { return false; }
            })
            .sort();
        } catch { continue; }

        if (projectEntries.length === 0) continue;

        lines.push("");
        lines.push(`## Project (${projectEntries.length}) — ${shortPath(skillsDir)}`);
        lines.push("");
        for (const name of projectEntries) {
          const loadedSource = activeSkills.get(name);
          const loadedTag = loadedSource ? ` [${loadedSource}]` : "";
          lines.push(`  ${name}${loadedTag}`);
        }
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}


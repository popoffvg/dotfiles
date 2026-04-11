/**
 * Core memory-keeper library — pure TS, no Pi or MCP dependencies.
 * Handles: config loading, project detection, insight classification prompt,
 * deduplication (local + QMD), insight saving, token stats tracking.
 */

import {
  readFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { logger, LOG_DIR } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────

export interface Config {
  insights_root?: string;
  /** "auto" (cheapest available, default), or "provider/model-id" to pin */
  insight_model?: string;
  llm_provider?: string;
  llm_api_key?: string;
  llm_model?: string;
  llm_base_url?: string;
  openrouter_api_key?: string;
  openrouter_model?: string;
  log_level?: string;
  exclude_paths?: string;
  [key: string]: string | undefined;
}

export interface Insight {
  classification: "insight" | "task" | "agent_edit" | "none";
  category: string;
  repo: string;
  topic: string;
  body: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ProcessResult {
  savedCount: number;
  skippedCount: number;
  usage: TokenUsage;
}

export interface DayStats {
  date: string;
  sessions: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  savedCount: number;
}

/** Injected QMD search function — allows different implementations per adapter */
export type QmdSearchFn = (
  query: string,
  collection?: string,
  n?: number,
  minScore?: number
) => QmdHit[];

export interface QmdHit {
  project: string;
  file: string;
  score: number;
  title: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

export const TOKEN_STATS_FILE = join(LOG_DIR, "token-stats.jsonl");

// ─── Config ───────────────────────────────────────────────────────────────

const CONFIG_PATH = join(homedir(), ".claude", "memory-keeper.local.md");

export function loadConfig(): Config {
  let content: string;
  try {
    content = readFileSync(CONFIG_PATH, "utf8");
  } catch {
    return {};
  }
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const config: Config = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith("~")) val = val.replace("~", homedir());
    if (key && val) config[key] = val;
  }
  return config;
}

// ─── Project detection ────────────────────────────────────────────────────

export function detectProject(cwd: string): string {
  const envProject = process.env.PI_PROJECT || process.env.WORK_PROJECT;
  if (envProject?.trim()) return envProject.trim();
  return basename(cwd);
}

// ─── Project summary ─────────────────────────────────────────────────────

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function findProjectSummary(
  insightsRoot: string,
  cwd: string
): string | null {
  const project = detectProject(cwd);
  const projectLower = project.toLowerCase();

  for (const dir of safeReaddir(insightsRoot)) {
    const fullDir = join(insightsRoot, dir);
    if (!isDir(fullDir)) continue;
    if (dir.toLowerCase() === projectLower) {
      const summary = join(fullDir, "_summary.md");
      if (existsSync(summary)) return readFileSync(summary, "utf8");
    }
  }

  const cwdLower = cwd.toLowerCase();
  for (const dir of safeReaddir(insightsRoot)) {
    const fullDir = join(insightsRoot, dir);
    if (!isDir(fullDir)) continue;
    if (cwdLower.includes(dir.toLowerCase())) {
      const summary = join(fullDir, "_summary.md");
      if (existsSync(summary)) return readFileSync(summary, "utf8");
    }
  }

  const indexPath = join(insightsRoot, "INDEX.md");
  if (existsSync(indexPath)) return readFileSync(indexPath, "utf8");
  return null;
}

// ─── Path exclusion ──────────────────────────────────────────────────────

export function isExcluded(cwd: string, config: Config): boolean {
  const raw = config.exclude_paths;
  if (!raw) return false;
  const patterns = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (patterns.length === 0) return false;
  const normalizedCwd = cwd.replace(/\\/g, "/");
  return patterns.some((pattern) =>
    globMatch(normalizedCwd, pattern.replace(/\\/g, "/"))
  );
}

function globMatch(str: string, pattern: string): boolean {
  const specialChars = /[.+^${}()|[\]\\]/g;
  let re = "^";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      re += ".*";
      i += 2;
      if (pattern[i] === "/") i++;
    } else if (c === "*") {
      re += "[^/]*";
      i++;
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else {
      re += c.replace(specialChars, "\\$&");
      i++;
    }
  }
  re += "$";
  try {
    return new RegExp(re).test(str);
  } catch {
    return false;
  }
}

// ─── Classification prompt ───────────────────────────────────────────────

export const CLASSIFY_PROMPT = `You are a knowledge base writer for a developer's personal wiki.
Goal: fast context recall. Each entry must enable fast pick (findable by search), fast recall (self-contained lead sentence), and fast remember (concrete identifiers tie back to code).

Respond with ONLY valid JSON array (no markdown fences):

[
  {
    "classification": "insight" | "task" | "agent_edit" | "none",
    "category": "tool or technology slug (see list below)",
    "repo": "repository basename (e.g. 'pl', 'memory-keeper')",
    "topic": "keyword-rich title 3-7 words",
    "body": "wiki entry in markdown (see format below)"
  }
]

## Categories — pick the PRIMARY tool/technology

Use lowercase kebab-case. Pick the most specific applicable category:

| Category | When to use |
|----------|-------------|
| github-actions | Workflows, actions, runners, CI/CD yaml, act tool |
| git | Branches, merges, rebases, hooks, worktrees, tags |
| helm | Charts, values, templates, helm commands |
| k8s | Kubernetes resources, operators, kubectl, CRDs |
| docker | Containers, images, Dockerfile, compose, buildx |
| go | Go language, modules, testing, concurrency |
| rust | Rust language, cargo, traits, lifetimes |
| typescript | TS/JS, node, npm, pnpm, bundlers |
| python | Python, pip, venv, uv |
| shell | Bash, fish, zsh, scripts, CLI tools |
| sql | Databases, queries, migrations |
| api | REST, gRPC, protobuf, OpenAPI |
| architecture | System design, patterns, data flow |
| testing | Test strategies, frameworks, mocking |
| performance | Profiling, optimization, benchmarks |
| security | Auth, secrets, vulnerabilities |
| infra | Cloud, networking, DNS, storage |
| tools | Editor, IDE, CLI utilities, dev tools |

If nothing fits, use "general". For agent_edit, always use "agent-config".

## Entry format

The "body" field contains everything AFTER the heading line (heading is generated separately from "topic"):

<Lead: direct statement of what this is and why it matters. 1-3 sentences.
Include concrete identifiers: file paths, function names, config keys, env vars.
No preamble. Write for someone with zero memory of this session.>

### Subsection (only when topic has 2+ distinct aspects)
<Details>

## Heading rules — the heading is the search key

Must be findable by someone who forgot: "what was that thing about X?"
Good: "Pi session_shutdown: handler awaited before process.exit"
Good: "RocksDB WAL mode: disable for unit test parallelism"
Good: "Go context: cancel propagates through goroutine tree"
Bad: "Shutdown analysis", "Important fix", "Database stuff"

## Body rules — lead sentence is the recall unit

- First sentence must be self-contained: complete picture without reading more
- Never: "In this session...", "We discovered...", "It was found..."
- State facts directly: "X does Y because Z"
- Include file paths, function names, config values from the conversation
- Subsections only for 2+ genuinely distinct concerns

## Classifications

- "insight": completed work — how things work, architecture, patterns, gotchas, decisions
- "task": ONLY work planned but NOT started yet
- "agent_edit": changes to AI behavior, skills, hooks, prompts, plugin config
- "none": routine work, nothing reusable

## Rules

- One topic per distinct concept
- "body" is REQUIRED for non-none entries
- "category" is REQUIRED for non-none entries
- Describe the SYSTEM, not the SESSION
- "repo": from conversation context, fall back to detected project
- Return [] if nothing worth recording
- DEDUP: if "existing_topics" provided, skip already-covered topics

Conversation:
`;

// ─── Deduplication ────────────────────────────────────────────────────────

export function extractHeadings(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf8");
  const raw = content.match(/^## .+/gm) || [];
  return raw.map((h) =>
    h
      .replace(/^## /, "")
      .replace(/ — \d{4}-\d{2}-\d{2}.*$/, "")
      .trim()
  );
}

export function wordOverlap(a: string, b: string): number {
  const stopwords = new Set([
    "a", "an", "the", "is", "in", "of", "to", "for",
    "and", "or", "on", "with", "not", "vs",
  ]);
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !stopwords.has(w))
    );
  const setA = words(a);
  const setB = words(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  return intersection / Math.min(setA.size, setB.size);
}

export function deduplicateCheck(filePath: string, topic: string): boolean {
  const headings = extractHeadings(filePath);
  if (headings.length === 0) return false;
  const topicLower = topic.toLowerCase();
  for (const h of headings) {
    const hLower = h.toLowerCase();
    if (hLower.includes(topicLower) || topicLower.includes(hLower)) return true;
    if (wordOverlap(topic, h) >= 0.7) return true;
  }
  return false;
}

/**
 * QMD-based semantic deduplication.
 * Takes an injected search function so adapters can provide their own implementation.
 */
export function qmdDedup(
  topic: string,
  summary: string,
  targetProject: string,
  searchFn: QmdSearchFn
): { action: "save" | "skip"; links: string[]; reason?: string } {
  const query = summary || topic;
  const hits = searchFn(query, "ctx", 3, 0.5);
  if (hits.length === 0) return { action: "save", links: [] };

  const sameProject = hits.filter(
    (h: QmdHit) => h.project === targetProject && h.score >= 0.7
  );
  const otherProjects = hits.filter(
    (h: QmdHit) =>
      h.project !== targetProject &&
      h.project !== "_tasks" &&
      h.score >= 0.6
  );

  if (sameProject.length > 0) {
    return {
      action: "skip",
      links: [],
      reason: `QMD match in ${targetProject}: "${sameProject[0].title}" (${sameProject[0].score})`,
    };
  }

  const seen = new Set<string>();
  const links = otherProjects
    .filter((h: QmdHit) => {
      if (seen.has(h.project)) return false;
      seen.add(h.project);
      return true;
    })
    .map((h: QmdHit) => `[[${h.file}|${h.title}]]`);

  return { action: "save", links };
}

// ─── Insight saving ──────────────────────────────────────────────────────

export function saveInsight(
  insightsRoot: string,
  project: string,
  classification: string,
  topic: string,
  body: string,
  category?: string
): string | null {
  const now = new Date().toISOString().replace("T", " ").slice(0, 16);
  const entry = `## ${topic} — ${now}\n${body}\n`;

  if (classification === "insight") {
    const cat = (category || "general")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");
    const projectDir = join(insightsRoot, project);
    mkdirSync(projectDir, { recursive: true });
    const targetFile = join(projectDir, `${cat}.md`);

    if (deduplicateCheck(targetFile, topic)) {
      logger.debug({ topic, file: targetFile }, "dedup skipped insight");
      return null;
    }
    appendFileSync(targetFile, "\n" + entry);
    return targetFile;
  }

  if (classification === "task") {
    const tasksDir = join(insightsRoot, "_tasks");
    mkdirSync(tasksDir, { recursive: true });
    const targetFile = join(tasksDir, "pending.md");
    const taskEntry = `## ${topic}\n- **Status**: active\n- **Repos**: ${project}\n- **Captured**: ${now}\n${body}\n`;
    if (deduplicateCheck(targetFile, topic)) {
      logger.debug({ topic }, "dedup skipped task");
      return null;
    }
    appendFileSync(targetFile, "\n" + taskEntry);
    const slug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+$/, "");
    mkdirSync(join(tasksDir, slug), { recursive: true });
    return targetFile;
  }

  if (classification === "agent_edit") {
    const configDir = join(insightsRoot, "claude-config");
    mkdirSync(configDir, { recursive: true });
    const targetFile = join(configDir, "behavior.md");
    if (deduplicateCheck(targetFile, topic)) {
      logger.debug({ topic }, "dedup skipped agent_edit");
      return null;
    }
    appendFileSync(targetFile, "\n" + entry);
    return targetFile;
  }

  return null;
}

// ─── Collect existing topics ─────────────────────────────────────────────

export function collectExistingTopics(
  insightsRoot: string,
  project: string
): string[] {
  const projectDir = join(insightsRoot, project);
  const projectFiles = safeReaddir(projectDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(projectDir, f));

  return [
    ...projectFiles.flatMap(extractHeadings),
    ...extractHeadings(join(insightsRoot, "claude-config", "behavior.md")),
  ];
}

// ─── Build full classification prompt ────────────────────────────────────

export function buildClassifyPrompt(
  project: string,
  existingTopics: string[],
  conversation: string
): string {
  const dedupBlock =
    existingTopics.length > 0
      ? `\n[Existing topics — do NOT duplicate these]:\n${existingTopics.map((t) => `- ${t}`).join("\n")}\n\n`
      : "\n";

  return CLASSIFY_PROMPT + `[Project: ${project}]` + dedupBlock + conversation;
}

// ─── Parse LLM classification response ───────────────────────────────────

export function parseClassification(text: string): Insight[] {
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace > 0) {
      const salvaged = cleaned.slice(0, lastBrace + 1) + "]";
      try {
        parsed = JSON.parse(salvaged);
        logger.warn("salvaged truncated JSON from LLM response");
      } catch {
        logger.error({ raw: cleaned.slice(0, 200) }, "unsalvageable JSON from LLM response");
        return [];
      }
    } else {
      logger.error("no JSON to salvage from LLM response");
      return [];
    }
  }

  const results = Array.isArray(parsed) ? parsed : [parsed];
  return results.filter(
    (r: Record<string, unknown>) => r.classification !== "none"
  ) as Insight[];
}

// ─── Process insights (classify + dedup + save) ──────────────────────────

export function processInsights(
  insights: Insight[],
  insightsRoot: string,
  project: string,
  qmdSearchFn?: QmdSearchFn
): { savedCount: number; skippedCount: number } {
  let savedCount = 0;
  let skippedCount = 0;

  for (const result of insights) {
    const { classification, repo, topic, category } = result;
    let { body } = result;
    const targetRepo = repo || project;

    if (classification !== "task" && qmdSearchFn) {
      const qmd = qmdDedup(topic, body, targetRepo, qmdSearchFn);
      if (qmd.action === "skip") {
        logger.debug({ topic, repo: targetRepo, reason: qmd.reason }, "qmd-dedup skipped");
        skippedCount++;
        continue;
      }
      if (qmd.links.length > 0) {
        body += `\n\n**See also**: ${qmd.links.join(", ")}`;
      }
    }

    const savedTo = saveInsight(
      insightsRoot,
      targetRepo,
      classification,
      topic,
      body,
      category
    );
    logger.info(
      { classification, category: category || "general", repo: targetRepo, topic, file: savedTo || "dedup" },
      "insight processed"
    );
    if (savedTo) savedCount++;
    else skippedCount++;
  }

  return { savedCount, skippedCount };
}

// ─── Token stats ─────────────────────────────────────────────────────────

export function trackTokenUsage(
  sessionId: string,
  project: string,
  usage: TokenUsage,
  savedCount: number
): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    const entry = JSON.stringify({
      timestamp: ts,
      session: sessionId,
      project,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens,
      saved_count: savedCount,
    });
    appendFileSync(TOKEN_STATS_FILE, entry + "\n");
  } catch {}
}

export function loadTokenStatsByDay(days: number = 10): DayStats[] {
  try {
    if (!existsSync(TOKEN_STATS_FILE)) return [];
    const lines = readFileSync(TOKEN_STATS_FILE, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);

    const byDay = new Map<string, DayStats>();
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const date = (e.timestamp ?? "").slice(0, 10);
        if (!date || date.length !== 10) continue;
        let d = byDay.get(date);
        if (!d) {
          d = {
            date,
            sessions: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            savedCount: 0,
          };
          byDay.set(date, d);
        }
        d.sessions += 1;
        d.inputTokens += e.input_tokens ?? 0;
        d.outputTokens += e.output_tokens ?? 0;
        d.totalTokens += e.total_tokens ?? 0;
        d.savedCount += e.saved_count ?? 0;
      } catch {}
    }

    return Array.from(byDay.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, days);
  } catch {
    return [];
  }
}

// ─── List topics for a project ───────────────────────────────────────────

export function listTopics(
  insightsRoot: string,
  project: string
): { category: string; topics: string[] }[] {
  const projectDir = join(insightsRoot, project);
  const files = safeReaddir(projectDir).filter((f) => f.endsWith(".md"));

  return files.map((f) => ({
    category: f.replace(/\.md$/, ""),
    topics: extractHeadings(join(projectDir, f)),
  }));
}

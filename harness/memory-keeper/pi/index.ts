import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import {
  PLUGIN_WORKFLOW_EVENTS,
  type PluginWorkflowStartPayload,
  type PluginWorkflowEndPayload,
  type PluginWorkflowEventPayload,
} from "../../pi-extensions/plugin-workflow-events";
import { keyHint } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { execSync } from "child_process";
import {
  readFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  statSync,
  readdirSync,
  unlinkSync,
  renameSync,
} from "fs";
import { join, basename } from "path";
import { homedir } from "os";

// ─── Render helpers for collapsed tool output ──────────────────────────────

interface QmdDetails {
  exitCode: number;
  output: string;
  resultCount?: number;
}

function summarizeQmdOutput(output: string): { lines: number; resultCount: number; firstLines: string[] } {
  const allLines = output.split("\n");
  const lines = allLines.length;
  const resultCount = allLines.filter((l) => /^(---|===|\d+\.)/.test(l.trim())).length || 1;
  const firstLines = allLines.slice(0, 3).filter((l) => l.trim());
  return { lines, resultCount, firstLines };
}

function renderQmdCall(toolLabel: string, args: Record<string, any>, theme: Theme): Text {
  let text = theme.fg("toolTitle", theme.bold(toolLabel + " "));
  text += theme.fg("accent", `"${args.query || args.file || ""}"`);
  if (args.collection) text += theme.fg("dim", ` collection=${args.collection}`);
  if (args.n) text += theme.fg("dim", ` n=${args.n}`);
  if (args.from) text += theme.fg("dim", ` from=${args.from}`);
  if (args.lines) text += theme.fg("dim", ` lines=${args.lines}`);
  return new Text(text, 0, 0);
}

function renderQmdResult(
  result: { content: any[]; details?: QmdDetails },
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme
): Text {
  if (options.isPartial) {
    return new Text(theme.fg("warning", "Searching..."), 0, 0);
  }
  const details = result.details as QmdDetails | undefined;
  const output = details?.output || "";
  if (!output || output === "(no results)" || output === "(empty)") {
    return new Text(theme.fg("dim", "(no results)"), 0, 0);
  }
  if (details?.exitCode !== 0) {
    return new Text(theme.fg("error", `Exit code ${details?.exitCode}: ${output.slice(0, 200)}`), 0, 0);
  }
  const { lines, firstLines } = summarizeQmdOutput(output);
  if (options.expanded) {
    return new Text(output, 0, 0);
  }
  let text = theme.fg("success", `✓ `) + theme.fg("muted", `${lines} lines`);
  if (firstLines.length > 0) {
    text += "\n" + theme.fg("dim", firstLines.map((l) => (l.length > 80 ? l.slice(0, 77) + "..." : l)).join("\n"));
  }
  text += "\n" + theme.fg("dim", `(${keyHint("expandTools", "to expand")})`);
  return new Text(text, 0, 0);
}

// ─── Config ────────────────────────────────────────────────────────────────

interface Config {
  insights_root?: string;
  /** Model for insight extraction: "auto" (cheapest available, default), or "provider/model-id" to pin */
  insight_model?: string;
  llm_provider?: string;
  llm_api_key?: string;
  llm_model?: string;
  llm_base_url?: string;
  openrouter_api_key?: string;
  openrouter_model?: string;
  log_level?: string;
  [key: string]: string | undefined;
}

function loadConfig(): Config {
  const configPath = join(homedir(), ".claude", "memory-keeper.local.md");
  let content: string;
  try {
    content = readFileSync(configPath, "utf8");
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

// ─── Shell escaping ────────────────────────────────────────────────────────

function shellEscape(s: string): string {
  // Use single quotes and escape any single quotes inside
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// ─── Project detection ─────────────────────────────────────────────────────

function detectProject(cwd: string): string {
  // 1. Explicit PI_PROJECT env var takes priority
  const envProject = process.env.PI_PROJECT;
  if (envProject && envProject.trim()) {
    return envProject.trim();
  }

  // 2. Fall back to session folder (cwd basename)
  return basename(cwd);
}

// ─── Find project summary ──────────────────────────────────────────────────

function findProjectSummary(insightsRoot: string, cwd: string): string | null {
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

// ─── Conversation extraction from pi session ───────────────────────────────

const MAX_CONVERSATION_CHARS = 8000;

function extractEntryText(entry: any): string | null {
  if (entry.type !== "message") return null;
  const msg = entry.message;
  if (!msg) return null;

  if (msg.role === "user") {
    const text =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content
              .filter((b: any) => b.type === "text")
              .map((b: any) => b.text)
              .join("\n")
          : "";
    if (text && !text.startsWith("<") && text.length > 5) {
      return `User: ${text}`;
    }
  } else if (msg.role === "assistant") {
    const blocks = msg.content || [];
    const texts = Array.isArray(blocks)
      ? blocks
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n")
      : typeof blocks === "string"
        ? blocks
        : "";
    if (texts) {
      return `Assistant: ${texts}`;
    }
  }
  return null;
}

function extractConversation(entries: any[], maxChars = MAX_CONVERSATION_CHARS): string {
  const messages: string[] = [];
  for (const entry of entries) {
    const text = extractEntryText(entry);
    if (text) messages.push(text);
  }

  let total = 0;
  const selected: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (total + messages[i].length > maxChars) break;
    selected.unshift(messages[i]);
    total += messages[i].length;
  }
  return selected.join("\n\n");
}

/**
 * Extract conversation text from entries starting at `fromIndex`.
 * Returns the text and the new cursor (index after last processed entry).
 */
function extractConversationSlice(
  entries: any[],
  fromIndex: number,
  maxChars = MAX_CONVERSATION_CHARS
): { text: string; newCursor: number } {
  const messages: string[] = [];
  let cursor = fromIndex;
  for (let i = fromIndex; i < entries.length; i++) {
    const text = extractEntryText(entries[i]);
    if (text) messages.push(text);
    cursor = i + 1;
  }

  // Trim from the front if too long
  let total = 0;
  const selected: string[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (total + messages[i].length > maxChars) break;
    selected.unshift(messages[i]);
    total += messages[i].length;
  }
  return { text: selected.join("\n\n"), newCursor: cursor };
}

// ─── Logging ───────────────────────────────────────────────────────────────

const LOG_DIR = join(homedir(), ".claude", "debug");
const LOG_FILE = join(LOG_DIR, "memory-keeper-pi.log");
const MAX_LOG_SIZE = 512 * 1024;
const MAX_LOG_FILES = 3;

function rotateLog() {
  try {
    if (!existsSync(LOG_FILE)) return;
    const { size } = statSync(LOG_FILE);
    if (size < MAX_LOG_SIZE) return;
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const older = `${LOG_FILE}.${i}`;
      const newer = i === 1 ? LOG_FILE : `${LOG_FILE}.${i - 1}`;
      if (existsSync(newer)) {
        if (i === MAX_LOG_FILES - 1 && existsSync(older)) unlinkSync(older);
        renameSync(newer, older);
      }
    }
    writeFileSync(LOG_FILE, "");
  } catch {}
}

function log(msg: string) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${ts} ${msg}\n`);
  } catch {}
}

// ─── Cron state ────────────────────────────────────────────────────────────

const CRON_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const MIN_CONVERSATION_LENGTH = 100; // minimum chars to bother processing
const CURSOR_ENTRY_TYPE = "memory-keeper-cursor";

let cronTimer: ReturnType<typeof setInterval> | null = null;
let lastProcessedCursor = 0;
let cronProcessing = false; // guard against overlapping runs

/** Restore cursor from session entries (last one wins). */
function restoreCursor(entries: any[]): number {
  let cursor = 0;
  for (const entry of entries) {
    if (entry.type === "custom" && entry.customType === CURSOR_ENTRY_TYPE) {
      cursor = entry.data?.cursor ?? 0;
    }
  }
  return cursor;
}

// ─── LLM client ────────────────────────────────────────────────────────────

const OPENAI_COMPAT_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  openai: "https://api.openai.com/v1",
  ollama: "http://localhost:11434/v1",
};

const PROVIDER_DEFAULTS: Record<string, string> = {
  google: "gemini-2.5-flash-lite-preview-06-17",
  openrouter: "anthropic/claude-sonnet-4",
  openai: "gpt-4o-mini",
  ollama: "llama3.1",
};

function createModel(config: Config) {
  const { createOpenAI } = require("@ai-sdk/openai");
  const { createGoogleGenerativeAI } = require("@ai-sdk/google");

  const provider = config.llm_provider || "openrouter";
  const apiKey =
    config.llm_api_key ||
    config.openrouter_api_key ||
    process.env.GOOGLE_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    (provider === "ollama" ? "ollama" : undefined);

  if (!apiKey) {
    throw new Error(`No API key for provider "${provider}". Set llm_api_key in memory-keeper.local.md`);
  }

  const model = config.llm_model || config.openrouter_model || PROVIDER_DEFAULTS[provider] || "gpt-4o-mini";

  if (provider === "google") {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(model);
  }

  const baseURL = config.llm_base_url || OPENAI_COMPAT_URLS[provider];
  if (!baseURL) {
    throw new Error(`Unknown provider "${provider}". Set llm_base_url in memory-keeper.local.md.`);
  }
  const client = createOpenAI({ baseURL, apiKey });
  return client(model);
}

function pickModel(ctx: any, config: Config): any {
  const spec = config.insight_model || "auto";

  if (spec !== "auto") {
    // Pinned model: "provider/model-id"
    const slashIdx = spec.indexOf("/");
    if (slashIdx === -1) {
      throw new Error(`Invalid insight_model "${spec}" — expected "provider/model-id" or "auto"`);
    }
    const provider = spec.slice(0, slashIdx);
    const modelId = spec.slice(slashIdx + 1);
    const found = ctx.modelRegistry.find(provider, modelId);
    if (!found) {
      throw new Error(`Pinned model "${spec}" not found in registry`);
    }
    log(`INFO [model] Pinned: ${found.provider}/${found.id} cost_in=${found.cost.input} cost_out=${found.cost.output}`);
    return found;
  }

  // Auto: cheapest available text model
  const available = ctx.modelRegistry.getAvailable()
    .filter((m: any) => m.input?.includes("text") && m.cost?.input >= 0)
    .sort((a: any, b: any) => (a.cost.input + a.cost.output) - (b.cost.input + b.cost.output));

  if (available.length === 0) {
    throw new Error("No available models with text input in model registry");
  }

  const picked = available[0];
  log(`INFO [model] Auto (cheapest): ${picked.provider}/${picked.id} cost_in=${picked.cost.input} cost_out=${picked.cost.output}`);
  return picked;
}

// ─── LLM Prompt ────────────────────────────────────────────────────────────

const CLASSIFY_PROMPT = `You are a knowledge base writer for a developer's personal wiki.
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

## Examples

insight (github-actions):
{ "classification": "insight", "category": "github-actions", "repo": "pl", "topic": "GitHub Actions: target-branch fallback for PR events", "body": "In PR-triggered workflows, \`github.event.pull_request.base.ref\` provides the target branch. For manual/push triggers, fall back to \`github.ref_name\`. Pattern: \`target-branch: \${{ github.event.pull_request.base.ref || github.ref_name }}\`" }

insight (git):
{ "classification": "insight", "category": "git", "repo": "pl", "topic": "Git squash merge in bind-mounted workdir", "body": "When running \`git merge --squash\` in a bind-mounted container workdir, changes persist on the host. The merge creates a single commit combining all PR changes. Requires \`git commit\` after merge to finalize." }

insight (k8s):
{ "classification": "insight", "category": "k8s", "repo": "pl", "topic": "K8s Job parallel execution: workdir isolation", "body": "Parallel K8s Jobs sharing a PVC workdir cause conflicts — each job's git operations (checkout, merge) interfere. Solution: unique workdir per job via \`\$(JOB_NAME)\` subpath, or sequential execution." }

insight (go):
{ "classification": "insight", "category": "go", "repo": "pl", "topic": "Go context cancellation propagates through goroutine tree", "body": "When a parent context is cancelled, all derived contexts cancel immediately. Use \`context.WithoutCancel()\` (Go 1.21+) to detach background work from request lifecycle." }

agent_edit:
{ "classification": "agent_edit", "category": "agent-config", "repo": "pi", "topic": "Directory guards for work-manager agents", "body": "Added directory guards to all work-manager agent descriptions requiring cwd: ~/Documents/git/*. Agents refuse to spawn outside project contexts, preventing orphaned sessions." }

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

// ─── Deduplication ─────────────────────────────────────────────────────────

function extractHeadings(filePath: string): string[] {
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

function wordOverlap(a: string, b: string): number {
  const stopwords = new Set(["a", "an", "the", "is", "in", "of", "to", "for", "and", "or", "on", "with", "not", "vs"]);
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

function deduplicateCheck(filePath: string, topic: string): boolean {
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

function qmdSearch(query: string, collection = "ctx", n = 3, minScore = 0.5): any[] {
  try {
    const q = query
      .replace(/[`#*|[\]"'$\\]/g, " ")  // Remove shell-dangerous chars
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    const out = execSync(`qmd search ${shellEscape(q)} -c ${collection} -n ${n} --min-score ${minScore} --json`, {
      encoding: "utf8",
      timeout: 5000,
    });
    const results = JSON.parse(out);
    return results.map((r: any) => {
      const match = r.file.match(/insights\/([^/]+)\//);
      return {
        project: match ? match[1] : "unknown",
        file: r.file.replace(/^qmd:\/\/ctx\//, ""),
        score: r.score,
        title: r.title,
      };
    });
  } catch {
    return [];
  }
}

function qmdDedup(topic: string, summary: string, targetProject: string) {
  const query = summary || topic;
  const hits = qmdSearch(query);
  if (hits.length === 0) return { action: "save" as const, links: [] as string[] };

  const sameProject = hits.filter((h: any) => h.project === targetProject && h.score >= 0.7);
  const otherProjects = hits.filter((h: any) => h.project !== targetProject && h.project !== "_tasks" && h.score >= 0.6);

  if (sameProject.length > 0) {
    return { action: "skip" as const, links: [], reason: `QMD match in ${targetProject}: "${sameProject[0].title}" (${sameProject[0].score})` };
  }

  const seen = new Set<string>();
  const links = otherProjects
    .filter((h: any) => {
      if (seen.has(h.project)) return false;
      seen.add(h.project);
      return true;
    })
    .map((h: any) => `[[${h.file}|${h.title}]]`);

  return { action: "save" as const, links };
}

// ─── Insight saving ────────────────────────────────────────────────────────

function saveInsight(
  config: Config,
  project: string,
  classification: string,
  topic: string,
  body: string,
  category?: string
): string | null {
  const insightsRoot = config.insights_root!;
  const now = new Date().toISOString().replace("T", " ").slice(0, 16);
  const entry = `## ${topic} — ${now}\n${body}\n`;

  if (classification === "insight") {
    // Normalize category: lowercase, kebab-case, default to "general"
    const cat = (category || "general").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");

    // Always organize by category within project folder (project from env/cwd)
    const projectDir = join(insightsRoot, project);
    mkdirSync(projectDir, { recursive: true });
    const targetFile = join(projectDir, `${cat}.md`);

    if (deduplicateCheck(targetFile, topic)) {
      log(`DEDUP skipped "${topic}" in ${targetFile}`);
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
      log(`DEDUP skipped task "${topic}"`);
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
      log(`DEDUP skipped agent_edit "${topic}"`);
      return null;
    }
    appendFileSync(targetFile, "\n" + entry);
    return targetFile;
  }

  return null;
}

// ─── Direct session processing ─────────────────────────────────────────────

interface ProcessResult {
  savedCount: number;
  usage: TokenUsage;
}

async function processSessionDirect(
  config: Config,
  project: string,
  sessionId: string,
  conversation: string,
  ctx?: any
): Promise<ProcessResult> {
  const insightsRoot = config.insights_root!;

  // Collect existing topics from all category files in the project folder
  const projectDir = join(insightsRoot, project);
  const projectFiles = safeReaddir(projectDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(projectDir, f));
  
  const existingTopics = [
    ...projectFiles.flatMap(extractHeadings),
    ...extractHeadings(join(insightsRoot, "claude-config", "behavior.md")),
  ];
  const dedupBlock =
    existingTopics.length > 0
      ? `\n[Existing topics — do NOT duplicate these]:\n${existingTopics.map((t) => `- ${t}`).join("\n")}\n\n`
      : "\n";

  const fullPrompt = CLASSIFY_PROMPT + `[Project: ${project}]` + dedupBlock + conversation;

  let text: string;
  let usage: TokenUsage;

  if (ctx?.modelRegistry) {
    // Use pi-ai's completeSimple with cheapest available model
    const { completeSimple } = await import("@mariozechner/pi-ai");
    const piModel = pickModel(ctx, config);
    const apiKey = await ctx.modelRegistry.getApiKey(piModel);
    if (!apiKey) throw new Error(`No API key for ${piModel.provider}/${piModel.id}`);

    const result = await completeSimple(piModel, {
      messages: [{ role: "user" as const, content: [{ type: "text" as const, text: fullPrompt }], timestamp: Date.now() }],
    }, { apiKey });

    text = result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
    usage = {
      inputTokens: result.usage?.input ?? 0,
      outputTokens: result.usage?.output ?? 0,
      totalTokens: result.usage?.totalTokens ?? ((result.usage?.input ?? 0) + (result.usage?.output ?? 0)),
    };
  } else {
    // Fallback: use ai-sdk with config-based model
    const { generateText } = require("ai");
    const model = createModel(config);
    const result = await generateText({
      model,
      prompt: fullPrompt,
      maxTokens: undefined,
      temperature: 0.1,
    });
    text = result.text;
    const rawUsage = result.usage;
    usage = {
      inputTokens: rawUsage?.inputTokens ?? 0,
      outputTokens: rawUsage?.outputTokens ?? 0,
      totalTokens: rawUsage?.totalTokens ?? 0,
    };
  }

  log(`TOKENS session=${sessionId} in=${usage.inputTokens} out=${usage.outputTokens} total=${usage.totalTokens}`);

  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr: any) {
    // Attempt to salvage truncated JSON: find last complete object in array
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace > 0) {
      const salvaged = cleaned.slice(0, lastBrace + 1) + "]";
      try {
        parsed = JSON.parse(salvaged);
        log(`WARN [parse] Salvaged truncated JSON for session=${sessionId}`);
      } catch {
        log(`ERROR [parse] Unsalvageable JSON for session=${sessionId}: ${parseErr.message}`);
        log(`ERROR [parse] Raw text (first 500 chars): ${cleaned.slice(0, 500)}`);
        trackTokenUsage(sessionId, project, usage, 0);
        return { savedCount: 0, usage };
      }
    } else {
      log(`ERROR [parse] No JSON to salvage for session=${sessionId}: ${parseErr.message}`);
      trackTokenUsage(sessionId, project, usage, 0);
      return { savedCount: 0, usage };
    }
  }
  const results = Array.isArray(parsed) ? parsed : [parsed];
  const meaningful = results.filter((r: any) => r.classification !== "none");

  if (meaningful.length === 0) {
    log(`SKIP session=${sessionId} project=${project} (nothing to save)`);
    trackTokenUsage(sessionId, project, usage, 0);
    return { savedCount: 0, usage };
  }

  let savedCount = 0;
  for (const result of meaningful) {
    const { classification, repo, topic, category } = result;
    let { body } = result;
    const targetRepo = repo || project;

    if (!body) {
      const { facts, summary } = result;
      const factLines = Array.isArray(facts) && facts.length > 0 ? facts.map((f: string) => `- ${f}`).join("\n") : "";
      body = [summary, factLines].filter(Boolean).join("\n");
    }

    if (classification !== "task") {
      const qmd = qmdDedup(topic, body, targetRepo);
      if (qmd.action === "skip") {
        log(`QMD-DEDUP skipped "${topic}" repo=${targetRepo} reason=${"reason" in qmd ? qmd.reason : ""}`);
        continue;
      }
      if (qmd.links.length > 0) {
        body += `\n\n**See also**: ${qmd.links.join(", ")}`;
      }
    }

    const savedTo = saveInsight(config, targetRepo, classification, topic, body, category);
    log(`SAVED session=${sessionId} class=${classification} cat=${category || "general"} repo=${targetRepo} topic="${topic}" file=${savedTo || "dedup"}`);
    if (savedTo) savedCount++;
  }

  trackTokenUsage(sessionId, project, usage, savedCount);
  return { savedCount, usage };
}

// ─── Token Stats tracking ─────────────────────────────────────────────────

const TOKEN_STATS_FILE = join(LOG_DIR, "token-stats.jsonl");

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

function trackTokenUsage(sessionId: string, project: string, usage: TokenUsage, savedCount: number) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    const entry = JSON.stringify({
      timestamp: ts,
      session: sessionId,
      project,
      input_tokens: usage.inputTokens ?? 0,
      output_tokens: usage.outputTokens ?? 0,
      total_tokens: usage.totalTokens ?? 0,
      saved_count: savedCount,
    });
    appendFileSync(TOKEN_STATS_FILE, entry + "\n");
  } catch {}
}

interface DayStats {
  date: string;
  sessions: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  savedCount: number;
}

function loadTokenStatsByDay(days: number = 10): DayStats[] {
  try {
    if (!existsSync(TOKEN_STATS_FILE)) return [];
    const lines = readFileSync(TOKEN_STATS_FILE, "utf8").trim().split("\n").filter(Boolean);

    const byDay = new Map<string, DayStats>();
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const date = (e.timestamp ?? "").slice(0, 10); // "2026-03-19"
        if (!date || date.length !== 10) continue;
        let d = byDay.get(date);
        if (!d) {
          d = { date, sessions: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, savedCount: 0 };
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

// ─── QMD Stats tracking ───────────────────────────────────────────────────

const QMD_STATS_FILE = join(LOG_DIR, "qmd-stats.jsonl");
const QMD_STATS_LOG = join(LOG_DIR, "qmd-stats.log");

function trackQmdUsage(toolName: string, toolInput: Record<string, any>, resultText: string) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const query = toolInput.query ?? toolInput.file ?? "n/a";
    const resultCount = (resultText.match(/docid|^##|^---$/gm) || []).length || (resultText.length > 10 ? 1 : 0);
    const zeroResults = resultCount === 0;
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);

    const entry = JSON.stringify({
      timestamp: ts,
      tool: toolName,
      query,
      result_count: resultCount,
      zero_results: zeroResults,
      raw_input: toolInput,
    });
    appendFileSync(QMD_STATS_FILE, entry + "\n");

    const logLine = zeroResults
      ? `${ts} ZERO_RESULTS tool=${toolName} query=${query}`
      : `${ts} OK tool=${toolName} query=${query} results=${resultCount}`;
    appendFileSync(QMD_STATS_LOG, logLine + "\n");
  } catch {}
}

// ─── Extension ─────────────────────────────────────────────────────────────

// ─── Path exclusion ────────────────────────────────────────────────────────

/**
 * Check if cwd matches any exclude_paths glob patterns from config.
 * Patterns are comma-separated in memory-keeper.local.md frontmatter:
 *   exclude_paths: ~/Documents/git/mil/tasks/**, <any>/work-<name>/<any>
 *
 * Supports: *, **, ? wildcards. Paths are normalized before matching.
 */
function isExcluded(cwd: string, config: Config): boolean {
  const raw = config.exclude_paths;
  if (!raw) return false;
  const patterns = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (patterns.length === 0) return false;
  const normalizedCwd = cwd.replace(/\\/g, "/");
  return patterns.some((pattern) => globMatch(normalizedCwd, pattern.replace(/\\/g, "/")));
}

/** Minimal glob matcher supporting *, **, and ? */
function globMatch(str: string, pattern: string): boolean {
  const specialChars = /[.+^${}()|[\]\\]/g;
  // Convert glob to regex
  let re = "^";
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      // ** matches any path segments
      re += ".*";
      i += 2;
      if (pattern[i] === "/") i++; // skip trailing slash after **
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

export default function (pi: ExtensionAPI) {
  let workActive = false; // set on session start, checked by all handlers

  function wfTaskId(task: string): string {
    return `memory-keeper:${task}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  }

  function wfEvent(event: string, details?: string): void {
    pi.events.emit(PLUGIN_WORKFLOW_EVENTS.EVENT, {
      plugin: "memory-keeper",
      event,
      details,
    } satisfies PluginWorkflowEventPayload);
  }

  const TOOL_GUIDE = `
# Memory Keeper Tool Translation

Skills reference MCP tool names. Use these native tools instead:

| Skill references | Use tool |
|---|---|
| mcp__qmd__search | qmd_search |
| mcp__qmd__deep_search | qmd_query |
| mcp__qmd__vector_search | qmd_query |
| mcp__qmd__get | qmd_get |
| mcp__qmd__multi_get | qmd_get (call per file) |

When a skill says "use mcp__firecrawl__*", use bash with curl or any available web search tool instead.
`;

  // --- Session Start: inject project context + QMD guide ---
  pi.on("before_agent_start", async (event, ctx) => {
    const config = loadConfig();
    workActive = isExcluded(ctx.cwd, config);
    if (workActive) {
      log(`INFO [pi] cwd excluded by exclude_paths — memory-keeper disabled for ${ctx.cwd}`);
      return;
    }

    if (!config.insights_root) return;

    let extra = TOOL_GUIDE;

    const context = findProjectSummary(config.insights_root, ctx.cwd);
    if (context) {
      extra += "\n# Context Knowledge Base\n\n" + context + "\n";
      log(`INFO [pi] Injecting context for cwd=${ctx.cwd} (${context.length} chars)`);
    }

    return {
      systemPrompt: event.systemPrompt + "\n" + extra,
    };
  });

  // --- Cron: periodic async insight extraction ---

  async function cronTick(ctx: any) {
    if (workActive) return;
    if (cronProcessing) {
      log("INFO [cron] Skipping tick — previous run still active");
      return;
    }
    cronProcessing = true;
    let taskId: string | null = null;

    try {
      const config = loadConfig();
      if (!config.insights_root) return;

      const entries = ctx.sessionManager.getBranch();
      if (lastProcessedCursor >= entries.length) return; // nothing new

      const { text, newCursor } = extractConversationSlice(entries, lastProcessedCursor);
      if (!text || text.length < MIN_CONVERSATION_LENGTH) {
        log(`INFO [cron] Slice too short (${text.length} chars), skipping`);
        return;
      }

      const project = detectProject(ctx.cwd);
      const sessionId = "pi-cron-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      taskId = wfTaskId("cron-process");

      log(`INFO [cron] Processing entries [${lastProcessedCursor}..${newCursor}) project=${project} conv=${text.length} chars`);
      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.START, {
        plugin: "memory-keeper",
        taskId,
        task: "cron-process",
        details: `entries [${lastProcessedCursor}..${newCursor})`,
      } satisfies PluginWorkflowStartPayload);

      const result = await processSessionDirect(config, project, sessionId, text, ctx);
      lastProcessedCursor = newCursor;
      pi.appendEntry(CURSOR_ENTRY_TYPE, { cursor: newCursor });

      const { savedCount, usage } = result;
      log(`INFO [cron] Done session=${sessionId} saved=${savedCount} tokens=${usage.totalTokens} (in=${usage.inputTokens} out=${usage.outputTokens})`);
      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
        plugin: "memory-keeper",
        taskId,
        status: "ok",
        details: `saved=${savedCount} tokens=${usage.totalTokens}`,
      } satisfies PluginWorkflowEndPayload);
    } catch (err: any) {
      log(`ERROR [cron] err=${err.message}`);
      if (taskId) {
        pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
          plugin: "memory-keeper",
          taskId,
          status: "error",
          details: err?.message || "unknown-error",
        } satisfies PluginWorkflowEndPayload);
      }
      wfEvent("cron:error", err?.message || "unknown-error");
    } finally {
      cronProcessing = false;
    }
  }

  // --- Session Shutdown: flush remaining entries, stop cron ---
  pi.on("session_shutdown", async (_event, ctx) => {
    // Stop the cron timer
    if (cronTimer) {
      clearInterval(cronTimer);
      cronTimer = null;
    }

    if (workActive) return;

    const config = loadConfig();
    if (!config.insights_root) return;

    rotateLog();

    const entries = ctx.sessionManager.getBranch();
    if (lastProcessedCursor >= entries.length) {
      log("INFO [pi] Shutdown — nothing new since last cron tick");
      return;
    }

    const { text } = extractConversationSlice(entries, lastProcessedCursor);
    if (!text || text.length < MIN_CONVERSATION_LENGTH) {
      log("INFO [pi] Shutdown — remaining slice too short, skipping");
      return;
    }

    const project = detectProject(ctx.cwd);
    const sessionId = "pi-shutdown-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const taskId = wfTaskId("shutdown-flush");

    log(`INFO [pi] Shutdown flush entries [${lastProcessedCursor}..${entries.length}) project=${project} conv=${text.length} chars`);

    process.stdout.write(`\r\n⏳ memory-keeper: saving insights for [${project}]...\r\n`);
    pi.events.emit(PLUGIN_WORKFLOW_EVENTS.START, {
      plugin: "memory-keeper",
      taskId,
      task: "shutdown-flush",
      details: `entries [${lastProcessedCursor}..${entries.length})`,
    } satisfies PluginWorkflowStartPayload);

    try {
      const result = await processSessionDirect(config, project, sessionId, text, ctx);
      const { savedCount, usage } = result;
      lastProcessedCursor = entries.length;
      pi.appendEntry(CURSOR_ENTRY_TYPE, { cursor: lastProcessedCursor });
      const summary = savedCount > 0 ? `${savedCount} insight(s) saved` : `nothing to save`;
      process.stdout.write(`✓ memory-keeper: ${summary} (${usage.totalTokens} tokens)\r\n`);
      log(`INFO [pi] Done session=${sessionId} saved=${savedCount} tokens=${usage.totalTokens} (in=${usage.inputTokens} out=${usage.outputTokens})`);
      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
        plugin: "memory-keeper",
        taskId,
        status: "ok",
        details: `saved=${savedCount} tokens=${usage.totalTokens}`,
      } satisfies PluginWorkflowEndPayload);
    } catch (err: any) {
      process.stdout.write(`✗ memory-keeper: failed — ${err.message}\r\n`);
      log(`ERROR [pi] session=${sessionId} err=${err.message}`);
      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
        plugin: "memory-keeper",
        taskId,
        status: "error",
        details: err?.message || "unknown-error",
      } satisfies PluginWorkflowEndPayload);
    }
  });

  // --- Command: /memory:stats (show per-day token usage, last 10 days) ---
  pi.registerCommand("memory:stats", {
    description: "Show per-day token usage for insight capture (last 10 days). Pass a date (YYYY-MM-DD) or day index (1-10) to see details.",
    handler: async (args, ctx) => {
      const days = loadTokenStatsByDay(10);
      if (days.length === 0) {
        ctx.ui.notify("No token stats yet — token-stats.jsonl not found or empty", "info");
        return;
      }

      const arg = (args || "").trim();

      // If user passed a date or index, show that day's detail
      let detailDay: DayStats | undefined;
      if (arg) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
          detailDay = days.find((d) => d.date === arg);
        } else if (/^\d+$/.test(arg)) {
          const idx = parseInt(arg, 10) - 1;
          if (idx >= 0 && idx < days.length) detailDay = days[idx];
        }
        if (detailDay) {
          const msg =
            `📅 ${detailDay.date}\n` +
            `  Sessions     : ${detailDay.sessions}\n` +
            `  Total tokens : ${detailDay.totalTokens.toLocaleString()}\n` +
            `  Input tokens : ${detailDay.inputTokens.toLocaleString()}\n` +
            `  Output tokens: ${detailDay.outputTokens.toLocaleString()}\n` +
            `  Insights saved: ${detailDay.savedCount}`;
          ctx.ui.notify(msg, "info");
          return;
        }
        ctx.ui.notify(`Day not found: "${arg}". Use a date (YYYY-MM-DD) or index (1-${days.length}).`, "error");
        return;
      }

      // Default: show table of last 10 days, latest first
      const totals = days.reduce(
        (acc, d) => {
          acc.sessions += d.sessions;
          acc.totalTokens += d.totalTokens;
          acc.savedCount += d.savedCount;
          return acc;
        },
        { sessions: 0, totalTokens: 0, savedCount: 0 }
      );

      const header = `  #  Date         Sessions   Tokens  Insights`;
      const sep    = `  —— ———————————— ———————— ———————— ————————`;
      const rows = days.map((d, i) => {
        const idx = String(i + 1).padStart(2);
        const sess = String(d.sessions).padStart(8);
        const tok = d.totalTokens.toLocaleString().padStart(8);
        const ins = String(d.savedCount).padStart(8);
        const marker = i === 0 ? " ◀" : "";
        return `  ${idx} ${d.date} ${sess} ${tok} ${ins}${marker}`;
      });

      const msg =
        `Memory Keeper — last ${days.length} day(s)\n\n` +
        header + "\n" + sep + "\n" +
        rows.join("\n") + "\n" +
        sep + "\n" +
        `     Total       ${String(totals.sessions).padStart(8)} ${totals.totalTokens.toLocaleString().padStart(8)} ${String(totals.savedCount).padStart(8)}\n\n` +
        `Use /memory:stats <date|index> for details`;
      ctx.ui.notify(msg, "info");
    },
  });

  // --- QMD tool post-use stats tracking ---
  pi.on("tool_result", async (event, _ctx) => {
    const name = event.toolName;
    if (name === "qmd_search" || name === "qmd_query" || name === "qmd_get") {
      const output = event.content?.[0]?.type === "text" ? (event.content[0] as any).text : "";
      trackQmdUsage(name, event.input || {}, output);
    }
  });

  // --- Command: /context <subcommand> ---
  pi.registerCommand("context", {
    description: "Memory keeper — find, save, check, research, done, scan. Use /memory:process to trigger now.",
    handler: async (args, ctx) => {
      if (!args || !args.trim()) {
        ctx.ui.notify("Usage: /context <find|save|check|research|done|scan> [args]\nProcess now: /memory:process", "info");
        return;
      }

      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0];
      const rest = parts.slice(1).join(" ");

      const validSubcommands = ["find", "save", "check", "research", "done", "scan"];
      if (!validSubcommands.includes(subcommand)) {
        ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use: find, save, check, research, done, scan`, "error");
        return;
      }

      const skillInvocation = `/skill:context-${subcommand}${rest ? " " + rest : ""}`;
      pi.sendUserMessage(skillInvocation);
    },
  });

  // --- Command: /memory:process (trigger incremental processing now) ---
  pi.registerCommand("memory:process", {
    description: "Process unprocessed conversation now (incremental, same as cron tick)",
    handler: async (_args, ctx) => {
      const config = loadConfig();
      if (!config.insights_root) {
        ctx.ui.notify("No insights_root configured in ~/.claude/memory-keeper.local.md", "error");
        return;
      }

      const entries = ctx.sessionManager.getBranch();
      if (lastProcessedCursor >= entries.length) {
        ctx.ui.notify("Nothing new to process since last run", "info");
        return;
      }

      const { text, newCursor } = extractConversationSlice(entries, lastProcessedCursor);
      if (!text || text.length < 50) {
        ctx.ui.notify("New conversation too short — nothing to process", "info");
        return;
      }

      const project = detectProject(ctx.cwd);
      const sessionId = "pi-manual-" + Date.now();
      const taskId = wfTaskId("manual-process");

      ctx.ui.notify(`Processing entries [${lastProcessedCursor}..${newCursor}) for project: ${project}...`, "info");
      pi.events.emit(PLUGIN_WORKFLOW_EVENTS.START, {
        plugin: "memory-keeper",
        taskId,
        task: "manual-process",
        details: `entries [${lastProcessedCursor}..${newCursor})`,
      } satisfies PluginWorkflowStartPayload);

      try {
        const result = await processSessionDirect(config, project, sessionId, text, ctx);
        lastProcessedCursor = newCursor;
        pi.appendEntry(CURSOR_ENTRY_TYPE, { cursor: newCursor });
        const { savedCount, usage } = result;
        const msg =
          savedCount > 0
            ? `Done — ${savedCount} insight(s) saved · ${usage.totalTokens} tokens (in=${usage.inputTokens} out=${usage.outputTokens})`
            : `Done — nothing to save · ${usage.totalTokens} tokens used`;
        pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
          plugin: "memory-keeper",
          taskId,
          status: "ok",
          details: `saved=${savedCount} tokens=${usage.totalTokens}`,
        } satisfies PluginWorkflowEndPayload);
        ctx.ui.notify(msg, "info");
      } catch (err: any) {
        pi.events.emit(PLUGIN_WORKFLOW_EVENTS.END, {
          plugin: "memory-keeper",
          taskId,
          status: "error",
          details: err?.message || "unknown-error",
        } satisfies PluginWorkflowEndPayload);
        ctx.ui.notify(`Failed: ${err.message}`, "error");
      }
    },
  });

  // --- QMD tools (registered as native pi tools) ---

  pi.registerTool({
    name: "qmd_search",
    label: "QMD Search",
    description: "Keyword search (BM25) across indexed markdown collections. Use for finding insights, notes, and documentation by keyword.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      collection: Type.Optional(Type.String({ description: 'Collection name (e.g. "ctx", "z-core"). Default: all.' })),
      n: Type.Optional(Type.Number({ description: "Number of results (default: 5)" })),
    }),
    async execute(_id, params, signal) {
      const args = ["search", params.query];
      if (params.collection) args.push("-c", params.collection);
      if (params.n) args.push("-n", String(params.n));
      const result = await pi.exec("qmd", args, { signal, timeout: 10000 });
      const output = (result.stdout || "") + (result.stderr || "");
      return {
        content: [{ type: "text", text: output || "(no results)" }],
        details: { exitCode: result.code, output } as QmdDetails,
      };
    },
    renderCall(args, theme) {
      return renderQmdCall("qmd_search", args, theme);
    },
    renderResult(result, options, theme) {
      return renderQmdResult(result, options, theme);
    },
  });

  pi.registerTool({
    name: "qmd_query",
    label: "QMD Deep Search",
    description: "Semantic search with query expansion and reranking. Use when keyword search returns few results or for conceptual queries.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      collection: Type.Optional(Type.String({ description: "Collection name" })),
      n: Type.Optional(Type.Number({ description: "Number of results (default: 5)" })),
    }),
    async execute(_id, params, signal) {
      const args = ["query", params.query];
      if (params.collection) args.push("-c", params.collection);
      if (params.n) args.push("-n", String(params.n));
      const result = await pi.exec("qmd", args, { signal, timeout: 30000 });
      const output = (result.stdout || "") + (result.stderr || "");
      return {
        content: [{ type: "text", text: output || "(no results)" }],
        details: { exitCode: result.code, output } as QmdDetails,
      };
    },
    renderCall(args, theme) {
      return renderQmdCall("qmd_query", args, theme);
    },
    renderResult(result, options, theme) {
      return renderQmdResult(result, options, theme);
    },
  });

  pi.registerTool({
    name: "qmd_get",
    label: "QMD Get",
    description: "Retrieve full document content by path from QMD index.",
    parameters: Type.Object({
      file: Type.String({ description: "Document path (e.g. ctx/project/insights.md)" }),
      from: Type.Optional(Type.Number({ description: "Start from line number" })),
      lines: Type.Optional(Type.Number({ description: "Max lines to return" })),
    }),
    async execute(_id, params, signal) {
      const args = ["get", params.file];
      if (params.from) args.push("--from", String(params.from));
      if (params.lines) args.push("-l", String(params.lines));
      const result = await pi.exec("qmd", args, { signal, timeout: 10000 });
      const output = (result.stdout || "") + (result.stderr || "");
      return {
        content: [{ type: "text", text: output || "(empty)" }],
        details: { exitCode: result.code, output } as QmdDetails,
      };
    },
    renderCall(args, theme) {
      return renderQmdCall("qmd_get", args, theme);
    },
    renderResult(result, options, theme) {
      return renderQmdResult(result, options, theme);
    },
  });

  // --- Startup: reset cursor, start cron ---
  pi.on("session_start", async (_event, ctx) => {
    if (workActive) return;

    const config = loadConfig();
    if (!config.insights_root) {
      ctx.ui.notify("memory-keeper: no insights_root in ~/.claude/memory-keeper.local.md", "warning");
      return;
    }

    // Restore cursor from session (survives restart/reload), or start fresh
    const entries = ctx.sessionManager.getEntries();
    lastProcessedCursor = restoreCursor(entries);
    cronProcessing = false;
    log(`INFO [pi] Restored cursor=${lastProcessedCursor} from ${entries.length} session entries`);

    // Stop any existing timer (e.g. after /reload)
    if (cronTimer) {
      clearInterval(cronTimer);
      cronTimer = null;
    }

    // Start cron — fires every CRON_INTERVAL_MS, processes new entries async
    cronTimer = setInterval(() => {
      cronTick(ctx).catch((err) => log(`ERROR [cron] Unhandled: ${err.message}`));
    }, CRON_INTERVAL_MS);

    // Don't block pi exit if only the timer is keeping Node alive
    if (cronTimer && typeof cronTimer === "object" && "unref" in cronTimer) {
      cronTimer.unref();
    }

    log(`INFO [pi] memory-keeper loaded, cron every ${CRON_INTERVAL_MS / 1000}s, insights_root=${config.insights_root}`);
  });
}

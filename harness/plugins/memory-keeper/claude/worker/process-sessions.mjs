#!/usr/bin/env node
// Background worker: reads pending sessions from SQLite, classifies via LLM,
// saves insights to the filesystem. Runs detached from the Stop hook.

import { readFileSync, appendFileSync, mkdirSync, existsSync, writeFileSync, unlinkSync, statSync, renameSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { generateText } from "ai";
import { getDb } from "../lib/db.mjs";
import { loadConfig } from "../lib/config.mjs";
import { createModel } from "../lib/llm.mjs";
import { CLASSIFY_PROMPT } from "./prompts.mjs";

const LOCK_FILE = join(homedir(), ".claude", "debug", "memory-keeper-worker.lock");
const LOG_DIR = join(homedir(), ".claude", "debug");
const LOG_FILE = join(LOG_DIR, "memory-keeper-worker.log");
const MAX_LOG_SIZE = 512 * 1024; // 512 KB
const MAX_LOG_FILES = 3;         // keep .log, .log.1, .log.2

export function rotateLog() {
  try {
    if (!existsSync(LOG_FILE)) return;
    const { size } = statSync(LOG_FILE);
    if (size < MAX_LOG_SIZE) return;

    // Shift old files: .log.2 → delete, .log.1 → .log.2, .log → .log.1
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const older = `${LOG_FILE}.${i}`;
      const newer = i === 1 ? LOG_FILE : `${LOG_FILE}.${i - 1}`;
      if (existsSync(newer)) {
        if (i === MAX_LOG_FILES - 1 && existsSync(older)) unlinkSync(older);
        renameSync(newer, older);
      }
    }
    // Start fresh
    writeFileSync(LOG_FILE, "");
  } catch {}
}

export function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${ts} ${msg}\n`);
  } catch {}
}

export function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    try {
      const lockTime = parseInt(readFileSync(LOCK_FILE, "utf8"), 10);
      if (Date.now() - lockTime < 5 * 60 * 1000) return false;
    } catch {}
  }
  writeFileSync(LOCK_FILE, String(Date.now()));
  return true;
}

export function releaseLock() {
  try { unlinkSync(LOCK_FILE); } catch {}
}

// Re-export for backward compatibility (tests import from here)
export { CLASSIFY_PROMPT } from "./prompts.mjs";

export function readActiveTask(insightsRoot) {
  const pendingPath = join(insightsRoot, "_tasks", "pending.md");
  if (!existsSync(pendingPath)) return null;
  const content = readFileSync(pendingPath, "utf8");
  const match = content.match(/## (.+)\n- \*\*Status\*\*: active/);
  if (!match) return null;
  const title = match[1];
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  return { title, slug };
}

/**
 * Extract h2 headings from a markdown file (without the "## " prefix and " — date" suffix).
 */
export function extractHeadings(filePath) {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf8");
  const raw = content.match(/^## .+/gm) || [];
  return raw.map((h) => h.replace(/^## /, "").replace(/ — \d{4}-\d{2}-\d{2}.*$/, "").trim());
}

/**
 * Compute word-overlap ratio between two strings (Jaccard on significant words).
 */
function wordOverlap(a, b) {
  const stopwords = new Set(["a", "an", "the", "is", "in", "of", "to", "for", "and", "or", "on", "with", "not", "vs"]);
  const words = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !stopwords.has(w)));
  const setA = words(a);
  const setB = words(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  return intersection / Math.min(setA.size, setB.size);
}

export function deduplicateCheck(filePath, topic) {
  const headings = extractHeadings(filePath);
  if (headings.length === 0) return false;
  const topicLower = topic.toLowerCase();
  for (const h of headings) {
    const hLower = h.toLowerCase();
    // Exact substring match
    if (hLower.includes(topicLower) || topicLower.includes(hLower)) return true;
    // Word-overlap: >70% of significant words shared = duplicate
    if (wordOverlap(topic, h) >= 0.7) return true;
  }
  return false;
}

/**
 * Search QMD for similar existing entries. Returns array of { project, file, score, title }.
 */
export function qmdSearch(query, collection = "ctx", n = 3, minScore = 0.5) {
  try {
    // Use only the first 200 chars as search query, strip markdown
    const q = query.replace(/[`#*|[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    const out = execSync(
      `qmd search ${JSON.stringify(q)} -c ${collection} -n ${n} --min-score ${minScore} --json`,
      { encoding: "utf8", timeout: 5000 }
    );
    const results = JSON.parse(out);
    return results.map((r) => {
      // qmd://ctx/insights/<project>/insights.md → extract project
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

/**
 * Post-process an entry via QMD dedup. Returns:
 *   { action: "skip" }                — same project, duplicate
 *   { action: "save", links: [...] }  — save with optional wiki links to other projects
 */
export function qmdDedup(topic, summary, targetProject) {
  const query = summary || topic;
  const hits = qmdSearch(query);

  if (hits.length === 0) return { action: "save", links: [] };

  const sameProject = hits.filter((h) => h.project === targetProject && h.score >= 0.7);
  const otherProjects = hits.filter((h) => h.project !== targetProject && h.project !== "_tasks" && h.score >= 0.6);

  if (sameProject.length > 0) {
    return { action: "skip", reason: `QMD match in ${targetProject}: "${sameProject[0].title}" (${sameProject[0].score})` };
  }

  // Collect unique cross-project links
  const seen = new Set();
  const links = otherProjects
    .filter((h) => { if (seen.has(h.project)) return false; seen.add(h.project); return true; })
    .map((h) => `[[${h.file}|${h.title}]]`);

  return { action: "save", links };
}

export function saveInsight(config, project, classification, topic, body) {
  const insightsRoot = config.insights_root;
  const now = new Date().toISOString().replace("T", " ").slice(0, 16);
  const entry = `## ${topic} — ${now}\n${body}\n`;

  if (classification === "insight") {
    const activeTask = readActiveTask(insightsRoot);
    let targetFile;

    if (activeTask) {
      const taskDir = join(insightsRoot, "_tasks", activeTask.slug);
      mkdirSync(taskDir, { recursive: true });
      targetFile = join(taskDir, "notes.md");
    } else {
      const projectDir = join(insightsRoot, project);
      mkdirSync(projectDir, { recursive: true });
      targetFile = join(projectDir, "insights.md");
    }

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
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const taskEntry = `## ${topic}\n- **Status**: active\n- **Repos**: ${project}\n- **Captured**: ${now}\n${body}\n`;
    if (deduplicateCheck(targetFile, topic)) {
      log(`DEDUP skipped task "${topic}"`);
      return null;
    }
    appendFileSync(targetFile, "\n" + taskEntry);
    mkdirSync(join(tasksDir, slug), { recursive: true });
    return targetFile;
  }

  if (classification === "agent_edit") {
    const configDir = join(insightsRoot, "claude-config");
    mkdirSync(configDir, { recursive: true });
    const targetFile = join(configDir, "behavior.md");
    const editEntry = `## ${topic} — ${now}\n${body}\n`;
    if (deduplicateCheck(targetFile, topic)) {
      log(`DEDUP skipped agent_edit "${topic}"`);
      return null;
    }
    appendFileSync(targetFile, "\n" + editEntry);
    return targetFile;
  }

  return null;
}

const MAX_RETRIES = 5;
const STATS_FILE = join(LOG_DIR, "memory-keeper-stats.json");

export function writeStats(db) {
  try {
    const rows = db.prepare("SELECT status, COUNT(*) as count FROM sessions GROUP BY status").all();
    const stats = { updated_at: new Date().toISOString() };
    for (const r of rows) stats[r.status] = r.count;
    stats.total = Object.values(stats).reduce((s, v) => (typeof v === "number" ? s + v : s), 0);
    writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2) + "\n");
  } catch {}
}

/**
 * Process a single session. Accepts a `generate` function for testability.
 * Default: Vercel AI SDK `generateText`.
 */
export async function processSession(db, session, model, config, { generate = generateText } = {}) {
  const { id, session_id, project, conversation, retry_count = 0 } = session;

  // Drop after MAX_RETRIES
  if (retry_count >= MAX_RETRIES) {
    db.prepare(
      "UPDATE sessions SET status = 'dropped', error_message = ?, processed_at = datetime('now') WHERE id = ?"
    ).run(`Dropped after ${MAX_RETRIES} failed attempts. Last error: ${session.error_message || "unknown"}`, id);
    log(`DROPPED session=${session_id} project=${project} retries=${retry_count}`);
    return;
  }

  db.prepare("UPDATE sessions SET status = 'processing' WHERE id = ?").run(id);

  try {
    // Collect existing headings from all target files for LLM-side dedup
    const insightsRoot = config.insights_root;
    const existingTopics = [
      ...extractHeadings(join(insightsRoot, project, "insights.md")),
      ...extractHeadings(join(insightsRoot, "claude-config", "behavior.md")),
      ...extractHeadings(join(insightsRoot, "_tasks", "pending.md")),
    ];
    const dedupBlock = existingTopics.length > 0
      ? `\n[Existing topics — do NOT duplicate these]:\n${existingTopics.map((t) => `- ${t}`).join("\n")}\n\n`
      : "\n";

    const { text } = await generate({
      model,
      prompt: CLASSIFY_PROMPT + `[Project: ${project}]` + dedupBlock + conversation,
      maxTokens: 500,
      temperature: 0.1,
    });

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Support both array (new) and single object (legacy) responses
    const results = Array.isArray(parsed) ? parsed : [parsed];

    // Filter out "none" entries
    const meaningful = results.filter((r) => r.classification !== "none");
    if (meaningful.length === 0) {
      db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
      log(`SKIP session=${session_id} project=${project} (deleted)`);
      return;
    }

    for (const result of meaningful) {
      const { classification, repo, topic } = result;
      let { body } = result;
      const targetRepo = repo || project;

      // Fallback: support legacy facts/summary format
      if (!body) {
        const { facts, summary } = result;
        const factLines = Array.isArray(facts) && facts.length > 0 ? facts.map((f) => `- ${f}`).join("\n") : "";
        body = [summary, factLines].filter(Boolean).join("\n");
      }

      // QMD post-processing dedup (skip for tasks — they're always new intentions)
      if (classification !== "task") {
        const qmd = qmdDedup(topic, body, targetRepo);
        if (qmd.action === "skip") {
          log(`QMD-DEDUP skipped "${topic}" repo=${targetRepo} reason=${qmd.reason}`);
          continue;
        }
        // Append wiki links if related entries exist in other projects
        if (qmd.links.length > 0) {
          body += `\n\n**See also**: ${qmd.links.join(", ")}`;
        }
      }

      const savedTo = saveInsight(config, targetRepo, classification, topic, body);
      log(`SAVED session=${session_id} class=${classification} repo=${targetRepo} topic="${topic}" file=${savedTo || "dedup"}`);
    }

    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    log(`DONE session=${session_id} entries=${meaningful.length} (deleted)`);
  } catch (err) {
    const newRetry = retry_count + 1;
    const errMsg = String(err.message || err);
    const status = newRetry >= MAX_RETRIES ? "dropped" : "pending";

    db.prepare(
      "UPDATE sessions SET status = ?, error_message = ?, retry_count = ?, processed_at = datetime('now') WHERE id = ?"
    ).run(status, errMsg, newRetry, id);

    if (status === "dropped") {
      log(`DROPPED session=${session_id} project=${project} retries=${newRetry} err=${errMsg}`);
    } else {
      log(`RETRY ${newRetry}/${MAX_RETRIES} session=${session_id} err=${errMsg}`);
    }
  }
}

async function main() {
  if (!acquireLock()) {
    log("LOCK another worker is running, exiting");
    process.exit(0);
  }

  rotateLog();

  try {
    const config = loadConfig();
    if (!config.insights_root) {
      log("SKIP no insights_root configured");
      return;
    }

    const model = createModel(config);
    const db = getDb();

    try {
      const pending = db
        .prepare("SELECT * FROM sessions WHERE status IN ('pending', 'error') AND (retry_count < ? OR retry_count IS NULL) ORDER BY created_at ASC LIMIT 20")
        .all(MAX_RETRIES);

      if (pending.length === 0) {
        log("OK no pending sessions");
        return;
      }

      log(`PROCESSING ${pending.length} pending sessions`);

      for (const session of pending) {
        await processSession(db, session, model, config);
      }

      writeStats(db);
      log("DONE all pending sessions processed");
    } finally {
      db.close();
    }
  } catch (err) {
    log(`FATAL ${err.message || err}`);
  } finally {
    releaseLock();
  }
}

// Only run main() when executed directly, not when imported for tests
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  main();
}

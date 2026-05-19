// Pure helpers used by the daemon's event processor.
// (The legacy one-shot worker `main()` was removed when the daemon was introduced.)

import { readFileSync, appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

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

export function extractHeadings(filePath) {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, "utf8");
  const raw = content.match(/^## .+/gm) || [];
  return raw.map((h) => h.replace(/^## /, "").replace(/ — \d{4}-\d{2}-\d{2}.*$/, "").trim());
}

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
    if (hLower.includes(topicLower) || topicLower.includes(hLower)) return true;
    if (wordOverlap(topic, h) >= 0.7) return true;
  }
  return false;
}

export function qmdSearch(query, collection = "ctx", n = 3, minScore = 0.5) {
  try {
    const q = query.replace(/[`#*|[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    const out = execSync(
      `qmd search ${JSON.stringify(q)} -c ${collection} -n ${n} --min-score ${minScore} --json`,
      { encoding: "utf8", timeout: 5000 }
    );
    const results = JSON.parse(out);
    return results.map((r) => {
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

export function qmdDedup(topic, summary, targetProject) {
  const query = summary || topic;
  const hits = qmdSearch(query);
  if (hits.length === 0) return { action: "save", links: [] };

  const sameProject = hits.filter((h) => h.project === targetProject && h.score >= 0.7);
  const otherProjects = hits.filter((h) => h.project !== targetProject && h.project !== "_tasks" && h.score >= 0.6);

  if (sameProject.length > 0) {
    return { action: "skip", reason: `QMD match in ${targetProject}: "${sameProject[0].title}" (${sameProject[0].score})` };
  }

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
    if (deduplicateCheck(targetFile, topic)) return null;
    appendFileSync(targetFile, "\n" + entry);
    return targetFile;
  }

  if (classification === "task") {
    const tasksDir = join(insightsRoot, "_tasks");
    mkdirSync(tasksDir, { recursive: true });
    const targetFile = join(tasksDir, "pending.md");
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const taskEntry = `## ${topic}\n- **Status**: active\n- **Repos**: ${project}\n- **Captured**: ${now}\n${body}\n`;
    if (deduplicateCheck(targetFile, topic)) return null;
    appendFileSync(targetFile, "\n" + taskEntry);
    mkdirSync(join(tasksDir, slug), { recursive: true });
    return targetFile;
  }

  if (classification === "agent_edit") {
    const configDir = join(insightsRoot, "claude-config");
    mkdirSync(configDir, { recursive: true });
    const targetFile = join(configDir, "behavior.md");
    const editEntry = `## ${topic} — ${now}\n${body}\n`;
    if (deduplicateCheck(targetFile, topic)) return null;
    appendFileSync(targetFile, "\n" + editEntry);
    return targetFile;
  }

  return null;
}

/**
 * Repo Context Extension
 *
 * Scans task directory subdirectories for git repos and injects per-repo context
 * into the system prompt: CLAUDE.md descriptions, rules (with glob annotations),
 * and available skills.
 *
 * Designed for multi-repo work tasks where each repo has its own
 * .claude/rules/, .claude/skills/, and CLAUDE.md.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// --- Types ---

interface RepoRef {
  name: string;
  path: string;
}

interface RuleFile {
  /** Relative path within .claude/rules/ */
  name: string;
  /** Full content (without frontmatter) */
  content: string;
  /** Glob patterns from frontmatter, empty if always-active */
  globs: string[];
}

interface SkillInfo {
  name: string;
  description: string;
}

interface RepoContext {
  repo: RepoRef;
  description: string;
  rules: RuleFile[];
  skills: SkillInfo[];
}

// --- Helpers ---

function readFileOr(filePath: string, fallback: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return fallback;
  }
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns { frontmatter: Record<string, any>, body: string }
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, any>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const raw = match[1];
  const body = match[2];
  const frontmatter: Record<string, any> = {};

  for (const line of raw.split("\n")) {
    // Simple key: value parsing (handles strings, arrays in brackets)
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) {
      const key = kv[1];
      let value: any = kv[2].trim();

      // Parse inline array: ["*.go", "test/**"]
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value
          .slice(1, -1)
          .split(",")
          .map((s: string) => s.trim().replace(/^["']|["']$/g, ""))
          .filter((s: string) => s.length > 0);
      } else {
        // Strip quotes
        value = value.replace(/^["']|["']$/g, "");
      }

      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * Extract description from CLAUDE.md:
 * 1. YAML frontmatter `description` field
 * 2. Fallback: first non-heading, non-empty line
 */
function extractDescription(filePath: string): string {
  const content = readFileOr(filePath, "");
  if (!content) return "";

  const { frontmatter, body } = parseFrontmatter(content);
  if (frontmatter.description) {
    return typeof frontmatter.description === "string"
      ? frontmatter.description
      : String(frontmatter.description);
  }

  // Fallback: first non-heading, non-empty line
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
      return trimmed;
    }
  }
  return "";
}

/**
 * Recursively find all .md files in a directory.
 * Returns paths relative to the base directory.
 */
function findMarkdownFiles(dir: string, basePath: string = ""): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(path.join(dir, entry.name), rel));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(rel);
    }
  }
  return results;
}

// --- Core functions ---

/**
 * Discover git repos in task directory subdirectories.
 * Skips dirs starting with _ or . (e.g. _notes, .pi, subtasks).
 */
function discoverRepos(taskDir: string): RepoRef[] {
  if (!fs.existsSync(taskDir)) return [];

  return fs
    .readdirSync(taskDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => !d.name.startsWith("_") && !d.name.startsWith("."))
    .filter((d) => {
      // .git can be a directory (real repo) or file (worktree)
      const gitPath = path.join(taskDir, d.name, ".git");
      return fs.existsSync(gitPath);
    })
    .map((d) => ({
      name: d.name,
      path: path.resolve(taskDir, d.name),
    }));
}

/**
 * Load rules from a repo's .claude/rules/ directory.
 * Parses globs from YAML frontmatter.
 */
function loadRules(repoPath: string): RuleFile[] {
  const rulesDir = path.join(repoPath, ".claude", "rules");
  const files = findMarkdownFiles(rulesDir);

  return files.map((relPath) => {
    const fullPath = path.join(rulesDir, relPath);
    const content = readFileOr(fullPath, "");
    const { frontmatter, body } = parseFrontmatter(content);

    let globs: string[] = [];
    if (frontmatter.globs) {
      globs = Array.isArray(frontmatter.globs)
        ? frontmatter.globs
        : [String(frontmatter.globs)];
    }

    return {
      name: relPath,
      content: body.trim(),
      globs,
    };
  });
}

/**
 * Load skill names + descriptions from a repo's .claude/skills/ directory.
 * Only reads SKILL.md frontmatter — does not inject full content.
 */
function loadSkills(repoPath: string): SkillInfo[] {
  const skillsDir = path.join(repoPath, ".claude", "skills");
  if (!fs.existsSync(skillsDir)) return [];

  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const skillMd = readFileOr(
        path.join(skillsDir, d.name, "SKILL.md"),
        "",
      );
      const { frontmatter } = parseFrontmatter(skillMd);
      const description =
        typeof frontmatter.description === "string"
          ? frontmatter.description
          : "(no description)";
      return { name: d.name, description };
    });
}

/**
 * Collect full context for a single repo.
 */
function collectRepo(repo: RepoRef): RepoContext {
  const claudeMdPath = path.join(repo.path, "CLAUDE.md");
  const description = extractDescription(claudeMdPath);
  const rules = loadRules(repo.path);
  const skills = loadSkills(repo.path);

  return { repo, description, rules, skills };
}

/**
 * Format all repo contexts into a system prompt section.
 */
function formatRepoContexts(contexts: RepoContext[]): string {
  if (contexts.length === 0) return "";

  const sections: string[] = ["# Repo Context", ""];

  for (const ctx of contexts) {
    sections.push(`## ${ctx.repo.name} (${ctx.repo.path})`);
    if (ctx.description) {
      sections.push(ctx.description);
    }
    sections.push("");

    // Rules
    const alwaysActive = ctx.rules.filter((r) => r.globs.length === 0);
    const globScoped = ctx.rules.filter((r) => r.globs.length > 0);

    if (alwaysActive.length > 0) {
      sections.push("### Rules");
      for (const rule of alwaysActive) {
        sections.push(`#### ${rule.name}`);
        sections.push(rule.content);
        sections.push("");
      }
    }

    if (globScoped.length > 0) {
      sections.push("### Rules (apply when working with matching files)");
      for (const rule of globScoped) {
        const globStr = rule.globs.join(", ");
        sections.push(`#### ${rule.name} (applies to: ${globStr})`);
        sections.push(rule.content);
        sections.push("");
      }
    }

    // Skills
    if (ctx.skills.length > 0) {
      sections.push("### Available Skills");
      for (const skill of ctx.skills) {
        sections.push(
          `- **${skill.name}** (${ctx.repo.path}/.claude/skills/${skill.name}/SKILL.md): ${skill.description}`,
        );
      }
      sections.push("");
    }

    sections.push("---", "");
  }

  return sections.join("\n");
}

// --- Extension Entry ---

export default function repoContextExtension(pi: ExtensionAPI) {
  let repoContexts: RepoContext[] = [];

  // Scan for repos on session start
  pi.on("session_start", async (_event, ctx) => {
    const repos = discoverRepos(ctx.cwd);
    repoContexts = repos.map(collectRepo);

    if (repoContexts.length > 0) {
      const names = repoContexts.map((c) => c.repo.name).join(", ");
      ctx.ui.notify(`Repo context: ${names}`, "info");
    }
  });

  // Inject repo context into system prompt
  pi.on("before_agent_start", async (event, _ctx) => {
    if (repoContexts.length === 0) return;

    const contextBlock = formatRepoContexts(repoContexts);
    if (!contextBlock) return;

    return {
      systemPrompt: event.systemPrompt + "\n\n" + contextBlock,
    };
  });
}

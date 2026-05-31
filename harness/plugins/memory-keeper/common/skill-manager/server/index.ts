/**
 * Skill Manager MCP Server.
 *
 * Thin adapter: receives MCP tool calls, delegates to shared modules, returns results.
 * One process per Claude session, started via .mcp.json.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import { loadStats, loadAllDailyScores } from "../stats";
import { scoreLabel } from "../scoring";
import {
  ensureAgentsEvalsFile,
  readAgentsEvalsLines,
  writeAgentsEvalsLines,
  parseSkillEvalEntries,
  formatSkillEvalEntry,
  nextSkillEvalId,
  sanitizeEvalNote,
  buildSkillEvalSnippet,
  today,
} from "../evals";

// --- Constants ---

const SKILLS_DIR = join(homedir(), ".pi", "agent", "skills");

// --- Helpers ---

interface SkillFile {
  relativePath: string;
  content: string;
}

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

// --- MCP Server ---

const server = new McpServer({
  name: "skills",
  version: "1.0.0",
});

// Tool: skill_load

server.tool(
  "skill_load",
  "Load a skill by name — returns SKILL.md content and all supplementary files. Use to inject skill instructions into context.",
  {
    name: z.string().describe("Skill name (directory name under ~/.pi/agent/skills/)"),
  },
  async ({ name }) => {
    const skillDir = join(SKILLS_DIR, name);
    const skillMdPath = join(skillDir, "SKILL.md");

    if (!existsSync(skillMdPath)) {
      return {
        content: [{ type: "text" as const, text: `Skill "${name}" not found in ${SKILLS_DIR}` }],
      };
    }

    let skillMd = readFileSync(skillMdPath, "utf8");

    const evalSnippet = buildSkillEvalSnippet(name);
    if (evalSnippet) {
      skillMd = `${skillMd}\n${evalSnippet}`;
    }

    const files = collectSkillFiles(skillDir);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ skillMd, files, skillDir }, null, 2),
      }],
    };
  },
);

// Tool: skill_stats

server.tool(
  "skill_stats",
  "Read skill usage statistics and daily quality scores. Returns formatted stats table.",
  {
    skill: z.string().optional().describe("Filter to a specific skill name"),
  },
  async ({ skill }) => {
    const stats = loadStats();
    const allScores = loadAllDailyScores();

    const entries = Object.entries(stats)
      .filter(([name]) => !skill || name === skill)
      .filter(([, s]) => s.uses > 0)
      .sort((a, b) => b[1].uses - a[1].uses);

    if (entries.length === 0) {
      return {
        content: [{ type: "text" as const, text: skill ? `No stats for "${skill}".` : "No skill stats recorded yet." }],
      };
    }

    const header = "Skill | Uses | Sessions | Last Used | Avg Score | Label";
    const sep = "---|---|---|---|---|---";
    const rows = entries.map(([name, s]) => {
      const scores = allScores.get(name);
      let avgScore = "-";
      let label = "-";
      if (scores && scores.length > 0) {
        const allNums = scores.flatMap((d) => d.scores);
        if (allNums.length > 0) {
          const avg = allNums.reduce((a, b) => a + b, 0) / allNums.length;
          avgScore = avg.toFixed(1);
          label = scoreLabel(Math.round(avg));
        }
      }
      return `${name} | ${s.uses} | ${s.sessions} | ${s.lastUsed || "-"} | ${avgScore} | ${label}`;
    });

    return {
      content: [{ type: "text" as const, text: [header, sep, ...rows].join("\n") }],
    };
  },
);

// Tool: skill_eval

server.tool(
  "skill_eval",
  "Add, update, remove, or list evaluation directives in AGENTS_EVALS.md. The only way to modify skill evaluation overrides.",
  {
    action: z.enum(["add", "update", "remove", "list"]).describe("Action to perform"),
    skill: z.string().optional().describe("Skill name (required for add; optional filter for list)"),
    note: z.string().optional().describe("Actionable directive text (required for add/update). Use imperative: 'always X', 'never Y', 'when Z do W'"),
    id: z.number().optional().describe("Entry ID (required for update/remove)"),
    score: z.number().optional().describe("Score 1-10 (required for add, optional for update)"),
  },
  async ({ action, skill, note, id, score }) => {
    ensureAgentsEvalsFile();

    if (action === "list") {
      const lines = readAgentsEvalsLines();
      const entries = parseSkillEvalEntries(lines)
        .filter((e) => !skill || e.skill === skill)
        .sort((a, b) => b.id - a.id);

      if (entries.length === 0) {
        return {
          content: [{ type: "text" as const, text: skill ? `No evaluations for "${skill}".` : "No evaluations recorded." }],
        };
      }

      const out = entries.map((e) => `#${e.id} ${e.date} skill=${e.skill} score=${e.score}/10 note=${e.note}`);
      return {
        content: [{ type: "text" as const, text: out.join("\n") }],
      };
    }

    if (action === "add") {
      if (!skill) return { content: [{ type: "text" as const, text: "Error: skill is required for add" }] };
      if (!note) return { content: [{ type: "text" as const, text: "Error: note is required for add" }] };
      if (!score || score < 1 || score > 10) return { content: [{ type: "text" as const, text: "Error: score 1-10 is required for add" }] };

      const lines = readAgentsEvalsLines();
      const entries = parseSkillEvalEntries(lines);
      const newId = nextSkillEvalId(entries);
      const entry = formatSkillEvalEntry({ id: newId, date: today(), skill, score, note: sanitizeEvalNote(note) });

      const sectionHeader = `## ${skill}`;
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
        content: [{ type: "text" as const, text: `Added evaluation #${newId} for ${skill} (${score}/10).` }],
      };
    }

    if (action === "update") {
      if (id == null) return { content: [{ type: "text" as const, text: "Error: id is required for update" }] };
      if (!note && !score) return { content: [{ type: "text" as const, text: "Error: note or score is required for update" }] };

      const lines = readAgentsEvalsLines();
      const entries = parseSkillEvalEntries(lines);
      const existing = entries.find((e) => e.id === id);
      if (!existing) return { content: [{ type: "text" as const, text: `Evaluation #${id} not found.` }] };

      lines[existing.lineIndex] = formatSkillEvalEntry({
        id: existing.id,
        date: existing.date,
        skill: existing.skill,
        score: score ?? existing.score,
        note: note ? sanitizeEvalNote(note) : existing.note,
      });
      writeAgentsEvalsLines(lines);

      return {
        content: [{ type: "text" as const, text: `Updated evaluation #${id}.` }],
      };
    }

    if (action === "remove") {
      if (id == null) return { content: [{ type: "text" as const, text: "Error: id is required for remove" }] };

      const lines = readAgentsEvalsLines();
      const entries = parseSkillEvalEntries(lines);
      const existing = entries.find((e) => e.id === id);
      if (!existing) return { content: [{ type: "text" as const, text: `Evaluation #${id} not found.` }] };

      lines.splice(existing.lineIndex, 1);
      writeAgentsEvalsLines(lines);

      return {
        content: [{ type: "text" as const, text: `Removed evaluation #${id}.` }],
      };
    }

    return {
      content: [{ type: "text" as const, text: `Unknown action: ${action}` }],
    };
  },
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Skills MCP server failed to start:", err);
  process.exit(1);
});

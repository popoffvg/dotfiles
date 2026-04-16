/**
 * Shared AGENTS_EVALS.md helpers for skill-manager (Pi + Claude Code MCP).
 * Pure TS — no Pi or MCP dependencies.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export const AGENTS_EVALS_FILE = join(homedir(), ".pi", "agent", "AGENTS_EVALS.md");

export interface SkillEvalEntry {
  id: number;
  date: string;
  skill: string;
  score: number;
  note: string;
  lineIndex: number;
}

const SKILL_EVAL_RE = /^- \[(\d+)\] (\d{4}-\d{2}-\d{2}) skill=([^\s]+) score=(10|[1-9]) note=(.*)$/;

const DEFAULT_EVALS_CONTENT =
  '# AGENTS_EVALS\n\nEvaluation notes that **overlay skill instructions**. Injected into the system prompt automatically.\n\n- `## Common` — directives applied to every session regardless of loaded skills.\n- `## <skill-name>` — directives applied only when that skill is active.\n\nWrite actionable directives ("always X", "never Y", "when Z do W"), not observations.\n\n## Common\n\n## work-plan\n\n## work-implement\n\n## work-verify\n';

export function ensureAgentsEvalsFile(): void {
  if (existsSync(AGENTS_EVALS_FILE)) return;
  mkdirSync(dirname(AGENTS_EVALS_FILE), { recursive: true });
  writeFileSync(AGENTS_EVALS_FILE, DEFAULT_EVALS_CONTENT, "utf8");
}

export function parseSkillEvalEntries(lines: string[]): SkillEvalEntry[] {
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

export function formatSkillEvalEntry(entry: Omit<SkillEvalEntry, "lineIndex">): string {
  return `- [${entry.id}] ${entry.date} skill=${entry.skill} score=${entry.score} note=${entry.note}`;
}

export function readAgentsEvalsLines(): string[] {
  ensureAgentsEvalsFile();
  return readFileSync(AGENTS_EVALS_FILE, "utf8").split("\n");
}

export function writeAgentsEvalsLines(lines: string[]): void {
  writeFileSync(AGENTS_EVALS_FILE, `${lines.join("\n").replace(/\n*$/, "\n")}`, "utf8");
}

export function upsertEvaluationsSection(lines: string[]): string[] {
  const hasSection = lines.some((line) => line.trim() === "## Evaluations");
  if (hasSection) return lines;
  const result = [...lines];
  if (result.length > 0 && result[result.length - 1].trim() !== "") result.push("");
  result.push("## Evaluations", "");
  return result;
}

export function nextSkillEvalId(entries: SkillEvalEntry[]): number {
  return entries.length === 0 ? 1 : Math.max(...entries.map((e) => e.id)) + 1;
}

export function sanitizeEvalNote(note: string): string {
  return note.replace(/\s+/g, " ").trim();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parse AGENTS_EVALS.md into sections keyed by header name (lowercase). */
export function parseEvalsSection(): Map<string, string> {
  const sections = new Map<string, string>();
  if (!existsSync(AGENTS_EVALS_FILE)) return sections;
  const content = readFileSync(AGENTS_EVALS_FILE, "utf8");
  const lines = content.split("\n");
  let currentSection = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^## (.+)$/);
    if (headerMatch) {
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
  if (currentSection) {
    const body = currentLines.join("\n").trim();
    if (body) sections.set(currentSection, body);
  }
  return sections;
}

/** Build skill-specific evaluation snippet appended when a skill is loaded. */
export function buildSkillEvalSnippet(skillName: string): string {
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

import { execFile } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
import { getPreferenceValues } from "@raycast/api";

const CORRECTED_MARKER = "=== CORRECTED ===";
const TOPICS_MARKER = "=== TOPICS ===";
const END_MARKER = "=== END ===";
const CHECK_TIMEOUT_MS = 180_000;

export interface Fix {
  slug: string;
  explanation: string;
}

export interface CheckResult {
  corrected: string;
  fixes: Fix[];
  raw: string;
}

export interface LoggedFix extends Fix {
  date: string;
}

export interface Topic {
  slug: string;
  count: number;
  lastDate: string;
  lastExplanation: string;
}

interface Preferences {
  model: string;
  scriptPath: string;
  logPath: string;
  prefill: boolean;
}

function expandHome(path: string): string {
  return path.startsWith("~") ? join(homedir(), path.slice(1)) : path;
}

function preferences(): Preferences {
  const raw = getPreferenceValues<Partial<Preferences>>();
  return {
    model: raw.model?.trim() || "haiku",
    scriptPath: expandHome(raw.scriptPath?.trim() || "~/.claude/scripts/grammar-check.sh"),
    logPath: expandHome(raw.logPath?.trim() || "~/ctx/grammar/topics.tsv"),
    prefill: raw.prefill !== false,
  };
}

export function prefillEnabled(): boolean {
  return preferences().prefill;
}

export function logPath(): string {
  return preferences().logPath;
}

function section(raw: string, from: string, to: string): string | undefined {
  const start = raw.indexOf(from);
  if (start < 0) return undefined;
  const bodyStart = start + from.length;
  const end = raw.indexOf(to, bodyStart);
  return raw.slice(bodyStart, end < 0 ? undefined : end).replace(/^\n/, "").replace(/\n+$/, "");
}

function parseFix(line: string): Fix | undefined {
  const cleaned = line.replace(/^\s*[-*]\s+/, "").trim();
  if (!cleaned) return undefined;

  const separator = /\t+|\s+[—–]\s+|:\s+/.exec(cleaned);
  if (!separator || separator.index === 0) {
    return { slug: cleaned, explanation: "" };
  }
  return {
    slug: cleaned.slice(0, separator.index).trim(),
    explanation: cleaned.slice(separator.index + separator[0].length).trim(),
  };
}

export function parseCheckOutput(raw: string): CheckResult {
  const corrected = section(raw, CORRECTED_MARKER, TOPICS_MARKER);
  const topicsBlock = section(raw, TOPICS_MARKER, END_MARKER) ?? "";

  const fixes = topicsBlock
    .split("\n")
    .map(parseFix)
    .filter((fix): fix is Fix => fix !== undefined);

  return { corrected: corrected ?? raw.trim(), fixes, raw };
}

// The check runs through grammar-check.sh so the prompt and the topic log stay
// shared with the terminal entry point instead of being duplicated here.
export async function checkGrammar(text: string): Promise<CheckResult> {
  const { model, scriptPath, logPath: log } = preferences();

  if (!existsSync(scriptPath)) {
    throw new Error(`Script not found: ${scriptPath}`);
  }

  const dir = mkdtempSync(join(tmpdir(), "raycast-grammar-"));
  const inputFile = join(dir, "input.txt");
  writeFileSync(inputFile, text, "utf-8");

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        "/bin/bash",
        [scriptPath, "--quiet", inputFile],
        {
          timeout: CHECK_TIMEOUT_MS,
          maxBuffer: 8 * 1024 * 1024,
          env: {
            ...process.env,
            PATH: `${join(homedir(), ".local/bin")}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
            GRAMMAR_MODEL: model,
            GRAMMAR_LOG: log,
          },
        },
        (error, out, errorOutput) => {
          if (error) {
            reject(new Error(errorOutput.trim() || error.message));
            return;
          }
          resolve(out);
        },
      );
    });

    return parseCheckOutput(stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function readFixLog(): LoggedFix[] {
  const path = logPath();
  if (!existsSync(path)) return [];

  return readFileSync(path, "utf-8")
    .split("\n")
    .map((line) => {
      const columns = line.split("\t");
      const date = columns[0]?.trim();
      const slug = columns[1]?.trim();
      if (!date || !slug) return undefined;
      return { date, slug, explanation: columns.slice(2).join(" ").trim() };
    })
    .filter((row): row is LoggedFix => row !== undefined);
}

export function collectTopics(): Topic[] {
  const byslug = new Map<string, Topic>();

  for (const row of readFixLog()) {
    const known = byslug.get(row.slug);
    if (known) {
      known.count += 1;
      // The log is append-ordered, so the last row seen is the most recent.
      known.lastDate = row.date;
      if (row.explanation) known.lastExplanation = row.explanation;
      continue;
    }
    byslug.set(row.slug, {
      slug: row.slug,
      count: 1,
      lastDate: row.date,
      lastExplanation: row.explanation,
    });
  }

  return [...byslug.values()].sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

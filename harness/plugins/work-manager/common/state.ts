/**
 * Work Manager state management via .pi/work.settings.json
 *
 * Source of truth for machine-readable work state.
 * Pure TS — no Pi or MCP dependencies.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { WorkSettings } from "./types";
export type { WorkSettings };

const SETTINGS_FILE = ".pi/work.settings.json";

export const DEFAULT_PLAN_ALLOWED_COMMANDS: string[] = [
  "cat",
  "head",
  "tail",
  "less",
  "grep",
  "rg",
  "find",
  "ls",
  "tree",
  "wc",
  "file",
  "stat",
  "echo",
  "pwd",
  "git log",
  "git show",
  "git diff",
  "git status",
  "git branch",
  "gh api",
  "gh pr list",
  "gh pr view",
  "gh pr status",
  "gh pr checks",
  "gh issue list",
  "gh issue view",
  "gh issue status",
  "gh run list",
  "gh run view",
  "gh repo view",
];

export const DEFAULTS: WorkSettings = {
  workId: "",
  name: "",
  status: "active",
  branch: "",
  worktreePath: null,
  worktreeBranch: null,
  approveCommits: false,
  planAllowedCommands: DEFAULT_PLAN_ALLOWED_COMMANDS,
};

/** Resolve the settings file path for a given directory */
export function settingsPath(dir: string): string {
  return path.join(dir, SETTINGS_FILE);
}

/** Find settings file in cwd, parent dirs, or immediate subdirs */
export function findSettings(cwd: string): string | null {
  // 1) Direct in current dir
  const direct = settingsPath(cwd);
  if (fs.existsSync(direct)) return direct;

  // 2) Walk up parent directories (supports running from nested repo paths)
  try {
    let cur = path.resolve(cwd);
    while (true) {
      const candidate = settingsPath(cur);
      if (fs.existsSync(candidate)) return candidate;

      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  } catch {
    /* ignore */
  }

  // 3) Scan immediate subdirs (existing behavior)
  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true });
    const found: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = settingsPath(path.join(cwd, entry.name));
      if (fs.existsSync(candidate)) found.push(candidate);
    }
    if (found.length === 1) return found[0];
  } catch {
    /* ignore */
  }

  return null;
}

/** Read settings from file, returns null if not found */
export function readSettings(filePath: string): WorkSettings | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return { ...DEFAULTS, ...data };
  } catch {
    return null;
  }
}

/** Write settings to file, creates .pi/ directory if needed */
export function writeSettings(
  filePath: string,
  settings: WorkSettings,
): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2) + "\n");
}

/** Update specific fields in settings file (read-modify-write) */
export function updateSettings(
  filePath: string,
  updates: Partial<WorkSettings>,
): WorkSettings {
  const current = readSettings(filePath) || { ...DEFAULTS };
  const updated = { ...current, ...updates };
  writeSettings(filePath, updated);
  return updated;
}

/** Get the task root directory from a settings file path */
export function taskDirFromSettings(settingsFilePath: string): string {
  return path.dirname(path.dirname(settingsFilePath));
}

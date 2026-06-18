/**
 * .notes/ folder management.
 * Pure TS with dependency-injected git function.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { GitFn } from "./types";

/** Read file with fallback value */
export function readFileOr(filePath: string, fallback: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return fallback;
  }
}

/** Format timestamp as YYYY-MM-DD HH:MM */
export function makeTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Ensure .notes/ exists with git init and at least one commit. Returns notesDir path. */
export function ensureNotesDir(targetDir: string, git: GitFn): string {
  const notesDir = path.join(targetDir, ".notes");
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }

  const gitDir = path.join(notesDir, ".git");
  if (!fs.existsSync(gitDir)) {
    try {
      git("init", notesDir);
    } catch {
      /* best effort */
    }
  }

  // Ensure at least one commit exists
  try {
    git("rev-parse HEAD", notesDir);
  } catch {
    try {
      git("add -A", notesDir);
      const status = git("status --porcelain", notesDir).trim();
      if (status) {
        git('commit -m "init: work notes"', notesDir);
      } else {
        git('commit --allow-empty -m "init: work notes"', notesDir);
      }
    } catch {
      /* best effort */
    }
  }

  return notesDir;
}

/** Commit all changes in .notes/ */
export function commitNotes(
  notesDir: string,
  message: string,
  git: GitFn,
): void {
  try {
    git("add -A", notesDir);
    const status = git("status --porcelain", notesDir).trim();
    if (status) {
      git(`commit -m "${message.replace(/"/g, '\\"')}"`, notesDir);
    }
  } catch {
    /* best effort */
  }
}

/** Append an entry to .notes/worklog.md */
export function appendWorklog(notesDir: string, entry: string): void {
  const worklogPath = path.join(notesDir, "worklog.md");
  const existing = readFileOr(worklogPath, "# Work Log\n");
  const ts = makeTimestamp();
  fs.writeFileSync(
    worklogPath,
    existing.trimEnd() + `\n- ${ts}: ${entry}\n`,
  );
}

/** Ensure root CLAUDE.md contains basic wm instructions. */
export function ensureClaudeMd(targetDir: string): void {
  const claudePath = path.join(targetDir, "CLAUDE.md");
  const sectionHeader = "## WM Plugin";
  const sectionBody = `${sectionHeader}

This repository uses the wm plugin. Work is driven by agents/skills.

- Start or resume tracking with /work:start and /work:status
- Invoke the planner / researcher / implementer agents as needed
- Implementer executes one TODO at a time
- Keep planning artifacts in .notes/ (spec.md, worklog.md, todos/TODO-N.md)
`;

  const existing = readFileOr(claudePath, "");
  if (!existing.trim()) {
    fs.writeFileSync(claudePath, `# CLAUDE.md\n\n${sectionBody}`);
    return;
  }

  if (existing.includes(sectionHeader)) return;

  fs.writeFileSync(claudePath, `${existing.trimEnd()}\n\n${sectionBody}`);
}

export function worklogTail(notesDir: string, n: number): string {
  const worklogPath = path.join(notesDir, "worklog.md");
  const worklog = readFileOr(worklogPath, "");
  return worklog
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .slice(-n)
    .join("\n");
}

/** Parse TODO items from spec.md content */
export interface TodoItem {
  text: string;
  done: boolean;
  index: number;
}

export function parseTodos(planContent: string): TodoItem[] {
  const todos: TodoItem[] = [];
  let index = 0;
  for (const line of planContent.split("\n")) {
    const match = line.match(/^(\s*)- \[([ x])\]\s+(.+)/);
    if (match) {
      index++;
      todos.push({ text: match[3].trim(), done: match[2] === "x", index });
    }
  }
  return todos;
}

/** Get the current (first unchecked) TODO */
export function currentTodo(planContent: string): TodoItem | null {
  return parseTodos(planContent).find((t) => !t.done) || null;
}

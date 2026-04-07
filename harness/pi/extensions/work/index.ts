/**
 * Work Extension for Pi
 *
 * Plan & state management. Creates _notes/ folder (git-tracked) for plan + docs.
 * Source of truth: .pi/work.settings.json
 * Skills/commands: ~/.claude/plugins/work-manager/
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionUIContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import {
  type WorkSettings,
  findSettings,
  readSettings,
  updateSettings,
  settingsPath,
  taskDirFromSettings,
  DEFAULT_PLAN_ALLOWED_COMMANDS,
} from "./state";
import {
  WORK_EVENTS,
  type CreateNotesPayload,
  type SubtaskInitRequestPayload,
  type TodoCompletedPayload,
  type ReturnToPlanPayload,
} from "./events";
import { SKILL_EVENTS, type SkillLoadPayload, type SkillLoadResult, type SkillFeedbackPayload, type SkillResetSessionPayload, type SkillGetEvalsPayload } from "../skill-manager/events";
import {
  type WorkStats,
  type UsageData,
  readStats,
  writeStats,
  addUsage,
  formatStats,
} from "./stats";

const CLAUDE_WM = path.join(
  process.env.HOME || "~",
  ".claude/plugins/work-manager",
);

/** Format status bar text: show name only if meaningful, always show phase */
function formatStatus(settings: { workId?: string; name?: string }, phase: string): string {
  const label = settings.workId || settings.name;
  if (!label || label === "unnamed work") {
    return `📋 [${phase}]`;
  }
  return `📋 ${label} [${phase}]`;
}

// --- Helpers ---

function readFileOr(filePath: string, fallback: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return fallback;
  }
}

function resolvePluginRoot(content: string): string {
  return content.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, CLAUDE_WM);
}

/**
 * Load a skill through skill-manager (tracks usage + applies overrides).
 * Falls back to direct read if skill-manager hasn't registered its listener yet.
 */
let _eventBus: { emit: (channel: string, data: any) => void } | null = null;

function readSkill(name: string): string {
  let result: SkillLoadResult | null = null;

  if (_eventBus) {
    _eventBus.emit(SKILL_EVENTS.LOAD, {
      name,
      resolve: (r: SkillLoadResult | null) => { result = r; },
    } satisfies SkillLoadPayload);
  }

  if (result) {
    // Build full content: SKILL.md + all supplementary files
    const parts: string[] = [result.skillMd];
    for (const file of result.files) {
      if (file.relativePath === "SKILL.md") continue;
      parts.push(`\n---\n## ${file.relativePath}\n\n${file.content}`);
    }
    return resolvePluginRoot(parts.join("\n"));
  }

  // Fallback: direct read if skill-manager didn't provide content
  const p = path.join(CLAUDE_WM, "skills", name, "SKILL.md");
  return resolvePluginRoot(readFileOr(p, ""));
}

/** Load AGENTS_EVALS directives for given skill names via skill-manager API. */
function readSkillEvals(...skillNames: string[]): string {
  let result = "";
  if (_eventBus) {
    _eventBus.emit(SKILL_EVENTS.GET_EVALS, {
      skills: skillNames,
      resolve: (evals: string) => { result = evals; },
    } satisfies SkillGetEvalsPayload);
  }
  return result;
}

/** Load skill content + its AGENTS_EVALS overlay. */
function readSkillWithEvals(name: string): string {
  const skill = readSkill(name);
  const evals = readSkillEvals(name);
  if (!evals) return skill;
  return skill + "\n\n---\n" + evals;
}

function readCommand(name: string): string {
  const p = path.join(CLAUDE_WM, "commands", `${name}.md`);
  return resolvePluginRoot(readFileOr(p, ""));
}

function makeTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Get last N lines from worklog */
function worklogTail(notesDir: string, n: number): string {
  const worklogPath = path.join(notesDir, "worklog.md");
  const worklog = readFileOr(worklogPath, "");
  return worklog.split("\n").filter((l) => l.startsWith("- ")).slice(-n).join("\n");
}

// --- Plan TODO parsing ---

interface TodoItem {
  text: string;
  done: boolean;
  index: number; // 1-based position among all TODOs
}

/** Parse all TODOs from plan.md content */
function parseTodos(planContent: string): TodoItem[] {
  const todos: TodoItem[] = [];
  let index = 0;
  for (const line of planContent.split("\n")) {
    const match = line.match(/^(\s*)- \[([ x])\]\s+(.+)/);
    if (match) {
      index++;
      todos.push({
        text: match[3].trim(),
        done: match[2] === "x",
        index,
      });
    }
  }
  return todos;
}

/** Get the current (first unchecked) TODO */
function currentTodo(planContent: string): TodoItem | null {
  const todos = parseTodos(planContent);
  return todos.find((t) => !t.done) || null;
}

/** Build widget lines showing implement progress */
function buildProgressWidget(notesDir: string): string[] | undefined {
  const planPath = path.join(notesDir, "plan.md");
  const planContent = readFileOr(planPath, "");
  if (!planContent) return undefined;

  const todos = parseTodos(planContent);
  if (todos.length === 0) return undefined;

  const done = todos.filter((t) => t.done).length;
  const total = todos.length;
  const current = todos.find((t) => !t.done);

  // Progress bar
  const barWidth = 20;
  const filled = Math.round((done / total) * barWidth);
  const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);

  const lines: string[] = [];
  lines.push(`  ⚡ Implement [${bar}] ${done}/${total}`);
  if (current) {
    const label = current.text.length > 60
      ? current.text.slice(0, 57) + "..."
      : current.text;
    lines.push(`  → TODO ${current.index}: ${label}`);
  } else {
    lines.push(`  ✅ All TODOs complete`);
  }

  return lines;
}

// --- Git helpers ---

const { execSync } = require("node:child_process");

// --- _notes/ folder management ---

/** Ensure _notes/ exists with git init and at least one commit. Returns notesDir path. */
function ensureNotesDir(targetDir: string): string {
  const notesDir = path.join(targetDir, "_notes");
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }

  const { execSync } = require("node:child_process");
  const gitDir = path.join(notesDir, ".git");
  if (!fs.existsSync(gitDir)) {
    try {
      execSync("git init", { cwd: notesDir, stdio: "pipe" });
    } catch {
      /* best effort */
    }
  }

  // Ensure at least one commit exists
  try {
    execSync("git rev-parse HEAD", { cwd: notesDir, stdio: "pipe" });
  } catch {
    // No commits yet — create initial commit
    try {
      execSync("git add -A", { cwd: notesDir, stdio: "pipe" });
      const status = execSync("git status --porcelain", {
        cwd: notesDir,
        encoding: "utf-8",
      }).trim();
      if (status) {
        execSync('git commit -m "init: work notes"', {
          cwd: notesDir,
          stdio: "pipe",
        });
      } else {
        // Nothing to commit — create empty initial commit
        execSync('git commit --allow-empty -m "init: work notes"', {
          cwd: notesDir,
          stdio: "pipe",
        });
      }
    } catch {
      /* best effort */
    }
  }

  return notesDir;
}

/** Commit all changes in _notes/ */
function commitNotes(notesDir: string, message: string): void {
  const { execSync } = require("node:child_process");
  try {
    execSync("git add -A", { cwd: notesDir, stdio: "pipe" });
    const status = execSync("git status --porcelain", {
      cwd: notesDir,
      encoding: "utf-8",
    }).trim();
    if (status) {
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: notesDir,
        stdio: "pipe",
      });
    }
  } catch {
    /* best effort */
  }
}

// --- Task Context ---

export interface TaskContext {
  kind: "task";
  notesDir: string;
  settingsFile: string;
  settings: WorkSettings;
}

function detectTaskContext(cwd: string): TaskContext | null {
  const sf = findSettings(cwd);
  if (!sf) return null;

  const settings = readSettings(sf);
  if (!settings) return null;
  if (settings.status !== "active") return null;

  const taskDir = taskDirFromSettings(sf);
  const notesDir = path.join(taskDir, "_notes");
  return { kind: "task", notesDir, settingsFile: sf, settings };
}

function formatTaskReport(tc: TaskContext): string {
  const { settings } = tc;
  if (settings.status !== "active") return "";

  const lines: string[] = [
    `## 📋 Active Work: ${settings.workId || settings.name}`,
    "",
    `**Phase:** ${settings.phase}`,
    "",
  ];

  const planContent = readFileOr(path.join(tc.notesDir, "plan.md"), "");

  const descMatch = planContent.match(
    /## Description\n\n([\s\S]*?)(?=\n## )/,
  );
  if (descMatch) {
    lines.push(`**Description:** ${descMatch[1].trim()}`, "");
  }

  const criteriaMatch = planContent.match(
    /## Acceptance Criteria\n\n([\s\S]*?)(?=\n## )/,
  );
  if (criteriaMatch) {
    lines.push("**Acceptance Criteria:**", criteriaMatch[1].trim(), "");
  }

  const worklog = readFileOr(path.join(tc.notesDir, "worklog.md"), "");
  if (worklog) {
    const entries = worklog
      .split("\n")
      .filter((l) => l.startsWith("- "))
      .slice(-5);
    if (entries.length > 0) {
      lines.push("**Recent progress:**", ...entries, "");
    }
  }

  try {
    const noteFiles = fs
      .readdirSync(tc.notesDir)
      .filter(
        (f) =>
          f.endsWith(".md") &&
          f !== "plan.md" &&
          f !== "README.md" &&
          f !== "worklog.md",
      );
    if (noteFiles.length > 0) {
      lines.push(
        `**Work notes:** ${noteFiles.map((f) => f.replace(".md", "")).join(", ")}`,
        "",
      );
    }
  } catch {
    /* ignore */
  }

  lines.push(
    "---",
    "",
    `Use \`/atom:recall\` for full context or \`/atom:recall <topic>\` for a specific note.`,
  );

  return lines.join("\n");
}

function phaseInstructions(phase: string, approveCommits = true): string {
  if (phase === "verified") {
    return [
      `\n## Work Phase: Verified`,
      "",
      `You are currently in the **verified** phase.`,
      "Treat user messages as normal chat requests and execute them directly.",
      "Do NOT reinterpret requests as planning-only tasks.",
      "Do NOT apply plan-phase restrictions unless phase is explicitly switched back to `plan`.",
    ].join("\n");
  }

  if (phase === "todo") {
    return [
      `\n## Work Phase: Todo`,
      "",
      `You are currently in the **todo** phase — ordinary chat mode within active work context.`,
      "",
      "Treat user messages as normal chat requests and execute them directly.",
      "Do NOT reinterpret requests as planning-only tasks.",
      "Do NOT apply plan-phase restrictions unless phase is explicitly switched back to `plan`.",
      "",
      "### Skill paths",
      "When loading skills (go-modify, shell-modify, etc.), use **absolute paths** from `<available_skills>` in the system prompt. Skills live in `~/.pi/agent/skills/`, NOT in the project directory.",
      "",
      "### Todo Phase Rules",
      "- **NEVER run `git push`** without explicit user request.",
      "- **Act autonomously by default.** Try to complete the request end-to-end without waiting for additional user interaction.",
      "",
      "### Todo Commit Flow (MANDATORY — follow every step)",
      "After making code changes, you MUST complete ALL steps:",
      "1. Run tests / static analysis relevant to the change",
      ...(approveCommits
        ? ["2. **Ask the user for approval** — show changed files and test results. **Do not commit without explicit user approval.**",
           "3. **`git add -A && git commit -m \"<message>\"`** — stage and commit in one step.",
           "4. Log to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: [todo] <summary>`"]
        : ["2. **`git add -A && git commit -m \"<message>\"`** — stage and commit in one step. Do not stop before committing.",
           "3. Log to `_notes/worklog.md`: `- YYYY-MM-DD HH:MM: [todo] <summary>`"]),
      "",
      "**You are NOT done until the commit is made.** Do not present results or ask what's next before committing.",
    ].join("\n");
  }

  const phaseSkillMap: Record<string, string> = {
    research: "work-research",
    plan: "work-plan",
    implement: "work-implement",
  };

  const skillName = phaseSkillMap[phase];
  if (!skillName) return "";

  const skill = readSkill(skillName);
  if (!skill) return "";

  const phaseLabels: Record<string, string> = {
    research: "Research",
    plan: "Plan",
    implement: "Implement",
  };

  const parts = [
    `\n## Work Phase: ${phaseLabels[phase] || phase}`,
    "",
    `You are currently in the **${phase}** phase. Follow these instructions:`,
    "",
    skill,
  ];

  const evals = readSkillEvals(skillName);
  if (evals) {
    parts.push("\n---\n" + evals);
  }

  return parts.join("\n");
}


/** Build rich context for returning to plan phase. Includes worklog tail and impl notes. */
function buildReturnToPlanContext(notesDir: string, cause: string): string {
  const parts: string[] = [];

  parts.push(`## Return to Plan`);
  parts.push("");
  parts.push(`**Cause:** ${cause}`);
  parts.push("");

  // Recent worklog — shows cycles of implement/verify attempts
  const worklog = readFileOr(path.join(notesDir, "worklog.md"), "");
  const worklogLines = worklog.split("\n").filter((l) => l.startsWith("- ")).slice(-20);
  if (worklogLines.length > 0) {
    parts.push(`### Recent History`);
    parts.push("```");
    parts.push(...worklogLines);
    parts.push("```");
    parts.push("");
  }

  // Current plan for reference
  const plan = readFileOr(path.join(notesDir, "plan.md"), "");
  if (plan) {
    parts.push(`### Current Plan`);
    parts.push(plan);
    parts.push("");
  }

  return parts.join("\n");
}

/** Build context for entering implement phase. Plan + worklog only — no prior conversation. */
function buildImplementContext(notesDir: string, extra?: string): string {
  const parts: string[] = [];

  // Resolve settings for commit-approval behavior
  const taskDir = path.dirname(notesDir);
  const sf = settingsPath(taskDir);
  const settings = readSettings(sf);

  parts.push(`## Entering Implement Phase`);
  parts.push("");
  parts.push(`Implement changes directly in the current branch/repository.`);
  parts.push(`The _notes/ directory for planning/logging is: \`${notesDir}\``);
  parts.push("");

  if (settings?.approveCommits) {
    parts.push(`**⚠️ APPROVE COMMITS: \`approveCommits\` is ON. You MUST ask the user for approval before every git commit. Show changed files and test results. Do not commit without explicit approval.**`);
    parts.push("");
  }

  // Full plan
  const plan = readFileOr(path.join(notesDir, "plan.md"), "");
  if (plan) {
    parts.push(plan);
    parts.push("");
  }

  // Implementation learnings from previous TODOs
  const learnings = readFileOr(path.join(notesDir, "impl-learnings.md"), "");
  if (learnings && learnings.trim() !== "# Implementation Learnings") {
    parts.push(`### Learnings from Previous TODOs`);
    parts.push("");
    parts.push(`**Read these carefully — they contain code understanding from earlier TODOs so you don't re-discover the same things.**`);
    parts.push("");
    parts.push(learnings);
    parts.push("");
  }

  // Recent worklog
  const worklog = readFileOr(path.join(notesDir, "worklog.md"), "");
  const worklogLines = worklog.split("\n").filter((l) => l.startsWith("- ")).slice(-15);
  if (worklogLines.length > 0) {
    parts.push(`### Recent History`);
    parts.push("```");
    parts.push(...worklogLines);
    parts.push("```");
    parts.push("");
  }

  // Commit conventions
  const commitSkill = readSkill("work-commit");
  if (commitSkill) {
    parts.push(commitSkill);
    parts.push("");
  }

  if (extra) {
    parts.push(extra);
    parts.push("");
  }

  return parts.join("\n");
}

function routerInstructions(approveCommits = true): string {
  return `
## Work Manager — Phase Rules

### Plan Phase (CRITICAL)
**In plan phase, you are a PLANNER, not an executor.**
- NEVER write code, edit source files, run tests, or make changes outside \`_notes/\`.
- ALL user messages are plan input — requirements, refinements, priorities.
- User says "add X" → add it as a TODO, do NOT implement X.
- The plan is a TODO list (\`- [ ]\` checkboxes) in \`_notes/plan.md\`.
- You may READ source files. You may ONLY WRITE to \`_notes/plan.md\` and \`_notes/worklog.md\`.

### Implement Phase
- Execute TODOs from \`_notes/plan.md\` in order.
- Work directly in the current branch/repository (no worktree).
- **Each TODO = one git commit.** Before each commit: verify TODO completion, run relevant tests, re-test after fixes.${approveCommits ? " **Ask the user for approval before every commit.** Show changed files and test results. Do not commit without explicit approval." : ""} Stage and commit in one step: \`git add -A && git commit -m "..."\`.
- **After each TODO: call \`work_compact\`** to free context and re-orient on remaining work.
- In \`plan.md\`, you may ONLY check off TODOs: \`- [ ]\` → \`- [x]\`. No other edits allowed.
- Log implementation details as items in \`_notes/worklog.md\`.
- **FIX/FIXUP messages:** When user sends a message starting with FIX or FIXUP, create a \`git commit --fixup=<target-sha>\` for the relevant prior commit. Do not check off any TODO — resume current work after.

### Todo Phase
- Todo is ordinary chat mode within active work context.
- Execute user requests normally (not planning-only behavior).
- **NEVER run \`git push\`** (including force-push or tag pushes) without explicit user request.
- **Todo commit flow (MANDATORY):** After code changes: (1) run tests, (2) ${approveCommits ? "**ask the user for approval** — show changed files and test results, (3) " : ""} **\`git add -A && git commit -m "..."\`**, (${approveCommits ? "4" : "3"}) log to worklog. **You are NOT done until the commit is made.**${approveCommits ? " **Do not commit without explicit user approval.**" : ""}
- **Autonomy rule:** In todo phase, try to complete the request end-to-end without requiring additional user interaction.
- **Log every action** to \`_notes/worklog.md\`: \`- YYYY-MM-DD HH:MM: [todo] <action summary>\`
- Return to plan with \`/work:plan\`.

### Phase Transitions

Allowed transitions:
- research → plan
- plan → research (if unknowns found)
- plan → implement (via \`/work:implement\` command ONLY)
- implement → plan (via \`/work:plan\`)
- plan/implement → todo (via \`/work:todo\`)
- todo → plan (via \`/work:plan\`)
- implement → verify (LLM sets phase to "verify" when all TODOs done)
- verify → verified (user approves in verify dialog)

**Important rules:**
- plan → implement: NEVER transition manually. User must use \`/work:implement\`.
- plan-mode restrictions apply ONLY when current phase is \`plan\`.
- After all TODOs are done, LLM sets phase to "verify" and the extension shows a UI verify dialog.
- Do NOT manage the verify phase — the extension owns it.

When transitioning phases:
1. Update \`.pi/work.settings.json\`: set \`"phase": "<new>"\`
2. Append to \`_notes/worklog.md\`: \`- YYYY-MM-DD HH:MM: Phase transition: <old> → <new>\`

## Worklog Rule

After completing ANY work action, append to \`_notes/worklog.md\`:
\`\`\`
- YYYY-MM-DD HH:MM: <action summary>
\`\`\`
`;
}

// --- Extension Entry ---

export default function (pi: ExtensionAPI) {
  // Wire up event bus for skill loading via skill-manager
  _eventBus = pi.events;

  let currentPhase: string | null = null;
  let currentSettingsFile: string | null = null;
  let taskContext: TaskContext | null = null;
  let reportedOnStart = false;
  let toolsWereExpanded: boolean | null = null; // saved state before implement
  let todoDidWork = false; // tracks whether agent made real changes in current todo turn

  // --- Token stats tracking ---
  /** Current category for token accounting. "work" by default; temporarily set to "overhead"/"compaction"/"insight" */
  let statsBucket: "work" | "overhead" | "compaction" | "insight" = "work";

  /** Record usage from an assistant message into the current bucket */
  function recordUsage(notesDir: string | undefined, usage: UsageData) {
    if (!notesDir) return;
    const stats = readStats(notesDir);
    addUsage(stats[statsBucket], usage);
    writeStats(notesDir, stats);
  }

  /** Increment session count on start */
  function recordSessionStart(notesDir: string) {
    const stats = readStats(notesDir);
    stats.sessions += 1;
    writeStats(notesDir, stats);
  }

  /** Increment compaction count */
  function recordCompaction(notesDir: string) {
    const stats = readStats(notesDir);
    stats.compactions += 1;
    writeStats(notesDir, stats);
  }

  /** Set bucket to "overhead" — auto-resets to "work" on next agent_start */
  function markOverhead() { statsBucket = "overhead"; }

  /** Set bucket to "compaction" — must be restored in onComplete/onError */
  function markCompaction() { statsBucket = "compaction"; }

  /** Restore bucket to "work" */
  function markWork() { statsBucket = "work"; }

  let compactionInProgress = false;
  let compactionSpinnerTimer: NodeJS.Timeout | null = null;
  let compactionSpinnerFrame = 0;
  const compactionSpinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  function stopCompactionSpinner(ctx: { ui?: ExtensionUIContext }): void {
    if (!compactionInProgress) return;
    compactionInProgress = false;
    if (compactionSpinnerTimer) {
      clearInterval(compactionSpinnerTimer);
      compactionSpinnerTimer = null;
    }
    ctx.ui?.setStatus("work-compaction", undefined);
    ctx.ui?.notify("✅ Work context compaction complete.", "info");
  }

  function startCompactionSpinner(ctx: { ui?: ExtensionUIContext }): void {
    if (compactionInProgress) return;
    compactionInProgress = true;
    compactionSpinnerFrame = 0;

    const render = () => {
      const frame = compactionSpinnerFrames[compactionSpinnerFrame % compactionSpinnerFrames.length];
      compactionSpinnerFrame += 1;
      ctx.ui?.setStatus("work-compaction", `${frame} compacting todo context`);
    };

    render();
    compactionSpinnerTimer = setInterval(render, 120);
    ctx.ui?.notify("🌀 Compacting work context...", "info");
  }

  /**
   * Compact current context and inject fresh instructions.
   * Used for phase transitions and TODO boundaries.
   */
  function compactAndInject(
    ctx: any,
    _label: string,
    summaryInstructions: string,
    injectMessage: string | null,
  ) {
    markCompaction();
    startCompactionSpinner(ctx);
    try {
      ctx.compact({
        customInstructions: summaryInstructions,
        onComplete: () => {
          markWork();
          stopCompactionSpinner(ctx);
          if (injectMessage) {
            pi.sendUserMessage(injectMessage);
          }
        },
        onError: () => {
          markWork();
          stopCompactionSpinner(ctx);
          if (injectMessage) {
            pi.sendUserMessage(injectMessage);
          }
        },
      });
    } catch {
      markWork();
      stopCompactionSpinner(ctx);
      if (injectMessage) {
        pi.sendUserMessage(injectMessage);
      }
    }
  }

  /** Create a visible todo branch in /tree and return its entry ID. */
  function branchForTodoContext(
    ctx: any,
    summary: string,
    options?: { fromId?: string | null; label?: string },
  ): string | null {
    try {
      const sm = ctx.sessionManager as any;
      const leafEntry = ctx.sessionManager.getLeafEntry?.();
      const branchPoint = options?.fromId ?? leafEntry?.id ?? ctx.sessionManager.getLeafId?.() ?? null;
      if (!branchPoint) {
        return ctx.sessionManager.getLeafId();
      }

      if (typeof sm.branchWithSummary === "function") {
        const summaryEntryId = sm.branchWithSummary(branchPoint, summary);
        const id = typeof summaryEntryId === "string"
          ? summaryEntryId
          : ctx.sessionManager.getLeafId();

        if (id && options?.label && typeof sm.appendLabelChange === "function") {
          sm.appendLabelChange(id, options.label);
        }

        return id;
      }

      if (typeof sm.branch === "function") {
        sm.branch(branchPoint);
      }

      return ctx.sessionManager.getLeafId();
    } catch {
      // Best effort: if branching fails, continue with compaction-only behavior.
      return ctx.sessionManager.getLeafId();
    }
  }

  function findLabeledEntryId(ctx: any, label: string): string | null {
    try {
      const sm = ctx.sessionManager as any;
      if (typeof sm.getEntries !== "function" || typeof sm.getLabel !== "function") {
        return null;
      }

      const entries = sm.getEntries() as Array<{ id: string }>;
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const id = entries[i]?.id;
        if (!id) continue;
        if (sm.getLabel(id) === label) return id;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Compact context after todo completion and start a fresh branch from todo start */
  function compactTodoDone(ctx: any) {
    const anchorId = findLabeledEntryId(ctx, "todo start");

    if (anchorId) {
      try {
        const currentLeaf = ctx.sessionManager.getLeafId();
        if (currentLeaf !== anchorId) {
          if (typeof ctx.sessionManager.branchWithSummary === "function") {
            ctx.sessionManager.branchWithSummary(
              anchorId,
              "Todo completed and approved. Implementation details were intentionally dropped; keep only work state and outcomes from _notes/worklog.md.",
            );
          } else if (typeof ctx.sessionManager.branch === "function") {
            ctx.sessionManager.branch(anchorId);
          }
        }
      } catch {
        // Best effort: fall back to compaction-only behavior.
      }
    }

    compactAndInject(
      ctx,
      "todo-done",
      "Todo completed and approved. Discard implementation details, keep work state.",
      null,
    );

    // Reset skill-manager session stats for the next TODO (keep active skills tracked)
    pi.events.emit(SKILL_EVENTS.RESET_SESSION, { keepActiveSkills: true } satisfies SkillResetSessionPayload);

    ctx.ui.notify("🌀 Done. Context reset. Check /tree for the refreshed todo branch.", "success");
  }

  /** Update the implement progress widget, or clear it if not in implement phase */
  function refreshProgressWidget(ctx: { ui: ExtensionUIContext }, notesDir: string | undefined, phase: string | null) {
    if (phase !== "implement" || !notesDir) {
      ctx.ui.setWidget("work-progress", undefined);
      return;
    }
    const lines = buildProgressWidget(notesDir);
    if (lines) {
      ctx.ui.setWidget("work-progress", lines, { placement: "aboveEditor" });
    }
  }

  /** Enter implement visual mode: collapse tools, show progress widget */
  function enterImplementVisuals(ctx: { ui: ExtensionUIContext }, notesDir: string) {
    toolsWereExpanded = ctx.ui.getToolsExpanded();
    ctx.ui.setToolsExpanded(false);
    refreshProgressWidget(ctx, notesDir, "implement");
  }

  /** Exit implement visual mode: restore tools, clear widget, restore model */
  function exitImplementVisuals(ctx: { ui: ExtensionUIContext; modelRegistry: any }) {
    if (toolsWereExpanded !== null) {
      ctx.ui.setToolsExpanded(toolsWereExpanded);
      toolsWereExpanded = null;
    }
    ctx.ui.setWidget("work-progress", undefined);

    // Restore opus after implement phase
    const opus = ctx.modelRegistry?.find?.("anthropic", "claude-opus-4-1");
    if (opus) {
      pi.setModel(opus);
    }
  }

  // --- Listen for atom's notes creation requests ---
  pi.events.on(WORK_EVENTS.CREATE_NOTES, (payload: CreateNotesPayload) => {
    try {
      const notesDir = ensureNotesDir(payload.targetDir);

      // Initialize worklog
      const worklogPath = path.join(notesDir, "worklog.md");
      if (!fs.existsSync(worklogPath)) {
        fs.writeFileSync(worklogPath, "# Work Log\n");
      }

      const ts = makeTimestamp();
      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() +
          `\n- ${ts}: Created _notes/ for subtask: ${payload.subtaskName}\n`,
      );

      commitNotes(notesDir, `init: notes for subtask ${payload.subtaskName}`);
      payload.resolve(notesDir);
    } catch (err: any) {
      payload.reject(err);
    }
  });

  // --- Atom subtask init request: initialize _notes + full work settings ---
  pi.events.on(WORK_EVENTS.SUBTASK_INIT_REQUEST, (payload: SubtaskInitRequestPayload) => {
    try {
      const notesDir = ensureNotesDir(payload.targetDir);
      const ts = makeTimestamp();

      const worklogPath = path.join(notesDir, "worklog.md");
      if (!fs.existsSync(worklogPath)) {
        fs.writeFileSync(worklogPath, "# Work Log\n");
      }

      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() +
          `\n- ${ts}: Atom requested subtask init: ${payload.subtaskName}` +
          `\n- ${ts}: Context source: ${payload.contextFile}\n`,
      );

      const sf = settingsPath(payload.targetDir);
      const current = readSettings(sf);
      const branch = payload.branch || current?.branch || "";
      updateSettings(sf, {
        phase: "plan",
        phaseBeforeTodo: null,
        workId: payload.workId || current?.workId || "",
        name: payload.name || current?.name || payload.subtaskName,
        status: "active",
        branch,
        worktreePath: null,
        worktreeBranch: null,
        approveCommits:
          payload.approveCommits ??
          current?.approveCommits ??
          true,
      });

      commitNotes(notesDir, `init: subtask ${payload.subtaskName} (atom)`);
      payload.resolve({ notesDir, settingsFile: sf });
    } catch (err: any) {
      payload.reject(err);
    }
  });


  // --- Plan phase guard: block file mutations outside _notes/ ---
  pi.on("tool_call", async (event, _ctx) => {
    if (currentPhase !== "plan") return;

    const notesDir = taskContext?.notesDir;
    if (!notesDir) return;

    let targetPath: string | undefined;

    if (event.toolName === "edit" || event.toolName === "write") {
      targetPath = (event.input as any).path;
    } else if (event.toolName === "bash") {
      const cmd = ((event.input as any).command || "").trim();
      const allowed = taskContext?.settings?.planAllowedCommands ?? DEFAULT_PLAN_ALLOWED_COMMANDS;
      const readOnly = allowed.some((prefix) => cmd === prefix || cmd.startsWith(prefix + " ") || cmd.startsWith(prefix + "\t") || cmd.startsWith(prefix + "\n"));
      if (!readOnly) {
        return {
          block: true,
          reason:
            "Plan phase: bash commands that modify files are not allowed. Only reading/inspecting is permitted. Write your plan in _notes/ using edit/write tools.",
        };
      }
      return;
    } else {
      return;
    }

    if (!targetPath) return;

    const resolved = path.resolve(targetPath);
    const notesResolved = path.resolve(notesDir);
    const settingsResolved = taskContext?.settingsFile
      ? path.resolve(taskContext.settingsFile)
      : null;

    // Allow writes to _notes/ and .pi/work.settings.json
    if (
      resolved.startsWith(notesResolved + path.sep) ||
      resolved === notesResolved ||
      (settingsResolved && resolved === settingsResolved)
    ) {
      return;
    }

    return {
      block: true,
      reason: `Plan phase: cannot modify files outside _notes/. Tried to ${event.toolName}: ${targetPath}. Add this to the plan instead.`,
    };
  });

  // --- Implement phase guard: only allow checking off TODOs in plan.md ---
  pi.on("tool_call", async (event, _ctx) => {
    if (currentPhase !== "implement") return;

    const notesDir = taskContext?.notesDir;
    if (!notesDir) return;

    if (event.toolName !== "edit" && event.toolName !== "write") return;

    const targetPath = (event.input as any).path;
    if (!targetPath) return;

    const resolved = path.resolve(targetPath);
    const planResolved = path.resolve(path.join(notesDir, "plan.md"));

    if (resolved !== planResolved) return;

    // Block write (full overwrite) to plan.md — only edit allowed
    if (event.toolName === "write") {
      return {
        block: true,
        reason: "Implement phase: cannot overwrite plan.md. Use edit to check off TODOs only: '- [ ]' → '- [x]'.",
      };
    }

    // For edit: only allow checking off TODOs
    const oldText: string = (event.input as any).oldText || "";
    const newText: string = (event.input as any).newText || "";

    // Check if this is a TODO checkbox toggle
    const isCheckoff =
      oldText.includes("- [ ]") &&
      newText.includes("- [x]") &&
      oldText.replace(/- \[ \]/g, "- [x]").trim() === newText.trim();

    if (!isCheckoff) {
      return {
        block: true,
        reason: "Implement phase: can only check off TODOs in plan.md ('- [ ]' → '- [x]'). Cannot add, remove, or rewrite plan items. Log issues in _notes/worklog.md instead.",
      };
    }
  });


  // --- Session Start ---
  pi.on("session_start", async (_event, ctx) => {
    taskContext = detectTaskContext(ctx.cwd);
    reportedOnStart = false;

    if (!taskContext) return;

    const { settings } = taskContext;
    currentSettingsFile = taskContext.settingsFile;
    if (settings.status === "active") {
      currentPhase = settings.phase;
      ctx.ui.setStatus("work", formatStatus(settings, settings.phase));
    }
  });

  // --- Before Agent Start: inject phase instructions + report ---
  pi.on("before_agent_start", async (event, ctx) => {
    const tc = detectTaskContext(ctx.cwd);
    if (tc) taskContext = tc;

    const result: { message?: any; systemPrompt?: string } = {};

    if (!reportedOnStart && taskContext) {
      reportedOnStart = true;
      // Skip summary display in plan phase — LLM should ask user, not recap
      if (taskContext.settings.phase !== "plan") {
        const report = formatTaskReport(taskContext);
        if (report) {
          result.message = {
            customType: "work-context",
            content: report,
            display: true,
          };
        }
      }
    }

    if (taskContext) {
      const { settings } = taskContext;
      if (settings.status === "active") {
        currentPhase = settings.phase;
        currentSettingsFile = taskContext.settingsFile;
        ctx.ui.setStatus("work", formatStatus(settings, settings.phase));

        result.systemPrompt =
          event.systemPrompt +
          routerInstructions(!!settings.approveCommits) +
          phaseInstructions(settings.phase, !!settings.approveCommits);
      }
    }

    // Record session start for stats
    if (taskContext) {
      recordSessionStart(taskContext.notesDir);
    }

    if (result.message || result.systemPrompt) return result;
  });

  // --- Token usage tracking: record every assistant turn ---
  pi.on("turn_end", async (event, _ctx) => {
    if (!taskContext) return;
    const msg = event.message;
    if (msg && "usage" in msg && msg.usage) {
      const u = msg.usage as { input: number; output: number; cacheRead: number; cost?: { total?: number } };
      recordUsage(taskContext.notesDir, {
        input: u.input || 0,
        output: u.output || 0,
        cacheRead: u.cacheRead || 0,
        cost: u.cost?.total || 0,
      });
    }
  });

  // Reset bucket to "work" when a new agent loop starts (after overhead/compaction injections)
  pi.on("agent_start", async (_event, _ctx) => {
    if (statsBucket === "overhead") {
      // The overhead turn was the injected message; now LLM is doing real work
      markWork();
    }
    todoDidWork = false; // reset per agent turn
  });

  // --- Insight/memory tool detection ---
  const insightToolPatterns = ["context_save", "context_load", "context_search", "qmd_search", "qmd_query", "qmd_get"];
  pi.on("tool_execution_start", async (event, _ctx) => {
    if (insightToolPatterns.some((p) => event.toolName.includes(p))) {
      statsBucket = "insight";
    }
  });
  pi.on("tool_execution_end", async (event, _ctx) => {
    if (insightToolPatterns.some((p) => event.toolName.includes(p))) {
      statsBucket = "work"; // restore after insight tool
    }
  });

  // --- Todo: track whether agent did real work ---
  pi.on("tool_execution_end", async (event, _ctx) => {
    if (currentPhase !== "todo") return;
    const mutating = ["edit", "write", "bash"];
    if (mutating.includes(event.toolName)) {
      todoDidWork = true;
    }
  });

  // --- Compaction tracking ---
  pi.on("session_compact", async (_event, _ctx) => {
    if (!taskContext) return;
    recordCompaction(taskContext.notesDir);
    markWork(); // compaction done, back to work
  });

  // --- Implement interrupt: user input during implement → ask continue or plan ---
  pi.on("input", async (event, ctx) => {
    if (event.source !== "interactive") return { action: "continue" as const };

    const tc = detectTaskContext(ctx.cwd);
    if (!tc) return { action: "continue" as const };
    if (tc.settings.phase !== "implement")
      return { action: "continue" as const };

    const { settings, settingsFile: sf, notesDir } = tc;
    const userText = event.text;

    // FIX / FIXUP prefix — pass through without dialog, LLM handles as fixup commit
    const fixupMatch = userText.match(/^(?:fix(?:up)?)\b[:\s]*(.*)/i);
    if (fixupMatch) {
      const ts = makeTimestamp();
      const worklogPath = path.join(notesDir, "worklog.md");
      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() +
          `\n- ${ts}: [FIXUP] ${userText.slice(0, 200)}\n`,
      );
      return { action: "continue" as const };
    }

    const choice = await ctx.ui.select(
      "You're interrupting implementation. What do you want?",
      [
        "💬 Answer implementer's question — continue implementing",
        "📋 Return to plan phase",
      ],
    );

    if (!choice || choice.startsWith("💬")) {
      // Log user input and let the message through to the implementer
      const ts = makeTimestamp();
      const worklogPath = path.join(notesDir, "worklog.md");
      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() +
          `\n- ${ts}: [USER] ${userText.slice(0, 200)}\n`,
      );
      return { action: "continue" as const };
    }

    // Return to plan
    const ts = makeTimestamp();

    const worklogPath = path.join(notesDir, "worklog.md");
    const existing = readFileOr(worklogPath, "# Work Log\n");
    fs.writeFileSync(
      worklogPath,
      existing.trimEnd() +
        `\n- ${ts}: Implement interrupted by user: ${userText.slice(0, 100)}\n`,
    );

    updateSettings(sf, { phase: "plan", worktreePath: null, worktreeBranch: null });

    currentPhase = "plan";
    ctx.ui.setStatus("work", formatStatus(settings, "plan"));

    // Feedback: plan was insufficient (implement→plan)
    pi.events.emit(SKILL_EVENTS.FEEDBACK, { skill: "work-plan", correct: false, reason: `implement→plan: ${userText.slice(0, 100)}` } satisfies SkillFeedbackPayload);

    // Emit return-to-plan event for skill-manager
    const planContent = readFileOr(path.join(notesDir, "plan.md"), "");
    pi.events.emit(WORK_EVENTS.RETURN_TO_PLAN, {
      reason: `Implement interrupted by user: "${userText}"`,
      notesDir,
      recentWorklog: worklogTail(notesDir, 20),
      planContent,
    } satisfies ReturnToPlanPayload);

    const skill = readSkillWithEvals("work-plan");
    const returnCtx = buildReturnToPlanContext(notesDir, `Implement interrupted by user: "${userText}"`);
    compactAndInject(
      ctx,
      "implement-interrupted",
      "Implementation interrupted by user. Summarize what was done.",
      skill + "\n\n---\n" + returnCtx,
    );

    return { action: "handled" as const };
  });


  // --- Verify: intercept after implement, show UI dialog ---
  pi.on("agent_end", async (_event, ctx) => {
    const tc = detectTaskContext(ctx.cwd);
    if (!tc) return;
    const { settings, settingsFile: sf, notesDir } = tc;

    if (settings.phase !== "verify") return;

    const ts = makeTimestamp();

    ctx.ui.setStatus("work", formatStatus(settings, "verify"));

    const choice = await ctx.ui.select(
      "Implementation complete. Verify result:",
      [
        "✅ Approve — all criteria met",
        "❌ Wrong approach — needs different strategy",
        "❌ Incomplete — missing requirements",
        "❌ Bugs — tests failing or incorrect behavior",
        "❌ Overcomplicated — simpler solution needed",
        "❌ Other reason",
      ],
    );

    if (choice?.startsWith("✅")) {
      const worklogPath = path.join(notesDir, "worklog.md");
      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() + `\n- ${ts}: Verify: approved\n`,
      );

      // Transition to "verified" so the dialog doesn't re-trigger on next agent_end
      updateSettings(sf, { phase: "verified" });
      currentPhase = "verified";
      ctx.ui.setStatus("work", formatStatus(settings, "verified"));

      // Feedback: plan and implement skills worked correctly
      pi.events.emit(SKILL_EVENTS.FEEDBACK, { skill: "work-plan", correct: true, reason: "verify approved" } satisfies SkillFeedbackPayload);
      pi.events.emit(SKILL_EVENTS.FEEDBACK, { skill: "work-implement", correct: true, reason: "verify approved" } satisfies SkillFeedbackPayload);

      ctx.ui.notify(
        "Approved! Run /work:done to finish, or /atom:pr for PRs.",
        "success",
      );
      return;
    }

    let reason = "interrupted";
    if (choice) {
      reason = choice.replace(/^❌\s*/, "").replace(/\s*—.*$/, "");
      if (reason === "Other reason") {
        const custom = await ctx.ui.input("Rejection reason:");
        if (custom) reason = custom;
      }
    }

    // For bugs or custom reasons, offer going straight to implement
    let goToImplement = false;
    if (choice && (choice.includes("Bugs") || choice.includes("Other reason"))) {
      const fixNow = await ctx.ui.select(
        "This looks like a fixable issue. Go straight to implement?",
        ["🔧 Yes — fix it now", "📋 No — return to plan first"],
      );
      goToImplement = fixNow === "🔧 Yes — fix it now";
    }

    const targetPhase = goToImplement ? "implement" : "plan";

    const worklogPath = path.join(notesDir, "worklog.md");
    const existing = readFileOr(worklogPath, "# Work Log\n");
    fs.writeFileSync(
      worklogPath,
      existing.trimEnd() + `\n- ${ts}: Verify: rejected — ${reason} → ${targetPhase}\n`,
    );

    updateSettings(sf, {
      phase: targetPhase,
      worktreePath: null,
      worktreeBranch: null,
    });

    currentPhase = targetPhase;
    ctx.ui.setStatus("work", formatStatus(settings, targetPhase));

    // Feedback: implement skill failed (verify rejected)
    pi.events.emit(SKILL_EVENTS.FEEDBACK, { skill: "work-implement", correct: false, reason: `verify rejected: ${reason}` } satisfies SkillFeedbackPayload);

    // Emit return-to-plan event for skill-manager (even if going to implement — skills may need review)
    if (targetPhase === "plan") {
      // Feedback: plan was insufficient (verify rejected → plan)
      pi.events.emit(SKILL_EVENTS.FEEDBACK, { skill: "work-plan", correct: false, reason: `verify rejected→plan: ${reason}` } satisfies SkillFeedbackPayload);

      const planContent = readFileOr(path.join(notesDir, "plan.md"), "");
      pi.events.emit(WORK_EVENTS.RETURN_TO_PLAN, {
        reason: `Verify rejected: "${reason}"`,
        notesDir,
        recentWorklog: worklogTail(notesDir, 20),
        planContent,
      } satisfies ReturnToPlanPayload);
    }

    if (goToImplement) {
      // Switch to sonnet for implement phase
      const sonnet = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-6");
      if (sonnet) await pi.setModel(sonnet);

      ctx.ui.notify(`Returning to implement — fix: ${reason}`, "warning");
      const skill = readSkillWithEvals("work-implement");
      const implCtx = buildImplementContext(notesDir, `**Verify rejected by user. Fix this issue:**\n\n${reason}`);
      compactAndInject(
        ctx,
        "verify-rejected-fix",
        `Verify rejected: "${reason}". Branching to fix.`,
        skill + "\n\n---\n" + implCtx,
      );
    } else {
      ctx.ui.notify(`Returning to plan — reason: ${reason}`, "warning");
      const skill = readSkillWithEvals("work-plan");
      const returnCtx = buildReturnToPlanContext(notesDir, `Verify rejected by user: "${reason}"`);
      compactAndInject(
        ctx,
        "verify-rejected-plan",
        `Verify rejected: "${reason}". Returning to plan.`,
        skill + "\n\n---\n" + returnCtx,
      );
    }
  });

  // --- Todo: post-action menu ---
  pi.on("agent_end", async (_event, ctx) => {
    const tc = detectTaskContext(ctx.cwd);
    if (!tc) return;
    const { settings, settingsFile: sf, notesDir } = tc;

    if (settings.phase !== "todo") return;

    // Only show menu if the agent actually did work (edits, writes, bash).
    // If it just asked a question, let the user respond normally.
    if (!todoDidWork) return;

    const choice = await ctx.ui.select(
      "✨ Todo action completed",
      [
        "👍 Looks good — proceed to next task",
        "📦 Looks good — commit and proceed to next task",
        "🔧 Continue — I have more instructions",
      ],
    );

    if (choice && choice.includes("commit and proceed")) {
      // Commit staged changes, then branch
      const ts = makeTimestamp();
      const worklogPath = path.join(notesDir, "worklog.md");
      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() + `\n- ${ts}: [todo] User approved — committing and proceeding\n`,
      );

      // Ask for commit message and commit
      const commitMsg = await ctx.ui.input("Commit message:");
      if (commitMsg && commitMsg.trim()) {
        try {
          const { execSync } = require("node:child_process");
          execSync(`git add -A && git commit -m "${commitMsg.trim().replace(/"/g, '\\"')}"`, {
            cwd: ctx.cwd,
            stdio: "pipe",
          });
          ctx.ui.notify(`Committed: ${commitMsg.trim()}`, "success");
        } catch (err: any) {
          ctx.ui.notify(`Commit failed: ${err.message}`, "error");
        }
      }

      // Branch off in session tree + reset context
      compactTodoDone(ctx);
      return;
    }

    if (!choice || choice.includes("proceed to next task")) {
      const ts = makeTimestamp();
      const worklogPath = path.join(notesDir, "worklog.md");
      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() + `\n- ${ts}: [todo] User approved result\n`,
      );

      compactTodoDone(ctx);
      return;
    }

    // Continue — ask for instructions, keep context
    const userInput = await ctx.ui.input("What else needs to be done?");
    if (!userInput || !userInput.trim()) {
      ctx.ui.notify("No input — staying in todo.", "info");
      return;
    }

    const ts = makeTimestamp();
    const worklogPath = path.join(notesDir, "worklog.md");
    const existing = readFileOr(worklogPath, "# Work Log\n");
    fs.writeFileSync(
      worklogPath,
      existing.trimEnd() + `\n- ${ts}: [todo] Continue: ${userInput.slice(0, 200)}\n`,
    );

    // Send the user's follow-up directly — no compaction, keep full context
    pi.sendUserMessage(userInput);
  });

  // --- Commands ---

  function registerWorkCommand(
    name: string,
    description: string,
    contentFn: () => string,
  ) {
    pi.registerCommand(name, {
      description,
      handler: async (args, _ctx) => {
        const content = contentFn();
        if (!content) {
          _ctx.ui.notify(`Work: skill file not found for ${name}`, "error");
          return;
        }
        const extra = args ? `\n\nUser says: ${args}` : "";
        pi.sendUserMessage(content + extra);
      },
    });
  }

  // --- /work:start — create _notes/ with git, init settings, switch to plan ---
  pi.registerCommand("work:start", {
    description: "Begin new work — creates _notes/ (git-tracked), switches to plan",
    handler: async (_args, ctx) => {
      const { execSync } = require("node:child_process");

      // If _notes/ exists, verify full setup first.
      const notesDir = path.join(ctx.cwd, "_notes");
      if (fs.existsSync(notesDir)) {
        const issues: string[] = [];
        const worklogPath = path.join(notesDir, "worklog.md");
        const notesGitDir = path.join(notesDir, ".git");
        const sfExisting = settingsPath(ctx.cwd);
        const settingsExisting = readSettings(sfExisting);

        if (!fs.existsSync(worklogPath)) issues.push("missing _notes/worklog.md");
        if (!fs.existsSync(notesGitDir)) issues.push("missing _notes/.git");
        if (!fs.existsSync(sfExisting)) issues.push("missing .pi/work.settings.json");
        if (!settingsExisting) {
          issues.push("invalid .pi/work.settings.json");
        } else if (settingsExisting.status !== "active") {
          issues.push(`work status is '${settingsExisting.status}', expected 'active'`);
        }

        if (issues.length === 0 && settingsExisting) {
          currentPhase = settingsExisting.phase;
          currentSettingsFile = sfExisting;
          taskContext = detectTaskContext(ctx.cwd);

          ctx.ui.setStatus("work", formatStatus(settingsExisting, settingsExisting.phase));
          ctx.ui.notify("Work already initialized — setup verified. Keeping current context.", "info");
          return;
        }

        ctx.ui.notify(
          `Existing _notes/ detected but setup is incomplete (${issues.join(", ")}). Repairing setup...`,
          "warning",
        );
      }

      // Detect branch
      let branch = "unknown";
      let workId = "";
      let slug = "";
      try {
        branch = execSync("git branch --show-current", {
          cwd: ctx.cwd,
          encoding: "utf-8",
        }).trim();

        // Parse work-id from branch: MILAB-1234-fix-auth → workId=MILAB-1234, slug=fix-auth
        const match = branch.match(/^([A-Z]+-\d+)-(.+)$/);
        if (match) {
          workId = match[1];
          slug = match[2].replace(/-/g, " ");
        } else {
          workId = branch;
          slug = branch.replace(/-/g, " ");
        }
      } catch {
        /* no git */
      }

      const name = slug || workId || "unnamed work";
      const ts = makeTimestamp();

      // Create _notes/ with git init
      const nd = ensureNotesDir(ctx.cwd);

      // Create or update worklog without clobbering existing history
      const worklogPath = path.join(nd, "worklog.md");
      if (!fs.existsSync(worklogPath)) {
        fs.writeFileSync(
          worklogPath,
          `# Work Log\n\n- ${ts}: Work initialized\n`,
        );
      } else {
        const existing = readFileOr(worklogPath, "# Work Log\n");
        fs.writeFileSync(
          worklogPath,
          existing.trimEnd() + `\n- ${ts}: Work initialized via /work:start\n`,
        );
      }

      // Commit initial state
      commitNotes(nd, "init: work notes created");

      // Create/update settings
      const sf = settingsPath(ctx.cwd);
      const settingsDir = path.dirname(sf);
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
      }
      updateSettings(sf, {
        phase: "plan",
        workId,
        name,
        status: "active",
        branch,
        phaseBeforeTodo: null,
        approveCommits: true,
      });

      currentPhase = "plan";
      currentSettingsFile = sf;
      taskContext = detectTaskContext(ctx.cwd);

      ctx.ui.setStatus("work", formatStatus({ workId, name }, "plan"));
      ctx.ui.notify(`Work initialized: ${workId || name}. Phase: plan.`, "success");

      // Inject plan skill to start planning
      const skill = readSkillWithEvals("work-plan");
      pi.sendUserMessage(
        skill +
          `\n\n---\nWork just initialized. \`_notes/\` created with git tracking.\n` +
          `**Branch:** ${branch}\n**Work ID:** ${workId || "(none)"}\n\n` +
          `You are now in **plan phase**. Ask the user what they want to accomplish.\n` +
          `Write their answer as description, acceptance criteria, and plan items in \`_notes/plan.md\`.\n` +
          `Do NOT execute anything — only plan.`,
      );
    },
  });

  pi.registerCommand("work:cancel", {
    description: "Disable work plugin logic for current workspace",
    handler: async (_args, ctx) => {
      const sf = currentSettingsFile || findSettings(ctx.cwd);
      if (!sf) {
        ctx.ui.notify("No work settings found (.pi/work.settings.json).", "error");
        return;
      }

      const settings = readSettings(sf);
      if (!settings) {
        ctx.ui.notify(`Could not read work settings: ${sf}`, "error");
        return;
      }

      updateSettings(sf, {
        status: "done",
        phaseBeforeTodo: null,
      });

      // Best-effort audit entry
      const notesDir = path.join(taskDirFromSettings(sf), "_notes");
      const worklogPath = path.join(notesDir, "worklog.md");
      if (fs.existsSync(worklogPath)) {
        const ts = makeTimestamp();
        const existing = readFileOr(worklogPath, "# Work Log\n");
        fs.writeFileSync(
          worklogPath,
          existing.trimEnd() + `\n- ${ts}: Work cancelled via /work:cancel (plugin deactivated)\n`,
        );
      }

      currentPhase = null;
      taskContext = null;
      currentSettingsFile = null;
      markWork();
      exitImplementVisuals(ctx);
      ctx.ui.setStatus("work", "");
      ctx.ui.notify("Work plugin deactivated for this workspace. Use work_state to set status=active to re-enable.", "success");
    },
  });

  registerWorkCommand(
    "work:status",
    "Show raw work note for current branch",
    () => readCommand("work-status"),
  );

  pi.registerCommand("work:done", {
    description: "Mark work complete",
    handler: async (_args, ctx) => {
      const sf = currentSettingsFile || findSettings(ctx.cwd);
      if (!sf) {
        ctx.ui.notify("No work settings found (.pi/work.settings.json).", "error");
        return;
      }

      const settings = readSettings(sf);
      if (!settings) {
        ctx.ui.notify(`Could not read work settings: ${sf}`, "error");
        return;
      }

      updateSettings(sf, { status: "done" });

      currentPhase = null;
      taskContext = null;
      currentSettingsFile = null;
      markWork();
      exitImplementVisuals(ctx);
      ctx.ui.setStatus("work", "");
      ctx.ui.notify("Work marked done.", "success");
    },
  });

  registerWorkCommand(
    "work:help",
    "Show work-manager usage guide",
    () => readCommand("work-help"),
  );

  // --- /work:stats — show token usage stats ---
  pi.registerCommand("work:stats", {
    description: "Show token usage statistics for current work",
    handler: async (_args, ctx) => {
      const tc = taskContext || detectTaskContext(ctx.cwd);
      if (!tc) {
        ctx.ui.notify("No active work found.", "error");
        return;
      }
      const stats = readStats(tc.notesDir);
      const report = formatStats(stats);
      ctx.ui.notify(report, "info");
    },
  });

  registerWorkCommand(
    "work:install",
    "Guided setup — plugin, QMD, mise, task scripts",
    () => readSkill("work-install"),
  );

  // --- /work:todo ---
  pi.registerCommand("work:todo", {
    description: "Enter todo phase (ordinary chat) and optionally run one request",
    handler: async (args, ctx) => {
      const tc = detectTaskContext(ctx.cwd);
      if (!tc) {
        ctx.ui.notify("No active work context found", "error");
        return;
      }

      const { settings, settingsFile: sf, notesDir } = tc;
      const previousPhase = settings.phase;
      const todoText = (args || "").trim();

      if (previousPhase !== "todo") {
        updateSettings(sf, { phase: "todo", phaseBeforeTodo: previousPhase });
        currentPhase = "todo";
        ctx.ui.setStatus("work", formatStatus(settings, `todo ← ${previousPhase}`));

        const ts = makeTimestamp();
        const worklogPath = path.join(notesDir, "worklog.md");
        const existing = readFileOr(worklogPath, "# Work Log\n");
        const transitionLine = `\n- ${ts}: Phase transition: ${previousPhase} → todo`;
        const todoLine = todoText ? `\n- ${ts}: [todo] ${todoText}` : "";
        fs.writeFileSync(
          worklogPath,
          existing.trimEnd() + transitionLine + todoLine + "\n",
        );

        // Create a labeled todo start branch in the tree, then enter todo
        branchForTodoContext(ctx, "TODO mode ON", { label: "todo start" });
        ctx.ui.notify("Entering todo phase...", "info");
        compactAndInject(
          ctx,
          `todo-from-${previousPhase}`,
          `Switching from ${previousPhase} to todo phase. Summarize progress so far.`,
          todoText || null,
        );
        if (!todoText) {
          ctx.ui.notify("Entered todo phase. Chat normally; use /work:plan to return.", "success");
        }
      } else {
        // todo → todo: reset context to start fresh
        const ts = makeTimestamp();
        const worklogPath = path.join(notesDir, "worklog.md");
        const existing = readFileOr(worklogPath, "# Work Log\n");
        fs.writeFileSync(
          worklogPath,
          existing.trimEnd() + `\n- ${ts}: [todo] Context reset via /work:todo\n`,
        );

        branchForTodoContext(ctx, "TODO context reset", { label: "todo start" });
        ctx.ui.notify("Resetting todo context from current point...", "info");
        compactAndInject(
          ctx,
          "todo-reset",
          "Todo context reset. Summarize what was done.",
          todoText || null,
        );
        if (!todoText) {
          ctx.ui.notify("Todo context reset. Chat normally.", "success");
        }
      }
    },
  });

  // --- /work:plan ---
  pi.registerCommand("work:plan", {
    description: "Enter plan phase (from verify, research, or todo)",
    handler: async (args, ctx) => {
      const tc = detectTaskContext(ctx.cwd);
      if (!tc) {
        ctx.ui.notify("No active work context found", "error");
        return;
      }
      const { settings, settingsFile: sf, notesDir } = tc;
      const allowed = ["research", "verify", "verified", "plan", "todo", "implement"];
      if (!allowed.includes(settings.phase)) {
        ctx.ui.notify(
          `Cannot go to plan from ${settings.phase}. Allowed from: ${allowed.join(", ")}`,
          "error",
        );
        return;
      }

      updateSettings(sf, { phase: "plan", phaseBeforeTodo: null });

      const ts = makeTimestamp();
      const worklogPath = path.join(notesDir, "worklog.md");
      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() +
          `\n- ${ts}: Phase transition: ${settings.phase} → plan\n`,
      );

      commitNotes(notesDir, `plan: return from ${settings.phase} phase`);

      currentPhase = "plan";
      ctx.ui.setStatus("work", formatStatus(settings, "plan"));

      const skill = readSkillWithEvals("work-plan");
      const extra = args ? `\n\nUser feedback: ${args}` : "";
      pi.sendUserMessage(
        skill +
          "\n\n---\nPhase transitioned to **plan**. Review the current plan and acceptance criteria." +
          extra,
      );
    },
  });

  // --- /work:implement ---
  pi.registerCommand("work:implement", {
    description:
      "Enter implement phase — LLM executes autonomously",
    handler: async (args, ctx) => {
      const tc = detectTaskContext(ctx.cwd);
      if (!tc) {
        ctx.ui.notify("No active work context found", "error");
        return;
      }
      const { settings, settingsFile: sf, notesDir } = tc;
      if (settings.phase !== "plan") {
        ctx.ui.notify(
          `Can only enter implement from plan phase (current: ${settings.phase})`,
          "error",
        );
        return;
      }

      // Validate plan has acceptance criteria
      const planPath = path.join(notesDir, "plan.md");
      const planContent = readFileOr(planPath, "");
      if (!planContent) {
        ctx.ui.notify("Cannot implement: _notes/plan.md does not exist. Write a plan first.", "error");
        return;
      }
      if (!/## Acceptance Criteria/.test(planContent)) {
        ctx.ui.notify("Cannot implement: plan.md is missing Acceptance Criteria section.", "error");
        return;
      }
      // Check there's at least one criterion
      const criteriaSection = planContent.split("## Acceptance Criteria")[1]?.split(/\n## /)[0] || "";
      if (!/- \[[ x]\]/.test(criteriaSection)) {
        ctx.ui.notify("Cannot implement: Acceptance Criteria section has no items.", "error");
        return;
      }

      const ts = makeTimestamp();

      // Auto-commit _notes/ before entering implement
      commitNotes(notesDir, `plan: save plan before starting implementation`);

      updateSettings(sf, {
        phase: "implement",
        worktreePath: null,
        worktreeBranch: null,
      });

      const worklogPath = path.join(notesDir, "worklog.md");
      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() +
          `\n- ${ts}: Phase transition: plan → implement\n`,
      );

      currentPhase = "implement";

      // Switch to sonnet for implement phase
      const sonnet = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-6");
      if (sonnet) {
        await pi.setModel(sonnet);
        ctx.ui.notify("Switched to Sonnet for implement phase.", "info");
      }

      ctx.ui.setStatus("work", formatStatus(settings, "implement"));
      ctx.ui.notify("Implement phase started in current branch.", "info");

      const focusExtra = args ? `**Focus:** ${args}` : undefined;

      // Branch off plan context and start fresh for implementation
      const skill = readSkillWithEvals("work-implement");
      const implCtx = buildImplementContext(notesDir, focusExtra);
      compactAndInject(
        ctx,
        "plan-to-implement",
        "Plan phase completed. Entering implement phase.",
        skill + "\n\n---\n" + implCtx,
      );
    },
  });

  // --- Tool: work_state ---
  pi.registerTool({
    name: "work_state",
    label: "Work State",
    description: "Read or update work state in .pi/work.settings.json",
    promptSnippet:
      "Read or update work state (phase, status, workId, name, etc.)",
    parameters: Type.Object({
      action: StringEnum(["read", "update"] as const, {
        description:
          "read: return current state; update: merge provided fields",
      }),
      updates: Type.Optional(
        Type.Object(
          {
            phase: Type.Optional(
              Type.String({
                description:
                  "Phase: research, plan, implement, verify, todo",
              }),
            ),
            phaseBeforeTodo: Type.Optional(
              Type.Union([Type.String(), Type.Null()]),
            ),
            workId: Type.Optional(Type.String()),
            name: Type.Optional(Type.String()),
            status: Type.Optional(
              Type.String({ description: "active or done" }),
            ),
            branch: Type.Optional(Type.String()),
            approveCommits: Type.Optional(
              Type.Boolean({ description: "Require user approval before each commit in implement phase" }),
            ),
            planAllowedCommands: Type.Optional(
              Type.Array(Type.String(), { description: "Commands allowed in plan phase (prefix match). e.g. ['gh api', 'git log']" }),
            ),
          },
          { description: "Fields to update (only for action=update)" },
        ),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sf = currentSettingsFile || findSettings(ctx.cwd);
      if (!sf) {
        throw new Error(
          "No work context found — no .pi/work.settings.json in cwd or subdirs",
        );
      }

      if (params.action === "read") {
        const settings = readSettings(sf);
        if (!settings) {
          throw new Error(`Could not read ${sf}`);
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(settings, null, 2),
            },
          ],
          details: { settings, path: sf },
        };
      }

      if (!params.updates || Object.keys(params.updates).length === 0) {
        throw new Error("No fields provided to update");
      }

      const cleanUpdates: Partial<WorkSettings> = {};
      for (const [k, v] of Object.entries(params.updates)) {
        if (v !== undefined) {
          (cleanUpdates as any)[k] = v;
        }
      }

      const updated = updateSettings(sf, cleanUpdates);

      if (updated.phase) {
        currentPhase = updated.phase;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Updated .pi/work.settings.json:\n${JSON.stringify(updated, null, 2)}`,
          },
        ],
        details: { settings: updated, path: sf },
      };
    },
  });

  // --- Tool: work_compact ---
  pi.registerTool({
    name: "work_compact",
    label: "Work Compact",
    description:
      "Signal TODO completion during implement phase. Branches the session tree and injects fresh context for the next TODO. You MUST provide learnings about code patterns, tools, and approaches discovered during this TODO — they are persisted for the next implementer.",
    promptSnippet:
      "Signal TODO completion. Call after each TODO is committed during implement phase. MUST include learnings.",
    parameters: Type.Object({
      summary: Type.String({
        description:
          "Brief summary of what was just completed (e.g. 'Implemented token refresh endpoint, tests passing')",
      }),
      learnings: Type.String({
        description:
          "Code understanding notes for the next implementer. Include: key file paths and their roles, function signatures and contracts, data flows, gotchas/edge cases, test patterns used, tools/commands that worked. Be specific — the next implementer starts with zero context.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const tc = taskContext || detectTaskContext(ctx.cwd);

      // Emit TODO completed event for skill-manager
      if (tc) {
        pi.events.emit(WORK_EVENTS.TODO_COMPLETED, {
          summary: params.summary,
          notesDir: tc.notesDir,
          recentWorklog: worklogTail(tc.notesDir, 15),
        } satisfies TodoCompletedPayload);
      }

      if (!tc) {
        return { content: [{ type: "text" as const, text: "No active work context." }] };
      }

      const { notesDir, settingsFile: sf, settings } = tc;

      // Persist learnings for next implementer
      if (params.learnings && params.learnings.trim()) {
        const learningsPath = path.join(notesDir, "impl-learnings.md");
        const ts = makeTimestamp();
        const existing = readFileOr(learningsPath, "# Implementation Learnings\n\nNotes from each TODO for the next implementer.\n");
        const entry = [
          `\n## TODO: ${params.summary} (${ts})`,
          "",
          params.learnings.trim(),
          "",
        ].join("\n");
        fs.writeFileSync(learningsPath, existing.trimEnd() + "\n" + entry + "\n");
        commitNotes(notesDir, `learnings: ${params.summary.slice(0, 50)}`);
      }

      // Show per-TODO verify dialog
      const planContent = readFileOr(path.join(notesDir, "plan.md"), "");
      const todos = parseTodos(planContent);
      const done = todos.filter((t) => t.done).length;
      const total = todos.length;
      const ts2 = makeTimestamp();

      const header = `TODO ${done}/${total} done. Just completed: ${params.summary}`;

      const choice = await ctx.ui.select(
        header,
        [
          "✅ Approve — continue to next TODO",
          "❌ Wrong approach — needs different strategy",
          "❌ Incomplete — missing requirements",
          "❌ Bugs — tests failing or incorrect behavior",
          "❌ Overcomplicated — simpler solution needed",
          "❌ Other reason",
        ],
      );

      if (!choice || choice.startsWith("✅")) {
        // Approved — branch off TODO work and continue
        const worklogPath = path.join(notesDir, "worklog.md");
        const existing = readFileOr(worklogPath, "# Work Log\n");
        fs.writeFileSync(
          worklogPath,
          existing.trimEnd() + `\n- ${ts2}: TODO approved: ${params.summary}\n`,
        );

        const skill = readSkillWithEvals("work-implement");
        const implCtx = buildImplementContext(
          notesDir,
          `**Just completed:** ${params.summary}\n\nContinue with the next unchecked TODO.`,
        );
        compactAndInject(
          ctx,
          `todo-${done}-done`,
          `TODO completed: "${params.summary}". Branching to next TODO.`,
          skill + "\n\n---\n" + implCtx,
        );

        return { content: [{ type: "text" as const, text: `TODO approved. Branched to next TODO.` }] };
      }

      // Rejected — extract reason
      let reason = "interrupted";
      if (choice) {
        reason = choice.replace(/^❌\s*/, "").replace(/\s*—.*$/, "");
        if (reason === "Other reason") {
          const custom = await ctx.ui.input("Rejection reason:");
          if (custom) reason = custom;
        }
      }

      // For bugs or custom reasons, offer going straight back to fix
      let goToFix = false;
      if (choice && (choice.includes("Bugs") || choice.includes("Other reason"))) {
        const fixNow = await ctx.ui.select(
          "This looks like a fixable issue. Go straight to fixing it?",
          ["🔧 Yes — fix it now", "📋 No — return to plan first"],
        );
        goToFix = fixNow === "🔧 Yes — fix it now";
      }

      const worklogPath = path.join(notesDir, "worklog.md");
      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() + `\n- ${ts2}: TODO rejected — ${reason}${goToFix ? " → fix in implement" : " → plan"}\n`,
      );

      if (goToFix) {
        // Stay in implement, branch and re-do this TODO
        const skill = readSkillWithEvals("work-implement");
        const implCtx = buildImplementContext(
          notesDir,
          `**TODO rejected by user. Fix this issue:**\n\n${reason}\n\nRe-implement the current TODO.`,
        );
        compactAndInject(
          ctx,
          `todo-${done}-fix`,
          `TODO rejected: "${reason}". Branching to fix.`,
          skill + "\n\n---\n" + implCtx,
        );
        return { content: [{ type: "text" as const, text: `Branched to fix: ${reason}` }] };
      }

      // Return to plan
      updateSettings(sf, { phase: "plan", worktreePath: null, worktreeBranch: null });
      currentPhase = "plan";
      ctx.ui.setStatus("work", formatStatus(settings, "plan"));
      exitImplementVisuals(ctx);

      ctx.ui.notify(`Returning to plan — reason: ${reason}`, "warning");
      const skill = readSkillWithEvals("work-plan");
      const returnCtx = buildReturnToPlanContext(notesDir, `TODO rejected by user: "${reason}"`);
      compactAndInject(
        ctx,
        `todo-${done}-rejected`,
        `TODO rejected: "${reason}". Returning to plan.`,
        skill + "\n\n---\n" + returnCtx,
      );

      return { content: [{ type: "text" as const, text: `TODO rejected. Returning to plan.` }] };
    },
  });

  // --- Session Shutdown ---
  pi.on("session_shutdown", async (_event, ctx) => {
    stopCompactionSpinner(ctx);
    const ts = makeTimestamp();
    const tc = taskContext || detectTaskContext(ctx.cwd);

    if (tc) {
      const { settings, notesDir } = tc;
      if (settings.status !== "active") return;
      const worklogPath = path.join(notesDir, "worklog.md");
      try {
        const existing = readFileOr(worklogPath, "# Work Log\n");
        fs.writeFileSync(
          worklogPath,
          existing.trimEnd() +
            `\n- ${ts}: Session ended (phase: ${settings.phase})\n`,
        );
        commitNotes(notesDir, `session: save state before exit (${settings.phase})`);
      } catch {
        /* best effort */
      }
    }
  });
}

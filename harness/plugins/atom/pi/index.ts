/**
 * Atom Extension for Pi
 *
 * Execution, subtask management, and operational commands.
 * Commands: atom:init, atom:create, atom:done, atom:pr, atom:compact, atom:update, atom:recall
 * Uses work-style _notes/ planning in task and subtask workspaces.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  type WorkSettings,
  findSettings,
  readSettings,
  settingsPath,
  taskDirFromSettings,
} from "../../work/pi/state";
import { WORK_EVENTS } from "../../work/pi/events";

const ATOM_ROOT = path.join(process.env.HOME || "~", ".pi/agent/extensions/atom");

// --- Helpers ---

function readFileOr(filePath: string, fallback: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return fallback;
  }
}

function readPrompt(name: string): string {
  const p = path.join(ATOM_ROOT, "prompts", `${name}.md`);
  return readFileOr(p, "");
}

function makeTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFile(filePath: string, content: string): boolean {
  if (fs.existsSync(filePath)) return false;
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
  return true;
}

// --- Subtask context detection ---

interface SubtaskState {
  name: string;
  description: string;
  criteria: string;
  sourceFile: "TASK.md" | "_notes/plan.md";
  parentSettingsPath: string | null;
}

interface SubtaskContext {
  kind: "subtask";
  subtask: SubtaskState;
  parentSettings: WorkSettings | null;
}

function extractPlanSection(content: string, section: string): string {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`## ${escaped}\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = content.match(re);
  return match ? match[1].trim() : "";
}

function detectSubtask(cwd: string): SubtaskState | null {
  const taskMdPath = path.join(cwd, "TASK.md");
  const planMdPath = path.join(cwd, "_notes", "plan.md");

  let sourceFile: "TASK.md" | "_notes/plan.md" | null = null;
  let content = "";

  if (fs.existsSync(planMdPath)) {
    sourceFile = "_notes/plan.md";
    content = readFileOr(planMdPath, "");
  } else if (fs.existsSync(taskMdPath)) {
    sourceFile = "TASK.md";
    content = readFileOr(taskMdPath, "");
  } else {
    return null;
  }

  const subtaskName = path.basename(cwd);
  const parentDir = path.dirname(path.dirname(cwd)); // up from subtasks/<name>

  const parentSp = settingsPath(parentDir);
  const hasParent = fs.existsSync(parentSp);

  const description = extractPlanSection(content, "Description");
  const criteria = extractPlanSection(content, "Acceptance Criteria");

  return {
    name: subtaskName,
    description,
    criteria,
    sourceFile,
    parentSettingsPath: hasParent ? parentSp : null,
  };
}

function detectSubtaskContext(cwd: string): SubtaskContext | null {
  const subtask = detectSubtask(cwd);
  if (!subtask) return null;

  const parentSettings = subtask.parentSettingsPath
    ? readSettings(subtask.parentSettingsPath)
    : null;

  return { kind: "subtask", subtask, parentSettings };
}

function formatSubtaskReport(sc: SubtaskContext): string {
  const { subtask, parentSettings } = sc;
  const lines: string[] = [`## 🔧 Active Subtask: ${subtask.name}`, ""];
  if (parentSettings) {
    lines.push(
      `**Parent work:** ${parentSettings.workId || parentSettings.name} [${parentSettings.phase}]`,
      "",
    );
  }
  if (subtask.description) {
    lines.push(`**Description:** ${subtask.description}`, "");
  }
  if (subtask.criteria) {
    lines.push("**Acceptance Criteria:**", subtask.criteria, "");
  }
  const contextFile = subtask.sourceFile;
  lines.push("---", "", `Read \`${contextFile}\` for full task details.`);

  if (contextFile === "TASK.md") {
    lines.push("Write results to `## Results` section when done.");
  } else {
    lines.push(
      "Track progress in `_notes/plan.md` checkboxes and summarize key outcomes in `_notes/worklog.md`.",
    );
  }
  return lines.join("\n");
}

// --- Extension Entry ---

export default function (pi: ExtensionAPI) {
  let subtaskContext: SubtaskContext | null = null;
  let reportedOnStart = false;

  // --- Session Start: detect subtask context ---
  pi.on("session_start", async (_event, ctx) => {
    subtaskContext = detectSubtaskContext(ctx.cwd);
    reportedOnStart = false;

    if (!subtaskContext) return;

    const { subtask, parentSettings } = subtaskContext;
    const parentLabel = parentSettings
      ? `${parentSettings.workId || parentSettings.name}`
      : "unknown";
    ctx.ui.setStatus("atom", `🔧 ${subtask.name} (${parentLabel})`);
  });

  // --- Before Agent Start: inject subtask instructions + report ---
  pi.on("before_agent_start", async (event, ctx) => {
    const sc = detectSubtaskContext(ctx.cwd);
    if (sc) subtaskContext = sc;

    if (!subtaskContext) return;

    const result: { message?: any; systemPrompt?: string } = {};

    if (!reportedOnStart) {
      reportedOnStart = true;
      const report = formatSubtaskReport(subtaskContext);
      if (report) {
        result.message = {
          customType: "atom-context",
          content: report,
          display: true,
        };
      }
    }

    const { subtask } = subtaskContext;
    const scopeFile = subtask.sourceFile;
    const completionInstruction =
      scopeFile === "TASK.md"
        ? "Write results to the `## Results` section of TASK.md when done."
        : "Update `_notes/plan.md` checkboxes and log completion details in `_notes/worklog.md`.";

    result.systemPrompt =
      event.systemPrompt +
      `\n## Subtask: ${subtask.name}\n\n` +
      `You are working on an atomic subtask. Your ${scopeFile} defines the scope.\n` +
      `${completionInstruction}\n` +
      `Stay focused on the subtask scope — do not expand beyond the acceptance criteria.\n`;

    if (result.message || result.systemPrompt) return result;
  });

  // --- Session Shutdown: log to parent worklog ---
  pi.on("session_shutdown", async (_event, _ctx) => {
    if (!subtaskContext) return;

    const { subtask } = subtaskContext;
    if (!subtask.parentSettingsPath) return;

    const ts = makeTimestamp();
    const parentDir = taskDirFromSettings(subtask.parentSettingsPath);
    const notesDir = path.join(parentDir, "_notes");
    const worklogPath = path.join(notesDir, "worklog.md");
    try {
      const existing = readFileOr(worklogPath, "# Work Log\n");
      fs.writeFileSync(
        worklogPath,
        existing.trimEnd() +
          `\n- ${ts}: Subtask session ended: ${subtask.name}\n`,
      );
    } catch {
      /* best effort */
    }
  });

  // --- Commands ---

  function registerAtomCommand(
    name: string,
    description: string,
    contentFn: () => string,
  ) {
    pi.registerCommand(name, {
      description,
      handler: async (args, _ctx) => {
        const content = contentFn();
        if (!content) {
          _ctx.ui.notify(`Atom: content not found for ${name}`, "error");
          return;
        }
        const extra = args ? `\n\nUser says: ${args}` : "";
        pi.sendUserMessage(content + extra);
      },
    });
  }

  // --- atom:init — initialize workspace structure ---
  pi.registerCommand("atom:init", {
    description: "Initialize atom workspace structure (_notes, subtasks, and .pi/work.settings.json)",
    handler: async (_args, ctx) => {
      const ts = makeTimestamp();

      let branch = "unknown";
      try {
        const r = await pi.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
          timeout: 5000,
        });
        if (r.code === 0 && r.stdout.trim()) branch = r.stdout.trim();
      } catch {
        // keep fallback
      }

      const notesDir = path.join(ctx.cwd, "_notes");
      const subtasksDir = path.join(ctx.cwd, "subtasks");
      const piDir = path.join(ctx.cwd, ".pi");
      const planPath = path.join(notesDir, "plan.md");
      const worklogPath = path.join(notesDir, "worklog.md");
      const notesReadmePath = path.join(notesDir, "README.md");
      const settingsFile = path.join(piDir, "work.settings.json");

      ensureDir(notesDir);
      ensureDir(subtasksDir);
      ensureDir(piDir);

      const createdPlan = ensureFile(
        planPath,
        `# Plan\n\n## Description\n\n## Acceptance Criteria\n- [ ] \n\n## TODOs\n- [ ] \n\n## Repos\n- repo: .\n  branch: ${branch}\n\n## Work Notes\n- \`_notes/worklog.md\` — progress log\n\n## Design Decisions\n\n`,
      );

      const createdNotesReadme = ensureFile(
        notesReadmePath,
        "# Notes Index\n\n## Core\n- `plan.md`\n- `worklog.md`\n\n## Additional Notes\n- Add topic files as needed (`<topic>.md`)\n",
      );

      const createdSettings = ensureFile(
        settingsFile,
        JSON.stringify(
          {
            phase: "plan",
            phaseBeforeTodo: null,
            workId: "",
            name: "",
            status: "active",
            branch,
            worktreePath: null,
            worktreeBranch: null,
            approveCommits: true,
          },
          null,
          2,
        ) + "\n",
      );

      if (!fs.existsSync(worklogPath)) {
        fs.writeFileSync(worklogPath, `# Work Log\n\n- ${ts}: Initialized atom workspace structure\n`);
      } else {
        const existing = readFileOr(worklogPath, "# Work Log\n").trimEnd();
        fs.writeFileSync(
          worklogPath,
          `${existing}\n- ${ts}: Re-ran atom:init (structure verified)\n`,
        );
      }

      const summary = [
        "atom:init completed",
        createdPlan ? "created: _notes/plan.md" : "kept: _notes/plan.md",
        createdNotesReadme ? "created: _notes/README.md" : "kept: _notes/README.md",
        createdSettings ? "created: .pi/work.settings.json" : "kept: .pi/work.settings.json",
        "ensured: _notes/, subtasks/, .pi/, _notes/worklog.md",
        "next: /atom:recall",
      ].join("\n");

      ctx.ui.notify(summary, "success");
    },
  });

  // --- atom:create — create subtask + request work-manager init ---
  pi.registerCommand("atom:create", {
    description: "Create a subtask workspace (git worktree + _notes/plan.md)",
    handler: async (args, ctx) => {
      const content = readPrompt("atom-create");
      if (!content) {
        ctx.ui.notify("Atom: prompt file not found for atom:create", "error");
        return;
      }

      const rawArgs = (args || "").trim();
      const split = rawArgs ? rawArgs.split(/\s+/) : [];
      let subtaskName = split[0] || "";
      const extraArgs = split.slice(1).join(" ");

      if (!subtaskName) {
        const entered = await ctx.ui.input("Subtask name (slug):");
        subtaskName = (entered || "").trim();
      }

      if (!subtaskName) {
        ctx.ui.notify("Subtask name is required", "error");
        return;
      }

      const contextFile = path.join(ctx.cwd, "_notes", "plan.md");
      if (!fs.existsSync(contextFile)) {
        ctx.ui.notify("Missing _notes/plan.md. Run /atom:init first.", "error");
        return;
      }

      const subtasksDir = path.join(ctx.cwd, "subtasks");
      const targetDir = path.join(subtasksDir, subtaskName);
      ensureDir(subtasksDir);
      ensureDir(targetDir);

      const parentSettingsFile = findSettings(ctx.cwd);
      const parentSettings = parentSettingsFile
        ? readSettings(parentSettingsFile)
        : null;

      let branch = parentSettings?.branch || "";
      if (!branch) {
        try {
          const r = await pi.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
            timeout: 5000,
          });
          if (r.code === 0 && r.stdout.trim()) branch = r.stdout.trim();
        } catch {
          // keep fallback
        }
      }

      try {
        const result = await new Promise<{ notesDir: string; settingsFile: string }>((resolve, reject) => {
          pi.events.emit(WORK_EVENTS.SUBTASK_INIT_REQUEST, {
            targetDir,
            subtaskName,
            contextFile,
            branch,
            workId: parentSettings?.workId || "",
            name: subtaskName,
            approveCommits: parentSettings?.approveCommits,
            resolve,
            reject,
          });
        });

        ctx.ui.notify(
          `Subtask initialized by work-manager: ${subtaskName}\nnotes: ${result.notesDir}\nsettings: ${result.settingsFile}`,
          "success",
        );
      } catch (err: any) {
        ctx.ui.notify(
          `Subtask init failed: ${err?.message || String(err)}`,
          "error",
        );
        return;
      }

      const userExtra = [subtaskName, extraArgs].filter(Boolean).join(" ");
      const extra = userExtra ? `\n\nUser says: ${userExtra}` : "";
      pi.sendUserMessage(content + extra);
    },
  });

  // --- atom:done — finish and merge a subtask ---
  pi.registerCommand("atom:done", {
    description: "Finish and merge a subtask — migrate results to parent",
    handler: async (args, ctx) => {
      const content = readPrompt("atom-done");
      if (!content) {
        ctx.ui.notify("Atom: prompt file not found for atom:done", "error");
        return;
      }

      // Find subtasks/ directory
      const subtasksDir = path.join(ctx.cwd, "subtasks");
      let subtasks: string[] = [];
      try {
        subtasks = fs
          .readdirSync(subtasksDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name);
      } catch {
        /* no subtasks dir */
      }

      if (subtasks.length === 0) {
        ctx.ui.notify("No subtasks found in subtasks/", "warning");
        return;
      }

      let selected: string | null = null;

      if (args) {
        if (subtasks.includes(args.trim())) {
          selected = args.trim();
        } else {
          ctx.ui.notify(
            `Subtask "${args.trim()}" not found. Available: ${subtasks.join(", ")}`,
            "error",
          );
          return;
        }
      } else if (subtasks.length === 1) {
        selected = subtasks[0];
      } else {
        selected = await ctx.ui.select("Select subtask to merge:", subtasks);
        if (!selected) return;
      }

      // Prefer _notes/worklog.md preview; fallback to TASK.md results for legacy subtasks
      const worklogPath = path.join(subtasksDir, selected, "_notes", "worklog.md");
      const taskMdPath = path.join(subtasksDir, selected, "TASK.md");

      let resultsPreview = "(no progress found)";

      if (fs.existsSync(worklogPath)) {
        const worklog = readFileOr(worklogPath, "");
        const entries = worklog
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("- "));
        resultsPreview = entries.slice(-10).join("\n") || "(no worklog entries)";
      } else if (fs.existsSync(taskMdPath)) {
        const taskMd = readFileOr(taskMdPath, "");
        const resultsMatch = taskMd.match(
          /## Results\n\n([\s\S]*?)(?=\n## |$)/,
        );
        resultsPreview = resultsMatch
          ? resultsMatch[1].trim().split("\n").slice(0, 10).join("\n")
          : "(no results section)";
      }

      const confirmed = await ctx.ui.confirm(
        `Merge subtask **${selected}**?\n\nProgress preview:\n${resultsPreview}`,
      );
      if (!confirmed) {
        ctx.ui.notify("Merge cancelled", "warning");
        return;
      }

      pi.sendUserMessage(
        content +
          `\n\n---\nUser confirmed merge of subtask: **${selected}**. Proceed with merge.`,
      );
    },
  });

  // --- Moved from work: atom:recall, atom:update, atom:pr, atom:compact ---

  registerAtomCommand(
    "atom:recall",
    "Re-orient: what was I doing, what's next?",
    () => readPrompt("atom-recall"),
  );

  registerAtomCommand(
    "atom:update",
    "Log progress, capture knowledge, transition phase",
    () => readPrompt("atom-update"),
  );

  registerAtomCommand(
    "atom:pr",
    "Create PRs for all repos with unpushed commits",
    () => readPrompt("atom-pr"),
  );

  // --- atom:compact ---
  pi.registerCommand("atom:compact", {
    description:
      "Compact context with current work phase instructions",
    handler: async (_args, ctx) => {
      const sf = findSettings(ctx.cwd);
      if (!sf) {
        ctx.ui.notify("No work context found", "warning");
        return;
      }
      const settings = readSettings(sf);
      if (!settings) {
        ctx.ui.notify("Could not read .pi/work.settings.json", "error");
        return;
      }

      ctx.ui.setStatus(
        "work",
        `📋 ${settings.workId || settings.name} [${settings.phase}]`,
      );

      const phaseLabel =
        settings.phase.charAt(0).toUpperCase() + settings.phase.slice(1);
      ctx.compact({
        customInstructions: [
          `Phase transition to **${phaseLabel}**.`,
          `Preserve: work-id, acceptance criteria, plan, and progress from _notes/plan.md.`,
          `Discard: detailed conversation about the previous phase.`,
          `The user is now in the ${settings.phase} phase of work "${settings.name}".`,
        ].join(" "),
        onComplete: () => {
          ctx.ui.notify(`Compacted for ${phaseLabel} phase`, "success");
        },
        onError: (err) => {
          ctx.ui.notify(`Compaction failed: ${err.message}`, "error");
        },
      });
    },
  });
}

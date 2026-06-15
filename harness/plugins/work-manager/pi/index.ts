import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

import * as state from "../common/state";
import * as notes from "../common/notes";
import { register as registerSmartCommit } from "./modules/smart-commit/index.ts";
import { register as registerAgentReview } from "./modules/agent-review.ts";

const CWD = process.cwd();
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PLUGIN_ROOT = path.join(ROOT, "claude");

function execGit(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, encoding: "utf-8", stdio: "pipe" });
}

function resolveSettingsFile(cwd: string): string | null {
  return state.findSettings(cwd);
}

function resolveNotesDir(settingsFile: string): string {
  return path.join(state.taskDirFromSettings(settingsFile), ".notes");
}

/** Initialize work-tracking state + notes for a fresh task. */
function initWork(taskDir: string, workId: string, name: string, branch: string): string {
  const sf = state.settingsPath(taskDir);
  const notesDir = notes.ensureNotesDir(taskDir, execGit);
  notes.ensureClaudeMd(taskDir);

  const worklogPath = path.join(notesDir, "worklog.md");
  if (!fs.existsSync(worklogPath)) {
    fs.writeFileSync(worklogPath, "# Work Log\n");
  }

  state.writeSettings(sf, {
    ...state.DEFAULTS,
    workId,
    name: name || "unnamed work",
    branch,
    status: "active",
  });

  notes.appendWorklog(notesDir, "Work initialized");
  notes.commitNotes(notesDir, "init: work started", execGit);
  return notesDir;
}

function cancelWork(settingsFile: string): void {
  state.updateSettings(settingsFile, { status: "done" });
  const notesDir = resolveNotesDir(settingsFile);
  notes.appendWorklog(notesDir, "Work cancelled");
  notes.commitNotes(notesDir, "work: cancelled", execGit);
}

function deriveWorkId(branch: string): { workId: string; name: string } {
  const ticketMatch = branch.match(/^([A-Z]+-\d+)/);
  const workId = ticketMatch ? ticketMatch[1] : "";
  const name = workId
    ? branch.replace(workId, "").replace(/^[-_]+/, "").replace(/-/g, " ")
    : branch.replace(/-/g, " ");
  return { workId, name };
}

function currentBranch(cwd: string): string {
  try {
    return (
      execSync("git branch --show-current", { cwd, encoding: "utf-8", stdio: "pipe" }).trim() ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

function registerCommands(pi: ExtensionAPI) {
  pi.registerCommand("work:help", {
    description: "Show work manager usage guide",
    handler: async (_args, ctx) => {
      const p = path.join(PLUGIN_ROOT, "commands", "work-help.md");
      const text = notes.readFileOr(p, "Work help not found.");
      pi.sendUserMessage(text);
      ctx.ui.notify("Work help shown.", "info");
    },
  });

  pi.registerCommand("work:status", {
    description: "Show current work state",
    handler: async (_args, ctx) => {
      const sf = resolveSettingsFile(ctx.cwd);
      if (!sf) {
        ctx.ui.notify("No active work. Use /work:start.", "info");
        return;
      }

      const s = state.readSettings(sf);
      if (!s) {
        ctx.ui.notify("Cannot read work settings.", "error");
        return;
      }

      const notesDir = resolveNotesDir(sf);
      const wl = notes.worklogTail(notesDir, 5);
      const text = [
        `Work: ${s.workId || s.name || "unnamed"}`,
        `Status: ${s.status}`,
        `Branch: ${s.branch || "(unknown)"}`,
        wl ? `Recent:\n${wl}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      ctx.ui.notify(text, "info");
    },
  });

  pi.registerCommand("work:start", {
    description: "Begin or resume work tracking for this workspace",
    handler: async (_args, ctx) => {
      const existing = resolveSettingsFile(ctx.cwd);
      if (existing) {
        const current = state.readSettings(existing);
        if (current && current.status === "active") {
          ctx.ui.notify(`Work already active: ${current.workId || current.name || "unnamed"}`, "info");
          return;
        }

        const notesDirExisting = resolveNotesDir(existing);
        const planPath = path.join(notesDirExisting, "spec.md");
        const hasPlan = notes.readFileOr(planPath, "").trim().length > 0;
        if (current && current.status !== "active" && hasPlan) {
          const choice = await ctx.ui.select(
            "Found previous work with an existing spec. What do you want?",
            ["↩️ Resume previous work", "🆕 Start new work (archive old spec)"],
          );

          if (!choice || choice.startsWith("↩️")) {
            state.updateSettings(existing, { status: "active" });
            ctx.ui.notify(`Resumed work: ${current.workId || current.name || "unnamed"}`, "success");
            return;
          }

          const ts = notes.makeTimestamp().replace(/[: ]/g, "-");
          const archived = path.join(notesDirExisting, `spec.abandoned-${ts}.md`);
          try { fs.renameSync(planPath, archived); } catch { /* best effort */ }
        }
      }

      const branch = currentBranch(ctx.cwd);
      const { workId, name } = deriveWorkId(branch);
      const notesDir = initWork(ctx.cwd || CWD, workId, name, branch);

      ctx.ui.notify(`Work started: ${workId || name || branch}`, "success");
      pi.sendUserMessage(`Work started.\n\nBranch: ${branch}\nWorkId: ${workId || "(auto)"}\nNotes: ${notesDir}`);
    },
  });

  const abandonHandler = async (ctx: any) => {
    const sf = resolveSettingsFile(ctx.cwd);
    if (!sf) {
      ctx.ui.notify("No active work to cancel.", "info");
      return;
    }

    const s = state.readSettings(sf);
    if (!s) {
      ctx.ui.notify("Cannot read work settings.", "error");
      return;
    }

    cancelWork(sf);
    ctx.ui.notify("Work-manager cancelled.", "warning");
  };

  pi.registerCommand("work:abandon", {
    description: "Cancel work-manager flow for this workspace",
    handler: async (_args, ctx) => abandonHandler(ctx),
  });

  // Alias for compatibility with command namespaces users type in Claude.
  pi.registerCommand("work-manager:work-abandon", {
    description: "Alias of /work:abandon",
    handler: async (_args, ctx) => abandonHandler(ctx),
  });
}

export default function (pi: ExtensionAPI) {
  registerCommands(pi);
  registerSmartCommit(pi);
  registerAgentReview(pi);

  pi.registerTool({
    name: "work_state",
    label: "Work State",
    description: "Read or update work state in .pi/work.settings.json",
    parameters: Type.Object({
      action: Type.Union([Type.Literal("read"), Type.Literal("update")]),
      updates: Type.Optional(Type.Object({}, { additionalProperties: true })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sf = resolveSettingsFile(ctx.cwd || CWD);
      if (!sf) {
        return { content: [{ type: "text", text: "No active work found. Use /work:start to begin." }] };
      }

      if (params.action === "read") {
        const s = state.readSettings(sf);
        return { content: [{ type: "text", text: JSON.stringify(s, null, 2) }] };
      }

      const updated = state.updateSettings(sf, (params.updates || {}) as Partial<typeof state.DEFAULTS>);
      return { content: [{ type: "text", text: JSON.stringify(updated, null, 2) }] };
    },
  });

  pi.registerTool({
    name: "work_start",
    label: "Work Start",
    description: "Start new work and initialize .notes and state",
    parameters: Type.Object({
      branch: Type.String(),
      workId: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const notesDir = initWork(ctx.cwd || CWD, params.workId || "", params.name || "", params.branch);
      return {
        content: [
          {
            type: "text",
            text: `Work started.\n\nBranch: ${params.branch}\nWorkId: ${params.workId || "(auto)"}\nNotes: ${notesDir}`,
          },
        ],
      };
    },
  });

  pi.registerTool({
    name: "work_context",
    label: "Work Context",
    description: "Get current work spec/worklog snippets",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const sf = resolveSettingsFile(ctx.cwd || CWD);
      if (!sf) return { content: [{ type: "text", text: "No active work context." }] };

      const s = state.readSettings(sf);
      if (!s || s.status !== "active") {
        return { content: [{ type: "text", text: "Work is not active." }] };
      }

      const notesDir = resolveNotesDir(sf);
      const parts: string[] = [];
      parts.push(`## Active Work: ${s.workId || s.name || "unnamed"}`);
      parts.push(`**Branch:** ${s.branch}`);
      parts.push("");

      const plan = notes.readFileOr(path.join(notesDir, "spec.md"), "");
      if (plan) {
        parts.push("### Plan");
        parts.push(plan);
        parts.push("");
      }

      const wl = notes.worklogTail(notesDir, 10);
      if (wl) {
        parts.push("### Recent Progress");
        parts.push("```");
        parts.push(wl);
        parts.push("```");
      }

      return { content: [{ type: "text", text: parts.join("\n") }] };
    },
  });

  pi.registerTool({
    name: "work_abandon",
    label: "Work Abandon",
    description: "Cancel active work-manager flow",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const sf = resolveSettingsFile(ctx.cwd || CWD);
      if (!sf) return { content: [{ type: "text", text: "No active work to cancel." }] };
      const s = state.readSettings(sf);
      if (!s) return { content: [{ type: "text", text: "Cannot read work settings." }] };
      cancelWork(sf);
      return { content: [{ type: "text", text: "Work-manager cancelled." }] };
    },
  });
}

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

import { Phase, type SideEffect } from "../common/types";
import * as state from "../common/state";
import * as notes from "../common/notes";
import * as fsm from "../common/fsm";

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
  return path.join(state.taskDirFromSettings(settingsFile), "_notes");
}

function loadSkill(name: string): string {
  const skillPath = path.join(PLUGIN_ROOT, "skills", name, "SKILL.md");
  return notes.readFileOr(skillPath, "");
}

function executeEffects(effects: SideEffect[], settingsFile: string): string {
  const messages: string[] = [];
  const notesDir = resolveNotesDir(settingsFile);

  for (const effect of effects) {
    switch (effect.kind) {
      case "worklog":
        notes.appendWorklog(notesDir, effect.entry);
        break;
      case "commit_notes":
        notes.commitNotes(notesDir, effect.message, execGit);
        break;
      case "inject_skill": {
        const skill = loadSkill(effect.skill);
        if (skill) {
          messages.push(effect.context ? `${skill}\n\n---\n${effect.context}` : skill);
        }
        break;
      }
      case "compact":
        messages.push(`[compact] ${effect.summary}`);
        break;
      case "notify":
        messages.push(`[${effect.level}] ${effect.message}`);
        break;
      case "set_model":
        messages.push(`[model] ${effect.model}`);
        break;
      case "ask_user":
        messages.push(
          effect.options && effect.options.length > 0
            ? `[question] ${effect.question}\nOptions: ${effect.options.join(", ")}`
            : `[question] ${effect.question}`,
        );
        break;
      case "block_tool":
        messages.push(`[blocked] ${effect.reason}`);
        break;
    }
  }

  return messages.join("\n\n");
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
        `Phase: ${s.phase}`,
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
    description: "Begin new work and enter plan phase",
    handler: async (_args, ctx) => {
      const existing = resolveSettingsFile(ctx.cwd);
      if (existing) {
        const current = state.readSettings(existing);
        if (current && current.status === "active") {
          ctx.ui.notify(`Work already active: ${current.workId || current.name || "unnamed"} [${current.phase}]`, "info");
          if (!current.worktreePath) {
            pi.sendUserMessage(
              "Existing work detected. Do you want to create a trunk/worktree before continuing implementation? " +
              "Reply with your preferred branch/path naming.",
            );
          }
          return;
        }
      }

      let branch = "unknown";
      try {
        branch = execSync("git branch --show-current", {
          cwd: ctx.cwd,
          encoding: "utf-8",
          stdio: "pipe",
        }).trim() || "unknown";
      } catch {
        // non-git cwd
      }

      const ticketMatch = branch.match(/^([A-Z]+-\d+)/);
      const workId = ticketMatch ? ticketMatch[1] : "";
      const name = workId ? branch.replace(workId, "").replace(/^[-_]+/, "").replace(/-/g, " ") : branch.replace(/-/g, " ");

      const sf = state.settingsPath(ctx.cwd || CWD);
      const notesDir = notes.ensureNotesDir(ctx.cwd || CWD, execGit);
      const worklogPath = path.join(notesDir, "worklog.md");
      if (!fs.existsSync(worklogPath)) {
        fs.writeFileSync(worklogPath, "# Work Log\n");
      }

      const result = fsm.start(branch, workId, name || "");
      state.writeSettings(sf, { ...state.DEFAULTS, ...result.newState });
      const messages = executeEffects(result.effects, sf);

      ctx.ui.notify(`Work started: ${workId || name || branch} [plan]`, "success");
      if (messages) pi.sendUserMessage(messages);
    },
  });

  pi.registerCommand("work:implement", {
    description: "Transition from plan to implement",
    handler: async (_args, ctx) => {
      const sf = resolveSettingsFile(ctx.cwd);
      if (!sf) {
        ctx.ui.notify("No active work. Use /work:start.", "error");
        return;
      }

      const s = state.readSettings(sf);
      if (!s) {
        ctx.ui.notify("Cannot read work settings.", "error");
        return;
      }

      const result = fsm.transition(s, Phase.Implement);
      if (Object.keys(result.newState).length > 0) {
        state.updateSettings(sf, result.newState);
      }
      const messages = executeEffects(result.effects, sf);
      const updated = state.readSettings(sf);
      ctx.ui.notify(`Phase: ${updated?.phase || "unknown"}`, "success");
      if (messages) pi.sendUserMessage(messages);
    },
  });

  pi.registerCommand("work:done", {
    description: "Mark active work as done",
    handler: async (_args, ctx) => {
      const sf = resolveSettingsFile(ctx.cwd);
      if (!sf) {
        ctx.ui.notify("No active work.", "info");
        return;
      }

      const s = state.readSettings(sf);
      if (!s) {
        ctx.ui.notify("Cannot read work settings.", "error");
        return;
      }

      const result = fsm.done(s);
      state.updateSettings(sf, result.newState);
      const messages = executeEffects(result.effects, sf);
      ctx.ui.notify("Work marked done.", "success");
      if (messages) pi.sendUserMessage(messages);
    },
  });

  pi.registerCommand("work:off", {
    description: "Disable work tracking for this session",
    handler: async (_args, ctx) => {
      const sf = resolveSettingsFile(ctx.cwd);
      if (!sf) {
        ctx.ui.notify("No active work to disable.", "info");
        return;
      }

      const s = state.readSettings(sf);
      if (!s) {
        ctx.ui.notify("Cannot read work settings.", "error");
        return;
      }

      const result = fsm.cancel(s);
      state.updateSettings(sf, result.newState);
      const messages = executeEffects(result.effects, sf);
      ctx.ui.notify("Work tracking disabled.", "warning");
      if (messages) pi.sendUserMessage(messages);
    },
  });
}

export default function (pi: ExtensionAPI) {
  registerCommands(pi);

  pi.on("tool_call", async (event, ctx) => {
    if (!["bash", "edit", "write"].includes(event.toolName)) return;

    const sf = resolveSettingsFile(ctx.cwd);
    if (!sf) return;

    const s = state.readSettings(sf);
    if (!s || s.status !== "active") return;

    const reason = fsm.guardToolCall(
      s,
      event.toolName,
      event.input as Record<string, unknown>,
      resolveNotesDir(sf),
    );

    if (reason) {
      return { block: true, reason };
    }
  });

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
    description: "Start new work and initialize _notes and state",
    parameters: Type.Object({
      branch: Type.String(),
      workId: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const taskDir = ctx.cwd || CWD;
      const sf = state.settingsPath(taskDir);
      const notesDir = notes.ensureNotesDir(taskDir, execGit);

      const worklogPath = path.join(notesDir, "worklog.md");
      if (!fs.existsSync(worklogPath)) {
        fs.writeFileSync(worklogPath, "# Work Log\n");
      }

      const result = fsm.start(params.branch, params.workId || "", params.name || "");
      state.writeSettings(sf, { ...state.DEFAULTS, ...result.newState });
      const messages = executeEffects(result.effects, sf);

      return {
        content: [
          {
            type: "text",
            text: `Work started.\n\nPhase: plan\nBranch: ${params.branch}\nWorkId: ${params.workId || "(auto)"}\nNotes: ${notesDir}${messages ? `\n\n${messages}` : ""}`,
          },
        ],
      };
    },
  });

  pi.registerTool({
    name: "work_transition",
    label: "Work Transition",
    description: "Transition between work phases",
    parameters: Type.Object({
      to: Type.Union([
        Type.Literal("research"),
        Type.Literal("plan"),
        Type.Literal("implement"),
        Type.Literal("verify"),
        Type.Literal("verified"),
      ]),
      feedback: Type.Optional(Type.String()),
      focus: Type.Optional(Type.String()),
      approved: Type.Optional(Type.Boolean()),
      reason: Type.Optional(Type.String()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sf = resolveSettingsFile(ctx.cwd || CWD);
      if (!sf) return { content: [{ type: "text", text: "No active work found." }] };

      const s = state.readSettings(sf);
      if (!s) return { content: [{ type: "text", text: "Cannot read work settings." }] };

      const result = fsm.transition(s, params.to as Phase, {
        feedback: params.feedback,
        focus: params.focus,
        approved: params.approved,
        reason: params.reason,
      });

      if (Object.keys(result.newState).length > 0) {
        state.updateSettings(sf, result.newState);
      }

      const messages = executeEffects(result.effects, sf);
      const updated = state.readSettings(sf);
      return {
        content: [{ type: "text", text: `Phase: ${updated?.phase || "unknown"}${messages ? `\n\n${messages}` : ""}` }],
      };
    },
  });

  pi.registerTool({
    name: "work_guard",
    label: "Work Guard",
    description: "Check if tool call is allowed in current phase",
    parameters: Type.Object({
      toolName: Type.String(),
      input: Type.Object({}, { additionalProperties: true }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sf = resolveSettingsFile(ctx.cwd || CWD);
      if (!sf) return { content: [{ type: "text", text: '{"allowed": true}' }] };

      const s = state.readSettings(sf);
      if (!s || s.status !== "active") {
        return { content: [{ type: "text", text: '{"allowed": true}' }] };
      }

      const reason = fsm.guardToolCall(s, params.toolName, params.input, resolveNotesDir(sf));
      if (reason) {
        return { content: [{ type: "text", text: JSON.stringify({ allowed: false, reason }) }] };
      }

      return { content: [{ type: "text", text: '{"allowed": true}' }] };
    },
  });

  pi.registerTool({
    name: "work_context",
    label: "Work Context",
    description: "Get current phase context and plan/worklog snippets",
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
      parts.push(`**Phase:** ${s.phase}`);
      parts.push(`**Branch:** ${s.branch}`);
      parts.push("");

      const plan = notes.readFileOr(path.join(notesDir, "plan.md"), "");
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
    name: "work_compact",
    label: "Work Compact",
    description: "Log TODO completion and append learnings",
    parameters: Type.Object({
      summary: Type.String(),
      learnings: Type.String(),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sf = resolveSettingsFile(ctx.cwd || CWD);
      if (!sf) return { content: [{ type: "text", text: "No active work." }] };

      const notesDir = resolveNotesDir(sf);
      const lp = path.join(notesDir, "impl-learnings.md");
      const existing = notes.readFileOr(lp, "# Implementation Learnings\n\nNotes from each TODO for the next implementer.\n");
      const ts = notes.makeTimestamp();
      fs.writeFileSync(lp, `${existing.trimEnd()}\n\n## TODO: ${params.summary} (${ts})\n\n${params.learnings}\n`);

      notes.appendWorklog(notesDir, `[TODO] ${params.summary}`);
      notes.commitNotes(notesDir, `todo: ${params.summary}`, execGit);

      return {
        content: [
          { type: "text", text: `TODO completed and logged: ${params.summary}\n\nContext freed. Continue with next TODO.` },
        ],
      };
    },
  });

  pi.registerTool({
    name: "work_off",
    label: "Work Off",
    description: "Disable work tracking for current session",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const sf = resolveSettingsFile(ctx.cwd || CWD);
      if (!sf) return { content: [{ type: "text", text: "No active work to disable." }] };
      state.updateSettings(sf, { status: "done" });
      return { content: [{ type: "text", text: "Work tracking disabled for this session." }] };
    },
  });
}

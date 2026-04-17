/**
 * Work Manager MCP Server.
 *
 * Thin adapter: receives MCP tool calls, calls core, returns results.
 * One process per Claude session, started via .mcp.json.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

import { Phase } from "../../common/types";
import * as state from "../../common/state";
import * as notes from "../../common/notes";
import * as fsm from "../../common/fsm";
import { buildWorkNextPrompt } from "../../common/work-next-prompt";
import { executeEffects, type EffectContext } from "./effects";

// --- Environment ---

const CWD = process.env.WORK_CWD || process.cwd();
const PLUGIN_ROOT = process.env.PLUGIN_ROOT || path.resolve(__dirname, "..");

// --- Git helper (injected into core/notes) ---

function execGit(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, encoding: "utf-8", stdio: "pipe" });
}

// --- Helpers ---

function resolveSettingsFile(): string | null {
  return state.findSettings(CWD);
}

function resolveNotesDir(settingsFile: string): string {
  const taskDir = state.taskDirFromSettings(settingsFile);
  return path.join(taskDir, "_notes");
}

function loadSkill(name: string): string {
  const skillPath = path.join(PLUGIN_ROOT, "skills", name, "SKILL.md");
  return notes.readFileOr(skillPath, "");
}

function makeEffectContext(settingsFile: string): EffectContext {
  const notesDir = resolveNotesDir(settingsFile);
  return {
    notesDir,
    cwd: state.taskDirFromSettings(settingsFile),
    git: execGit,
    loadSkill,
  };
}

function renderWorkNextPrompt(notesDir: string): string {
  const planPath = path.join(notesDir, "plan.md");
  const plan = notes.readFileOr(planPath, "");
  const recentWorklog = notes.worklogTail(notesDir, 5);
  const skill = loadSkill("work-implement");
  return buildWorkNextPrompt({ plan, recentWorklog, skill });
}

// --- MCP Server ---

const server = new McpServer({
  name: "work-manager",
  version: "2.0.0",
});

// --- Tool: work_state ---

server.tool(
  "work_state",
  "Read or update work state (.pi/work.settings.json)",
  {
    action: z.enum(["read", "update"]).describe("read or update state"),
    updates: z
      .record(z.unknown())
      .optional()
      .describe("Fields to update (only for action=update)"),
  },
  async ({ action, updates }) => {
    const sf = resolveSettingsFile();
    if (!sf) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No active work found. Use /work:start to begin.",
          },
        ],
      };
    }

    if (action === "read") {
      const settings = state.readSettings(sf);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(settings, null, 2) },
        ],
      };
    }

    // action === "update"
    const updated = state.updateSettings(
      sf,
      (updates || {}) as Partial<typeof state.DEFAULTS>,
    );
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(updated, null, 2) },
      ],
    };
  },
);

// --- Tool: work_start ---

server.tool(
  "work_start",
  "Start new work — creates _notes/, initializes state, enters plan phase",
  {
    branch: z.string().describe("Current git branch name"),
    workId: z.string().optional().describe("Work/ticket ID (e.g., MILAB-1234)"),
    name: z.string().optional().describe("Human-readable work name"),
    resumeMode: z.enum(["continue", "new"]).optional().describe("When abandoned plan exists: continue old plan or start new (archive old plan)"),
  },
  async ({ branch, workId, name, resumeMode }) => {
    const taskDir = CWD;
    const sf = state.settingsPath(taskDir);

    const existing = state.readSettings(sf);
    if (existing && existing.status === "active") {
      const label = existing.workId || existing.name || "unnamed";

      if (existing.phase === Phase.Implement || existing.phase === Phase.TodoDone) {
        if (existing.phase === Phase.TodoDone) {
          const resumeResult = fsm.transition(existing, Phase.Implement);
          if (Object.keys(resumeResult.newState).length > 0) {
            state.updateSettings(sf, resumeResult.newState);
          }
          const resumeCtx = makeEffectContext(sf);
          executeEffects(resumeResult.effects, resumeCtx);
        }

        const prompt = renderWorkNextPrompt(resolveNotesDir(sf));
        return {
          content: [{ type: "text" as const, text: prompt }],
        };
      }

      const trunkPrompt = existing.worktreePath
        ? `Work already active: ${label} [${existing.phase}]\nWorktree: ${existing.worktreePath}`
        : `Work already active: ${label} [${existing.phase}]\n[question] Existing work detected. Create trunk/worktree before continuing?`;
      return {
        content: [{ type: "text" as const, text: trunkPrompt }],
      };
    }

    // Create _notes/
    const notesDir = notes.ensureNotesDir(taskDir, execGit);
    notes.ensureClaudeMd(taskDir);

    const planPath = path.join(notesDir, "plan.md");
    const hasPlan = notes.readFileOr(planPath, "").trim().length > 0;
    if (existing && existing.status !== "active" && hasPlan) {
      if (!resumeMode) {
        return {
          content: [{
            type: "text" as const,
            text: "[question] Found abandoned work with existing `_notes/plan.md`. Reply with `continue` to resume previous plan or `new` to archive old plan and start fresh.",
          }],
        };
      }

      if (resumeMode === "continue") {
        state.updateSettings(sf, { status: "active", phase: "plan", phaseBeforeTodo: null } as any);
        return {
          content: [{
            type: "text" as const,
            text: `Resumed abandoned work.\n\nPhase: plan\nBranch: ${existing.branch || branch}\nWorkId: ${existing.workId || workId || "(auto)"}\nNotes: ${notesDir}`,
          }],
        };
      }

      const ts = notes.makeTimestamp().replace(/[: ]/g, "-");
      const archived = path.join(notesDir, `plan.abandoned-${ts}.md`);
      try { fs.renameSync(planPath, archived); } catch { /* best effort */ }
    }

    // Initialize worklog
    const worklogPath = path.join(notesDir, "worklog.md");
    if (!fs.existsSync(worklogPath)) {
      fs.writeFileSync(worklogPath, "# Work Log\n");
    }

    // Run FSM start
    const result = fsm.start(branch, workId || "", name || "");

    // Write initial state
    state.writeSettings(sf, {
      ...state.DEFAULTS,
      ...(result.newState as any),
    });

    // Execute effects
    const ctx = makeEffectContext(sf);
    const messages = executeEffects(result.effects, ctx);

    return {
      content: [
        {
          type: "text" as const,
          text: `Work started.\n\nPhase: plan\nBranch: ${branch}\nWorkId: ${workId || "(auto)"}\nNotes: ${notesDir}\n\n${messages}`,
        },
      ],
    };
  },
);

// --- Tool: work_transition ---

server.tool(
  "work_transition",
  "Transition between work phases (research, plan, plan-verify, implement, todo-done)",
  {
    to: z
      .enum(["research", "plan", "plan-verify", "implement", "todo-done"])
      .describe("Target phase"),
    feedback: z.string().optional().describe("User feedback (for plan transition)"),
    focus: z.string().optional().describe("Focus area (for implement transition)"),
  },
  async ({ to, feedback, focus }) => {
    const sf = resolveSettingsFile();
    if (!sf) {
      return {
        content: [
          { type: "text" as const, text: "No active work found." },
        ],
      };
    }

    const settings = state.readSettings(sf);
    if (!settings) {
      return {
        content: [
          { type: "text" as const, text: "Cannot read work settings." },
        ],
      };
    }

    const result = fsm.transition(settings, to as Phase, {
      feedback,
      focus,
    });

    // Apply state updates
    if (Object.keys(result.newState).length > 0) {
      state.updateSettings(sf, result.newState);
    }

    // Execute effects
    const ctx = makeEffectContext(sf);
    const messages = executeEffects(result.effects, ctx);

    const updated = state.readSettings(sf);
    return {
      content: [
        {
          type: "text" as const,
          text: `Phase: ${updated?.phase}\n\n${messages}`,
        },
      ],
    };
  },
);

// --- Tool: work_guard ---

server.tool(
  "work_guard",
  "Check if a tool call is allowed in the current phase",
  {
    toolName: z.string().describe("Tool being called (Bash, Edit, Write)"),
    input: z.record(z.unknown()).describe("Tool input parameters"),
  },
  async ({ toolName, input }) => {
    const sf = resolveSettingsFile();
    if (!sf) {
      return {
        content: [{ type: "text" as const, text: '{"allowed": true}' }],
      };
    }

    const settings = state.readSettings(sf);
    if (!settings || settings.status !== "active") {
      return {
        content: [{ type: "text" as const, text: '{"allowed": true}' }],
      };
    }

    const notesDir = resolveNotesDir(sf);
    const reason = fsm.guardToolCall(settings, toolName, input, notesDir);

    if (reason) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ allowed: false, reason }),
          },
        ],
      };
    }

    return {
      content: [{ type: "text" as const, text: '{"allowed": true}' }],
    };
  },
);

// --- Tool: work_context ---

server.tool(
  "work_context",
  "Get current phase context and instructions (call on agent start)",
  {},
  async () => {
    const sf = resolveSettingsFile();
    if (!sf) {
      return {
        content: [
          { type: "text" as const, text: "No active work context." },
        ],
      };
    }

    const settings = state.readSettings(sf);
    if (!settings || settings.status !== "active") {
      return {
        content: [
          { type: "text" as const, text: "Work is not active." },
        ],
      };
    }

    const notesDir = resolveNotesDir(sf);
    const parts: string[] = [];

    // Work state summary
    parts.push(`## Active Work: ${settings.workId || settings.name}`);
    parts.push(`**Phase:** ${settings.phase}`);
    parts.push(`**Branch:** ${settings.branch}`);
    parts.push("");

    // Plan content
    const plan = notes.readFileOr(path.join(notesDir, "plan.md"), "");
    if (plan) {
      parts.push("### Plan");
      parts.push(plan);
      parts.push("");
    }

    // Recent worklog
    const worklog = notes.worklogTail(notesDir, 10);
    if (worklog) {
      parts.push("### Recent Progress");
      parts.push("```");
      parts.push(worklog);
      parts.push("```");
      parts.push("");
    }

    // Phase-specific skill
    const phaseSkillMap: Record<string, string> = {
      research: "work-research",
      plan: "work-plan",
      "plan-verify": "work-plan-verifier",
      implement: "work-implement",
    };

    const skillName = phaseSkillMap[settings.phase];
    if (skillName) {
      const skill = loadSkill(skillName);
      if (skill) {
        parts.push("### Phase Instructions");
        parts.push(skill);
      }
    }

    // Router instructions
    const routerPath = path.join(
      PLUGIN_ROOT,
      "skills",
      "work-plan",
      "router-instructions.md",
    );
    const router = notes.readFileOr(routerPath, "");
    if (router) {
      parts.push("");
      parts.push(router);
    }

    return {
      content: [{ type: "text" as const, text: parts.join("\n") }],
    };
  },
);

// --- Tool: work_compact ---

server.tool(
  "work_compact",
  "Signal TODO completion during implement phase — logs progress, commits notes",
  {
    summary: z.string().describe("Brief summary of what was completed"),
    learnings: z
      .string()
      .optional()
      .describe("Code understanding notes for the next implementer"),
  },
  async ({ summary, learnings }) => {
    const sf = resolveSettingsFile();
    if (!sf) {
      return {
        content: [{ type: "text" as const, text: "No active work." }],
      };
    }

    const notesDir = resolveNotesDir(sf);

    // Append learnings
    if (learnings) {
      const learningsPath = path.join(notesDir, "impl-learnings.md");
      const existing = notes.readFileOr(
        learningsPath,
        "# Implementation Learnings\n\nNotes from each TODO for the next implementer.\n",
      );
      const ts = notes.makeTimestamp();
      fs.writeFileSync(
        learningsPath,
        existing.trimEnd() +
          `\n\n## TODO: ${summary} (${ts})\n\n${learnings}\n`,
      );
    }

    // Worklog entry
    notes.appendWorklog(notesDir, `[TODO] ${summary}`);

    // Commit notes
    notes.commitNotes(notesDir, `todo: ${summary}`, execGit);

    return {
      content: [
        {
          type: "text" as const,
          text: `TODO completed and logged: ${summary}`, 
        },
      ],
    };
  },
);

// --- Tool: work_next ---

server.tool(
  "work_next",
  "Prepare next TODO execution prompt in implement phase",
  {},
  async () => {
    const sf = resolveSettingsFile();
    if (!sf) {
      return {
        content: [{ type: "text" as const, text: "No active work found. Use /work:start." }],
      };
    }

    const settings = state.readSettings(sf);
    if (!settings) {
      return {
        content: [{ type: "text" as const, text: "Cannot read work settings." }],
      };
    }

    const nextGuard = fsm.guardWorkNextPhase(settings);
    if (!nextGuard.allowed) {
      return {
        content: [{ type: "text" as const, text: nextGuard.reason || "Cannot run /work:next in current phase." }],
      };
    }

    if (nextGuard.autoResumeImplement) {
      const resumeResult = fsm.transition(settings, Phase.Implement);
      if (Object.keys(resumeResult.newState).length > 0) {
        state.updateSettings(sf, resumeResult.newState);
      }
      const resumeCtx = makeEffectContext(sf);
      executeEffects(resumeResult.effects, resumeCtx);
    }

    const notesDir = resolveNotesDir(sf);
    const prompt = renderWorkNextPrompt(notesDir);
    return {
      content: [{ type: "text" as const, text: prompt }],
    };
  },
);

// --- Tool: work_off ---

server.tool(
  "work_off",
  "Disable work tracking for current session",
  {},
  async () => {
    const sf = resolveSettingsFile();
    if (!sf) {
      return {
        content: [
          { type: "text" as const, text: "No active work to disable." },
        ],
      };
    }

    state.updateSettings(sf, { status: "done" } as any);
    return {
      content: [
        {
          type: "text" as const,
          text: "Work tracking disabled for this session.",
        },
      ],
    };
  },
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Work MCP server failed to start:", err);
  process.exit(1);
});

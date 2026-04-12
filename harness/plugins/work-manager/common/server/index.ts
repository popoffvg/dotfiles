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

import { Phase } from "../types";
import * as state from "../state";
import * as notes from "../notes";
import * as fsm from "../fsm";
import { executeEffects, type EffectContext } from "./effects";

// --- Environment ---

const CWD = process.env.WORK_CWD || process.cwd();
const PLUGIN_ROOT = process.env.PLUGIN_ROOT || path.resolve(__dirname, "../../claude");

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
  },
  async ({ branch, workId, name }) => {
    const taskDir = CWD;
    const sf = state.settingsPath(taskDir);

    const existing = state.readSettings(sf);
    if (existing && existing.status === "active") {
      const label = existing.workId || existing.name || "unnamed";
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
  "Transition between work phases (research, plan, plan-verify, implement, verify, verified)",
  {
    to: z
      .enum(["research", "plan", "plan-verify", "implement", "verify", "verified"])
      .describe("Target phase"),
    feedback: z.string().optional().describe("User feedback (for plan transition)"),
    focus: z.string().optional().describe("Focus area (for implement transition)"),
    approved: z.boolean().optional().describe("Whether verify was approved"),
    reason: z.string().optional().describe("Reason for verify rejection"),
  },
  async ({ to, feedback, focus, approved, reason }) => {
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
      approved,
      reason,
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
      implement: "work-implement",
      verify: "work-verify",
      "auto-verify": "work-auto-verify",
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
          text: `TODO completed and logged: ${summary}\n\nContext freed. Continue with next TODO.`,
        },
      ],
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

/**
 * Shared hook handlers for Pi and Claude Code.
 *
 * Platform adapters call these functions and convert the typed results
 * into their own protocol format (Pi: { block, reason }, Claude: JSON stdout).
 */

import * as path from "node:path";
import * as state from "./state";
import * as notes from "./notes";
import * as fsm from "./fsm";

// --- Result types ---

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}

export interface InjectResult {
  additionalContext?: string;
}

// --- Guard: PreToolUse ---

export function guard(
  cwd: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): GuardResult {
  let sf = state.findSettings(cwd);

  // If no active settings in current cwd, and this is a bash command that
  // changes directory first, try resolving settings from that target dir.
  if (!sf && (toolName === "Bash" || toolName === "bash")) {
    const cmd = String(toolInput.command || "").trim();
    const m = cmd.match(/^cd\s+([^&;]+?)\s*&&/);
    if (m?.[1]) {
      const cdTargetRaw = m[1].trim().replace(/^['\"]|['\"]$/g, "");
      const cdTarget = path.isAbsolute(cdTargetRaw)
        ? cdTargetRaw
        : path.resolve(cwd, cdTargetRaw);
      sf = state.findSettings(cdTarget);
    }
  }

  if (!sf) return { allowed: true };

  const s = state.readSettings(sf);
  if (!s || s.status !== "active") return { allowed: true };

  const notesDir = path.join(state.taskDirFromSettings(sf), "_notes");
  const reason = fsm.guardToolCall(s, toolName, toolInput, notesDir);

  if (reason) return { allowed: false, reason };
  return { allowed: true };
}

// --- Inject: SessionStart / PostCompact ---

const PHASE_RULES: Record<string, string> = {
  plan: `You are in **plan** phase. You are a PLANNER, not an executor.
- NEVER write code or edit source files outside _notes/
- ALL user messages are plan input
- You may READ any file. You may ONLY WRITE to _notes/`,

  implement: `You are in **implement** phase. Execute TODOs from _notes/plan.md.
- Each TODO = one git commit
- Call work_compact after each TODO
- Work autonomously`,

  "plan-verify": `You are in **plan-verify** phase. You are an AUDITOR, not a planner or executor.
- READ the plan and codebase to verify plan quality
- NEVER write code or edit source files outside _notes/
- Produce a verification report, then auto-transition:
  - If READY (0 FAILs): call work_transition with phase=implement
  - If NEEDS REVISION (1+ FAILs): call work_transition with phase=plan and feedback=<findings>`,

  research: `You are in **research** phase. Explore and gather context.
- Save findings to _notes/research-*.md
- No code changes`,
};

export function inject(cwd: string): InjectResult {
  const sf = state.findSettings(cwd);
  if (!sf) return {};

  const s = state.readSettings(sf);
  if (!s || s.status !== "active") return {};

  const label = s.workId || s.name || "work";
  const taskDir = state.taskDirFromSettings(sf);
  const notesDir = path.join(taskDir, "_notes");

  const parts: string[] = [
    "## Work Context (post-compaction)",
    "",
    `**Active Work:** ${label}`,
    `**Phase:** ${s.phase}`,
    "",
    "### Phase Rules",
  ];

  const rules = PHASE_RULES[s.phase];
  if (rules) parts.push(rules);

  const worklog = notes.worklogTail(notesDir, 10);
  if (worklog) {
    parts.push("", "### Recent Progress", "```", worklog, "```");
  }

  return { additionalContext: parts.join("\n") };
}

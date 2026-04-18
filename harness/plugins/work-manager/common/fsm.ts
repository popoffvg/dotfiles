/**
 * Work Manager FSM — pure functions.
 * All transitions return { newState, effects }. No I/O.
 */

import * as path from "node:path";
import {
  Phase,
  type WorkSettings,
  type TransitionOpts,
  type TransitionResult,
  type SideEffect,
  type ToolInput,
} from "./types";
import { DEFAULT_PLAN_ALLOWED_COMMANDS } from "./state";

// --- Transition table ---

const ALLOWED_TRANSITIONS: Record<Phase, Phase[]> = {
  [Phase.Research]: [Phase.Plan],
  [Phase.Plan]: [Phase.Research, Phase.PlanVerify],
  [Phase.PlanVerify]: [Phase.Implement, Phase.Plan],
  [Phase.Implement]: [Phase.Plan, Phase.Implement],
};

/** Check if a phase transition is allowed */
export function canTransition(from: Phase, to: Phase): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Parse string to Phase enum, returns null if invalid */
function toPhase(s: string): Phase | null {
  const values = Object.values(Phase) as string[];
  return values.includes(s) ? (s as Phase) : null;
}

// --- Core transitions ---

/** Start new work */
export function start(
  branch: string,
  workId: string,
  name: string,
): TransitionResult {
  return {
    newState: {
      phase: Phase.Plan,
      workId,
      name: name || "unnamed work",
      status: "active",
      branch,
      phaseBeforeTodo: null,
      worktreePath: null,
      worktreeBranch: null,
      approveCommits: true,
      planAllowedCommands: DEFAULT_PLAN_ALLOWED_COMMANDS,
      planVerified: false,
    },
    effects: [
      { kind: "worklog", entry: "Work initialized" },
      { kind: "commit_notes", message: "init: work started" },
      { kind: "inject_skill", skill: "work-plan" },
      {
        kind: "notify",
        message: `Work started: ${workId || name || branch}`,
        level: "success",
      },
    ],
  };
}

/** Transition between phases */
export function transition(
  state: WorkSettings,
  to: Phase,
  opts?: TransitionOpts,
): TransitionResult {
  const from = toPhase(state.phase);
  if (!from) {
    return {
      newState: {},
      effects: [
        {
          kind: "notify",
          message: `Invalid current phase: ${state.phase}`,
          level: "error",
        },
      ],
    };
  }

  if (!canTransition(from, to)) {
    return {
      newState: {},
      effects: [
        {
          kind: "notify",
          message: `Cannot transition from ${from} to ${to}`,
          level: "error",
        },
      ],
    };
  }

  switch (to) {
    case Phase.Plan:
      return transitionToPlan(from, state, opts);
    case Phase.Research:
      return transitionToResearch(from, state);
    case Phase.PlanVerify:
      return transitionToPlanVerify(from, state);
    case Phase.Implement:
      return transitionToImplement(from, state, opts);
    default:
      return {
        newState: {},
        effects: [
          { kind: "notify", message: `Unknown target phase: ${to}`, level: "error" },
        ],
      };
  }
}

function transitionToPlan(
  from: Phase,
  _state: WorkSettings,
  opts?: TransitionOpts,
): TransitionResult {
  const effects: SideEffect[] = [
    { kind: "worklog", entry: `Phase transition: ${from} → plan` },
    { kind: "commit_notes", message: `phase: ${from} → plan` },
    { kind: "inject_skill", skill: "work-plan" },
  ];

  if (opts?.feedback) {
    effects.push({
      kind: "inject_skill",
      skill: "work-plan",
      context: `User feedback: ${opts.feedback}`,
    });
  }

  effects.push({
    kind: "compact",
    summary: `Transitioning to plan phase from ${from}. Discard implementation details, keep plan state and worklog.`,
  });

  return {
    newState: { phase: Phase.Plan, phaseBeforeTodo: null, planVerified: false },
    effects,
  };
}

function transitionToResearch(
  from: Phase,
  _state: WorkSettings,
): TransitionResult {
  return {
    newState: { phase: Phase.Research },
    effects: [
      { kind: "worklog", entry: `Phase transition: ${from} → research` },
      { kind: "inject_skill", skill: "work-research" },
      {
        kind: "compact",
        summary: `Transitioning to research phase from ${from}. Keep work context, discard plan details.`,
      },
    ],
  };
}

function transitionToPlanVerify(
  from: Phase,
  _state: WorkSettings,
): TransitionResult {
  return {
    newState: { phase: Phase.PlanVerify },
    effects: [
      { kind: "worklog", entry: `Phase transition: ${from} → plan-verify` },
      { kind: "commit_notes", message: `phase: ${from} → plan-verify` },
      { kind: "set_model", model: "opus" },
      { kind: "inject_skill", skill: "work-plan-verifier" },
      {
        kind: "compact",
        summary: `Entering plan verification. Keep the plan and research notes. Discard planning discussion.`,
      },
      {
        kind: "notify",
        message: "Running plan verification before implementation",
        level: "info",
      },
    ],
  };
}

function transitionToImplement(
  from: Phase,
  _state: WorkSettings,
  opts?: TransitionOpts,
): TransitionResult {
  const effects: SideEffect[] = [
    { kind: "worklog", entry: `Phase transition: ${from} → implement` },
    { kind: "commit_notes", message: `phase: ${from} → implement` },
    { kind: "set_model", model: "sonnet" },
    { kind: "inject_skill", skill: "work-implement" },
  ];

  if (opts?.focus) {
    effects.push({
      kind: "inject_skill",
      skill: "work-implement",
      context: `Focus: ${opts.focus}`,
    });
  }

  effects.push({
    kind: "compact",
    summary: `Entering implement phase. Keep the plan and worklog. Discard planning discussion.`,
  });

  effects.push({
    kind: "notify",
    message: "Entering implement phase",
    level: "info",
  });

  const implementMode = opts?.implementMode || "autopilot";

  return {
    newState: { phase: Phase.Implement, planVerified: true, implementMode },
    effects,
  };
}

// --- Terminal transitions ---

/** Mark work as done */
export function done(_state: WorkSettings): TransitionResult {
  return {
    newState: { status: "done" },
    effects: [
      { kind: "worklog", entry: "Work marked as done" },
      { kind: "commit_notes", message: "work: done" },
      {
        kind: "notify",
        message: "Work complete!",
        level: "success",
      },
    ],
  };
}

/** Cancel work (deactivate) */
export function cancel(_state: WorkSettings): TransitionResult {
  return {
    newState: { status: "done" },
    effects: [
      { kind: "worklog", entry: "Work cancelled" },
      { kind: "commit_notes", message: "work: cancelled" },
      {
        kind: "notify",
        message: "Work deactivated",
        level: "info",
      },
    ],
  };
}

/** Session end — persist state */
export function sessionEnd(state: WorkSettings): TransitionResult {
  return {
    newState: {},
    effects: [
      {
        kind: "worklog",
        entry: `Session ended (phase: ${state.phase})`,
      },
      { kind: "commit_notes", message: `session end (phase: ${state.phase})` },
    ],
  };
}

export function guardWorkNextPhase(state: WorkSettings): {
  allowed: boolean;
  autoResumeImplement: boolean;
  reason?: string;
} {
  const phase = state.phase as Phase;

  if (phase === Phase.Implement) {
    return { allowed: true, autoResumeImplement: false };
  }

  return {
    allowed: false,
    autoResumeImplement: false,
    reason: `Phase is '${state.phase}', not implement. Use /work:implement first.`,
  };
}

// --- Guards ---

/** Read-only commands allowed in all guarded phases */
const READ_ONLY_COMMANDS = [
  "cat", "head", "tail", "less", "grep", "rg", "find", "ls", "tree",
  "wc", "file", "stat", "echo", "pwd",
  "git log", "git show", "git diff", "git status", "git branch",
  "gh api", "gh pr list", "gh pr view", "gh pr status", "gh pr checks",
  "gh issue list", "gh issue view", "gh issue status",
  "gh run list", "gh run view", "gh repo view",
];


function isCmdInList(cmd: string, list: string[]): boolean {
  return list.some((prefix) => cmd === prefix || cmd.startsWith(prefix + " "));
}

function isPlanCheckboxCompletionOnly(input: ToolInput): boolean {
  const edits = (input.edits as Array<{ oldText?: string; newText?: string }> | undefined) || [];
  if (!Array.isArray(edits) || edits.length === 0) return false;

  return edits.every((e) => {
    const oldText = e?.oldText;
    const newText = e?.newText;
    if (typeof oldText !== "string" || typeof newText !== "string") return false;

    if (!oldText.includes("[ ]")) return false;
    const expected = oldText.replace("[ ]", "[x]");
    return newText === expected;
  });
}

/**
 * Guard a tool call based on current phase.
 * Returns null if allowed, or a reason string if blocked.
 */
export function guardToolCall(
  state: WorkSettings,
  toolName: string,
  input: ToolInput,
  notesDir: string,
): string | null {
  const phase = state.phase as Phase;
  const isPlan = phase === Phase.Plan || phase === Phase.PlanVerify;
  const isImplement = phase === Phase.Implement;

  if (!isPlan && !isImplement) return null;

  // --- Claude TODO tool guard ---
  if (isImplement) {
    const t = toolName.toLowerCase();
    if (t === "todowrite" || t === "todo_write" || t === "todo") {
      return "Implement phase: Claude TODO list writes are disabled. Track progress in _notes/worklog.md and complete plan checkboxes in _notes/plan.md.";
    }
  }

  // --- Bash guard ---
  if (toolName === "Bash" || toolName === "bash") {
    const cmd = (input.command || "").trim();
    const chained = cmd.match(/^cd\s+.+?\s*&&\s*(.+)$/);
    const candidate = (chained?.[1] || cmd).trim();

    if (isPlan) {
      const allowed = state.planAllowedCommands?.length
        ? state.planAllowedCommands
        : READ_ONLY_COMMANDS;
      if (!isCmdInList(candidate, allowed)) {
        return "Plan phase: bash commands that modify files are not allowed. Only reading/inspecting is permitted. Write your plan in _notes/ using edit/write tools.";
      }
    }

    if (isImplement && state.implementMode !== "autopilot") {
      if (isCmdInList(candidate, ["git add", "git commit", "git stage"])) {
        return "Implement phase: git staging and committing are reserved for work-manager. Finish TODO implementation, then hand off for manager-owned commit.";
      }
    }

    return null;
  }

  // --- Edit/Write guard ---
  if (
    toolName === "Edit" || toolName === "edit" ||
    toolName === "Write" || toolName === "write"
  ) {
    const targetPath =
      (input.file_path as string | undefined) ||
      (input.path as string | undefined) ||
      (input.filePath as string | undefined) ||
      "";
    if (!targetPath) return null;

    const resolved = path.resolve(targetPath);
    const notesResolved = path.resolve(notesDir);
    const isInNotes =
      resolved.startsWith(notesResolved + path.sep) || resolved === notesResolved;

    if (isPlan) {
      if (!isInNotes) {
        return `Plan phase: cannot modify files outside _notes/. Tried to ${toolName}: ${targetPath}. Add this to the plan instead.`;
      }
      return null;
    }

    if (isImplement && state.implementMode !== "autopilot") {
      const planPath = path.resolve(notesDir, "plan.md");
      if (resolved === planPath) {
        const isEditTool = toolName === "Edit" || toolName === "edit";
        if (isEditTool && isPlanCheckboxCompletionOnly(input)) {
          return null;
        }

        return "Implement phase: _notes/plan.md edits are restricted. Only checkbox completion edits (`- [ ]` → `- [x]`) are allowed.";
      }
    }
  }

  return null;
}

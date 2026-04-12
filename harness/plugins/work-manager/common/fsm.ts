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
  [Phase.Implement]: [Phase.Plan, Phase.Verify],
  [Phase.Verify]: [Phase.Verified, Phase.Plan, Phase.Implement],
  [Phase.Verified]: [Phase.Plan],
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
    case Phase.Verify:
      return transitionToVerify(from, state, opts);
    case Phase.Verified:
      return transitionToVerified(from, state, opts);
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
    newState: { phase: Phase.Plan, phaseBeforeTodo: null },
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

  return {
    newState: { phase: Phase.Implement },
    effects,
  };
}

function transitionToVerify(
  from: Phase,
  _state: WorkSettings,
  _opts?: TransitionOpts,
): TransitionResult {
  const effects: SideEffect[] = [
    { kind: "worklog", entry: `Phase transition: ${from} → verify` },
    { kind: "inject_skill", skill: "work-auto-verify" },
  ];

  effects.push({ kind: "set_model", model: "opus" });
  effects.push({
    kind: "compact",
    summary: `Implementation complete. Entering verify phase. Keep plan and acceptance criteria. Discard implementation details.`,
  });

  return {
    newState: { phase: Phase.Verify },
    effects,
  };
}

function transitionToVerified(
  _from: Phase,
  _state: WorkSettings,
  opts?: TransitionOpts,
): TransitionResult {
  const effects: SideEffect[] = [
    { kind: "worklog", entry: `Phase transition: → verified` },
    { kind: "commit_notes", message: "phase: verified" },
    {
      kind: "notify",
      message: "Work verified! Use /work:abandon to end work-manager flow.",
      level: "success",
    },
  ];

  if (opts?.approved) {
    effects.unshift({
      kind: "worklog",
      entry: "Verify: approved",
    });
  }

  return {
    newState: { phase: Phase.Verified },
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

// --- Guards ---

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
  if (state.phase !== Phase.Plan && state.phase !== Phase.PlanVerify) return null;

  // Plan phase: block bash mutations
  if (toolName === "Bash" || toolName === "bash") {
    const cmd = input.command || "";
    const allowed = state.planAllowedCommands || DEFAULT_PLAN_ALLOWED_COMMANDS;
    const readOnly = allowed.some(
      (prefix) => cmd === prefix || cmd.startsWith(prefix + " "),
    );
    if (!readOnly) {
      return "Plan phase: bash commands that modify files are not allowed. Only reading/inspecting is permitted. Write your plan in _notes/ using edit/write tools.";
    }
    return null;
  }

  // Plan phase: block file edits outside _notes/
  if (
    toolName === "Edit" ||
    toolName === "edit" ||
    toolName === "Write" ||
    toolName === "write"
  ) {
    const targetPath = input.file_path || "";
    if (!targetPath) return null;

    const resolved = path.resolve(targetPath);
    const notesResolved = path.resolve(notesDir);

    if (
      resolved.startsWith(notesResolved + path.sep) ||
      resolved === notesResolved
    ) {
      return null; // Allow writes to _notes/
    }

    return `Plan phase: cannot modify files outside _notes/. Tried to ${toolName}: ${targetPath}. Add this to the plan instead.`;
  }

  return null;
}

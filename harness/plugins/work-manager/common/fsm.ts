/**
 * Work Manager FSM — pure functions.
 * All transitions return { newState, effects }. No I/O.
 */

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
      { kind: "inject_skill", skill: "plan" },
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
    { kind: "inject_skill", skill: "plan" },
  ];

  if (opts?.feedback) {
    effects.push({
      kind: "inject_skill",
      skill: "plan",
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
      { kind: "inject_skill", skill: "research" },
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
      { kind: "inject_skill", skill: "plan-verifier" },
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
    { kind: "inject_skill", skill: "implement" },
  ];

  if (opts?.focus) {
    effects.push({
      kind: "inject_skill",
      skill: "implement",
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

const GIT_PUSH_PREFIXES = ["git push"];

function isCmdInList(cmd: string, list: string[]): boolean {
  return list.some((prefix) => cmd === prefix || cmd.startsWith(prefix + " "));
}

/**
 * Guard a tool call based on current phase.
 * Returns null if allowed, or a reason string if blocked.
 */
export function guardToolCall(
  state: WorkSettings,
  toolName: string,
  input: ToolInput,
  _notesDir: string,
): string | null {
  const phase = state.phase as Phase;
  const isImplement = phase === Phase.Implement;

  if (!isImplement) return null;

  if (toolName === "Bash" || toolName === "bash") {
    const cmd = (input.command || "").trim();
    const chained = cmd.match(/^cd\s+.+?\s*&&\s*(.+)$/);
    const candidate = (chained?.[1] || cmd).trim();

    if (isCmdInList(candidate, GIT_PUSH_PREFIXES)) {
      return "Implement phase: git push is blocked. Show the git push command to the user and let them run it manually.";
    }
  }

  return null;
}

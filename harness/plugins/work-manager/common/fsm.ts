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
  [Phase.Implement]: [Phase.Plan, Phase.Verify, Phase.TodoDone],
  [Phase.TodoDone]: [Phase.Implement],
  [Phase.Verify]: [Phase.Verified, Phase.Plan],
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
    case Phase.TodoDone:
      return transitionToTodoDone(from, state);
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

  return {
    newState: { phase: Phase.Implement, planVerified: true },
    effects,
  };
}

function transitionToTodoDone(
  from: Phase,
  _state: WorkSettings,
): TransitionResult {
  return {
    newState: { phase: Phase.TodoDone },
    effects: [
      { kind: "worklog", entry: `Phase transition: ${from} → todo-done (staging & commit)` },
    ],
  };
}

function transitionToVerify(
  from: Phase,
  _state: WorkSettings,
  _opts?: TransitionOpts,
): TransitionResult {
  const effects: SideEffect[] = [
    { kind: "worklog", entry: `Phase transition: ${from} → verify` },
    { kind: "inject_skill", skill: "work-verify" },
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

/** Read-only commands allowed in all guarded phases */
const READ_ONLY_COMMANDS = [
  "cat", "head", "tail", "less", "grep", "rg", "find", "ls", "tree",
  "wc", "file", "stat", "echo", "pwd",
  "git log", "git show", "git diff", "git status", "git branch",
  "gh api", "gh pr list", "gh pr view", "gh pr status", "gh pr checks",
  "gh issue list", "gh issue view", "gh issue status",
  "gh run list", "gh run view", "gh repo view",
];

/** Test/lint commands additionally allowed in verify phase */
const VERIFY_EXTRA_COMMANDS = [
  "go test", "go vet",
  "npm test", "npm run test", "npm run lint",
  "pnpm test", "pnpm run test", "pnpm run lint",
  "yarn test", "make test", "make lint", "make check",
  "pytest", "ruff", "mypy", "flake8", "eslint",
  "golangci-lint", "shellcheck", "tsc",
  "mise run test", "mise run lint",
];

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
  notesDir: string,
): string | null {
  const phase = state.phase as Phase;
  const isPlan = phase === Phase.Plan || phase === Phase.PlanVerify;
  const isVerify = phase === Phase.Verify;
  const isImplement = phase === Phase.Implement;

  if (!isPlan && !isVerify && !isImplement) return null;

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

    if (isVerify) {
      const allowed = [...READ_ONLY_COMMANDS, ...VERIFY_EXTRA_COMMANDS];
      if (!isCmdInList(candidate, allowed)) {
        return "Verify phase: only read-only and test/lint commands are allowed. You are a reviewer — do not modify files via bash.";
      }
    }

    if (isImplement) {
      if (isCmdInList(candidate, ["git add", "git commit", "git stage"])) {
        return "Implement phase: git staging and committing are not allowed. Use /work:next to commit after a TODO is complete — it transitions to todo-done phase first.";
      }
    }

    return null;
  }

  // --- Edit/Write guard ---
  if (
    toolName === "Edit" || toolName === "edit" ||
    toolName === "Write" || toolName === "write"
  ) {
    const targetPath = input.file_path || "";
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

    if (isVerify) {
      if (isInNotes) return null;
      // Also allow .pi/work.settings.json for phase transitions
      const settingsDir = path.dirname(notesDir);
      const workSettings = path.resolve(settingsDir, ".pi", "work.settings.json");
      if (resolved === workSettings) return null;

      return `Verify phase: cannot modify source files. Only _notes/ and .pi/work.settings.json are allowed. You are a reviewer, not an implementer.`;
    }
  }

  return null;
}

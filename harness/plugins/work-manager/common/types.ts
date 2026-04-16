/**
 * Shared types for Work Manager v2.
 * No runtime dependencies — pure type definitions.
 */

export enum Phase {
  Research = "research",
  Plan = "plan",
  PlanVerify = "plan-verify",
  Implement = "implement",
  TodoDone = "todo-done",
  Verify = "verify",
  Verified = "verified",
}

export interface WorkSettings {
  phase: string;
  phaseBeforeTodo: string | null;
  workId: string;
  name: string;
  status: string;
  branch: string;
  worktreePath: string | null;
  worktreeBranch: string | null;
  approveCommits: boolean;
  planAllowedCommands: string[];
  planVerified: boolean;
}

export interface WorkState {
  phase: Phase;
  workId: string;
  name: string;
  status: string;
  branch: string;
  approveCommits: boolean;
}

export interface TransitionOpts {
  feedback?: string;
  focus?: string;
  hasCriteria?: boolean;
  approved?: boolean;
  reason?: string;
  fixNow?: boolean;
  choice?: "continue" | "return_to_plan";
  userInput?: string;
  text?: string;
}

export interface TransitionResult {
  newState: Partial<WorkSettings>;
  effects: SideEffect[];
}

export type SideEffect =
  | { kind: "inject_skill"; skill: string; context?: string }
  | { kind: "compact"; summary: string; inject?: string }
  | { kind: "worklog"; entry: string }
  | { kind: "commit_notes"; message: string }
  | {
      kind: "notify";
      message: string;
      level: "info" | "success" | "warning" | "error";
    }
  | { kind: "set_model"; model: "sonnet" | "opus" }
  | { kind: "ask_user"; question: string; options?: string[] }
  | { kind: "block_tool"; reason: string };

export interface ToolInput {
  command?: string;
  file_path?: string;
  content?: string;
  [key: string]: unknown;
}

/** Dependency-injected git function for notes management */
export type GitFn = (args: string, cwd: string) => string;

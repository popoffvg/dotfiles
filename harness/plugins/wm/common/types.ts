/**
 * Shared types for WM.
 * No runtime dependencies — pure type definitions.
 *
 * Phase state-machine types were removed: work is driven by agents, not a FSM.
 */

export interface WorkSettings {
  workId: string;
  name: string;
  status: string;
  branch: string;
  worktreePath: string | null;
  worktreeBranch: string | null;
  approveCommits: boolean;
  planAllowedCommands: string[];
}

export interface ToolInput {
  command?: string;
  file_path?: string;
  content?: string;
  [key: string]: unknown;
}

/** Dependency-injected git function for notes management */
export type GitFn = (args: string, cwd: string) => string;

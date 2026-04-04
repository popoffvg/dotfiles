/**
 * Shared event names and payload types for work ↔ atom communication.
 */

export const WORK_EVENTS = {
  /** atom requests work to create _notes/ for a subtask */
  CREATE_NOTES: "work:create-notes",
  /** atom requests full work-manager initialization for a subtask workspace */
  SUBTASK_INIT_REQUEST: "atom:subtask-init-request",
  /** Fired after each TODO is completed (work_compact called) */
  TODO_COMPLETED: "work:todo-completed",
  /** Fired when transitioning back to plan phase (from verify or implement interrupt) */
  RETURN_TO_PLAN: "work:return-to-plan",
} as const;

export interface CreateNotesPayload {
  /** Directory where _notes/ should be created */
  targetDir: string;
  /** Subtask name (for worklog entry) */
  subtaskName: string;
  /** Callback: resolve with notesDir path on success */
  resolve: (notesDir: string) => void;
  /** Callback: reject with error */
  reject: (err: Error) => void;
}

export interface TodoCompletedPayload {
  /** Summary of the completed TODO */
  summary: string;
  /** Path to _notes/ directory */
  notesDir: string;
  /** Recent worklog entries (last 15 lines) */
  recentWorklog: string;
}

export interface ReturnToPlanPayload {
  /** Reason for returning to plan */
  reason: string;
  /** Path to _notes/ directory */
  notesDir: string;
  /** Recent worklog entries (last 20 lines) */
  recentWorklog: string;
  /** Full plan content */
  planContent: string;
}

export interface SubtaskInitRequestPayload {
  /** Absolute subtask workspace dir (e.g. <task>/subtasks/<name>) */
  targetDir: string;
  /** Subtask slug/name */
  subtaskName: string;
  /** Parent context file that defines subtask scope (usually parent _notes/plan.md) */
  contextFile: string;
  /** Optional branch to persist into .pi/work.settings.json */
  branch?: string;
  /** Optional parent work ID to propagate */
  workId?: string;
  /** Optional human-readable name; defaults to subtaskName */
  name?: string;
  /** Optional approval mode; defaults to true */
  approveCommits?: boolean;
  /** Callback: resolve with initialized paths */
  resolve: (result: { notesDir: string; settingsFile: string }) => void;
  /** Callback: reject with error */
  reject: (err: Error) => void;
}

export const WORK_EVENTS = {
  SUBTASK_INIT_REQUEST: "work:subtask-init-request",
  TODO_COMPLETED: "work:todo-completed",
  RETURN_TO_PLAN: "work:return-to-plan",
} as const;

export interface TodoCompletedPayload {
  summary: string;
}

export interface ReturnToPlanPayload {
  reason: string;
  recentWorklog?: string;
}

export interface SubtaskInitRequestPayload {
  targetDir: string;
  subtaskName: string;
  contextFile: string;
  branch: string;
  workId?: string;
  name?: string;
  approveCommits?: boolean;
  resolve: (result: { notesDir: string; settingsFile: string }) => void;
  reject: (error: Error) => void;
}

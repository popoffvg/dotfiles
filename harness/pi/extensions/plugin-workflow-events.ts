export const PLUGIN_WORKFLOW_EVENTS = {
  START: "plugin-workflow:start",
  END: "plugin-workflow:end",
  EVENT: "plugin-workflow:event",
} as const;

export interface PluginWorkflowStartPayload {
  plugin: string;
  taskId: string;
  task: string;
  details?: string;
}

export interface PluginWorkflowEndPayload {
  plugin: string;
  taskId: string;
  status: "ok" | "error" | "cancelled";
  details?: string;
}

export interface PluginWorkflowEventPayload {
  plugin: string;
  event: string;
  details?: string;
}

// Keep this file safe if extension loader picks it up as a top-level extension.
export default function () {}

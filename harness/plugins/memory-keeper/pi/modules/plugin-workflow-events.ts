import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

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

// This module only exports event-type constants and payload types.
// register() is a no-op so it can be uniformly invoked from index.ts.
export function register(_pi: ExtensionAPI): void {}

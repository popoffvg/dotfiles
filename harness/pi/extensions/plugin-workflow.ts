import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  PLUGIN_WORKFLOW_EVENTS,
  type PluginWorkflowEventPayload,
  type PluginWorkflowStartPayload,
  type PluginWorkflowEndPayload,
} from "./plugin-workflow-events";

interface ActiveTask {
  plugin: string;
  task: string;
  startedAt: number;
}

interface CompletedTask {
  plugin: string;
  task: string;
  status: "ok" | "error" | "cancelled";
  durationMs: number;
  finishedAt: string;
  details?: string;
}

interface EventLog {
  at: string;
  plugin: string;
  event: string;
  details?: string;
}

export default function (pi: ExtensionAPI) {
  let enabled = true;
  const active = new Map<string, ActiveTask>();
  let completed: CompletedTask[] = [];
  let events: EventLog[] = [];

  function nowIso(): string {
    return new Date().toISOString();
  }

  function pushEvent(payload: PluginWorkflowEventPayload): void {
    events.push({ at: nowIso(), plugin: payload.plugin, event: payload.event, details: payload.details });
    if (events.length > 200) events = events.slice(-200);
  }

  function pushCompleted(task: CompletedTask): void {
    completed.push(task);
    if (completed.length > 200) completed = completed.slice(-200);
  }

  function summarize() {
    const total = completed.length;
    const errors = completed.filter((t) => t.status === "error").length;
    const avgMs = total > 0
      ? Math.round(completed.reduce((acc, t) => acc + t.durationMs, 0) / total)
      : 0;
    return { total, errors, avgMs, active: active.size };
  }

  function refreshStatus(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    if (!enabled) {
      ctx.ui.setStatus("plugin-monitor", undefined);
      return;
    }
    const s = summarize();
    const state = s.errors > 0 ? "FAIL" : "OK";
    ctx.ui.setStatus("plugin-monitor", `🧩 ${state}`);
  }

  function clearState() {
    active.clear();
    completed = [];
    events = [];
  }

  pi.on("session_start", async (_event, ctx) => {
    clearState();
    refreshStatus(ctx);
  });

  pi.events.on(PLUGIN_WORKFLOW_EVENTS.EVENT, (payload: PluginWorkflowEventPayload) => {
    if (!enabled) return;
    pushEvent(payload);
  });

  pi.events.on(PLUGIN_WORKFLOW_EVENTS.START, (payload: PluginWorkflowStartPayload) => {
    if (!enabled) return;
    active.set(payload.taskId, {
      plugin: payload.plugin,
      task: payload.task,
      startedAt: Date.now(),
    });
    if (payload.details) {
      pushEvent({ plugin: payload.plugin, event: `${payload.task}:start`, details: payload.details });
    }
  });

  pi.events.on(PLUGIN_WORKFLOW_EVENTS.END, (payload: PluginWorkflowEndPayload) => {
    if (!enabled) return;
    const started = active.get(payload.taskId);
    const startedAt = started?.startedAt ?? Date.now();
    const task = started?.task ?? payload.taskId;
    const plugin = started?.plugin ?? payload.plugin;
    const durationMs = Math.max(0, Date.now() - startedAt);
    active.delete(payload.taskId);

    pushCompleted({
      plugin,
      task,
      status: payload.status,
      durationMs,
      finishedAt: nowIso(),
      details: payload.details,
    });

    pushEvent({
      plugin,
      event: `${task}:${payload.status}`,
      details: payload.details,
    });
  });

  pi.on("agent_end", async (_event, ctx) => {
    refreshStatus(ctx);
  });

  pi.registerCommand("plugin:monitor", {
    description: "Monitor complex plugin workflows (status/tail/details)",
    handler: async (args, ctx) => {
      const [sub, rawN] = (args || "status").trim().split(/\s+/);
      const n = Number.parseInt(rawN || "10", 10);

      if (sub === "on") {
        enabled = true;
        refreshStatus(ctx);
        ctx.ui.notify("Plugin workflow monitor enabled", "success");
        return;
      }

      if (sub === "off") {
        enabled = false;
        refreshStatus(ctx);
        ctx.ui.notify("Plugin workflow monitor disabled", "info");
        return;
      }

      if (sub === "clear") {
        clearState();
        refreshStatus(ctx);
        ctx.ui.notify("Plugin workflow monitor state cleared", "info");
        return;
      }

      if (sub === "tail") {
        const tailSize = Number.isFinite(n) && n > 0 ? n : 10;
        const lines = events.slice(-tailSize).map((e) =>
          `${e.at}  ${e.plugin}  ${e.event}${e.details ? `  — ${e.details}` : ""}`,
        );
        ctx.ui.notify(lines.length ? lines.join("\n") : "No plugin workflow events yet", "info");
        return;
      }

      if (sub === "details") {
        const detailSize = Number.isFinite(n) && n > 0 ? n : 20;
        const s = summarize();
        const errorIcon = s.errors > 0 ? "❌" : "✅";

        const failures = completed
          .filter((t) => t.status === "error" || t.status === "cancelled")
          .slice(-detailSize)
          .map((t) =>
            `${t.finishedAt}  ${t.plugin} :: ${t.task} -> ${t.status} (${t.durationMs}ms)${t.details ? ` — ${t.details}` : ""}`,
          );

        const recentEvents = events
          .slice(-detailSize)
          .map((e) => `${e.at}  ${e.plugin}  ${e.event}${e.details ? ` — ${e.details}` : ""}`);

        const lines = [
          `Plugin workflow details (${enabled ? "enabled" : "disabled"})`,
          `${errorIcon} ${s.errors} errors · ${s.active} active · ${s.total} done · avg ${s.avgMs}ms`,
          "",
          `Recent failures (last ${detailSize}):`,
          ...(failures.length > 0 ? failures.map((f) => `  ${f}`) : ["  ✅ none"]),
          "",
          `Recent events (last ${detailSize}):`,
          ...(recentEvents.length > 0 ? recentEvents.map((e) => `  ${e}`) : ["  (none)"]),
          "",
          "Tip: /plugin:monitor tail 20",
        ];

        refreshStatus(ctx);
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      const s = summarize();
      const byPlugin = new Map<string, { total: number; errors: number; avgMs: number }>();
      for (const t of completed) {
        const current = byPlugin.get(t.plugin) ?? { total: 0, errors: 0, avgMs: 0 };
        current.total += 1;
        if (t.status === "error") current.errors += 1;
        current.avgMs += t.durationMs;
        byPlugin.set(t.plugin, current);
      }

      const header = [
        `Plugin workflow monitor (${enabled ? "enabled" : "disabled"})`,
        `Active tasks: ${s.active}`,
        `Completed tasks: ${s.total}`,
        `Errors: ${s.errors}`,
        `Avg duration: ${s.avgMs}ms`,
        "",
        "By plugin:",
      ];

      const pluginLines = [...byPlugin.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([plugin, agg]) => {
          const avgMs = Math.round(agg.avgMs / Math.max(1, agg.total));
          return `  ${plugin}: ${agg.total} tasks, ${agg.errors} errors, avg ${avgMs}ms`;
        });

      const activeLines = [...active.values()].map((a) =>
        `  ${a.plugin} :: ${a.task} (${Date.now() - a.startedAt}ms)`,
      );

      const recent = completed.slice(-5).map((t) =>
        `  ${t.finishedAt}  ${t.plugin} :: ${t.task} -> ${t.status} (${t.durationMs}ms)`,
      );

      const body = [
        ...header,
        ...(pluginLines.length > 0 ? pluginLines : ["  (no completed tasks)"]),
        "",
        "Active now:",
        ...(activeLines.length > 0 ? activeLines : ["  (none)"]),
        "",
        "Recent completed:",
        ...(recent.length > 0 ? recent : ["  (none)"]),
        "",
        "Tips: /plugin:monitor tail 20 · /plugin:monitor details 20",
      ];

      refreshStatus(ctx);
      ctx.ui.notify(body.join("\n"), "info");
    },
  });
}

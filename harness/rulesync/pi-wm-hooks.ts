import { spawn } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type HookResult = { block: boolean; reason: string; context: string };

function runWmHook(event: string, payload: Record<string, unknown>): Promise<HookResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [
      "__HOME__/.pi/agent/harness/wm_hooks.py", "--runtime", "pi",
      "--root", "__HOME__/.pi/agent/harness/plugins/wm", "--event", event,
    ]);
    let output = "";
    let error = "";
    child.stdout.on("data", value => { output += value; });
    child.stderr.on("data", value => { error += value; });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) return reject(new Error(error || "WM hook process failed."));
      try { resolve(JSON.parse(output)); } catch (cause) { reject(cause); }
    });
    child.stdin.on("error", reject);
    child.stdin.end(JSON.stringify(payload));
  });
}

export default function (pi: ExtensionAPI) {
  let text = "";
  let stopActive = false;
  const payload = (ctx: ExtensionContext) => ({
    cwd: ctx.cwd, session_id: ctx.sessionManager.getSessionId(),
    transcript_path: ctx.sessionManager.getSessionFile(),
  });
  pi.on("session_start", async (_event, ctx) => {
    text = (await runWmHook("SessionStart", { ...payload(ctx), source: "startup" })).context;
    stopActive = false;
  });
  pi.on("before_agent_start", async (event, ctx) => {
    stopActive = false;
    const result = await runWmHook("UserPromptSubmit", { ...payload(ctx), prompt: event.prompt });
    const instructions = [text, result.context].filter(Boolean).join("\n");
    return { systemPrompt: event.systemPrompt + (instructions ? "\n\n" + instructions : "") };
  });
  pi.on("tool_call", async (event, ctx) => {
    try {
      const result = await runWmHook("PreToolUse", { ...payload(ctx), tool_name: event.toolName, tool_input: event.input });
      if (result.block) return { block: true, reason: result.reason };
    } catch (error) {
      return { block: true, reason: `WM tool guard failed: ${error}` };
    }
  });
  pi.on("tool_result", async (event, ctx) => {
    if (event.isError) return;
    const result = await runWmHook("PostToolUse", {
      ...payload(ctx), tool_name: event.toolName, tool_input: event.input,
      tool_response: { stdout: event.content.filter(item => item.type === "text").map(item => item.text).join("\n") },
    });
    if (result.context) {
      return { content: [...event.content, { type: "text", text: result.context }] };
    }
  });
  pi.on("session_before_compact", async (_event, ctx) => {
    const result = await runWmHook("PreCompact", payload(ctx));
    if (result.context) text = result.context;
  });
  pi.on("session_compact", async (_event, ctx) => {
    text = (await runWmHook("SessionStart", { ...payload(ctx), source: "compact" })).context;
  });
  pi.on("agent_before_settle", async (event, ctx) => {
    const result = await runWmHook("Stop", { ...payload(ctx), stop_hook_active: stopActive });
    if (!result.block) return;
    stopActive = true;
    return {
      entries: [...event.entries, { type: "custom_message", customType: "wm-hooks", content: result.reason, display: true }],
      continue: true,
    };
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    const result = await runWmHook("SessionEnd", payload(ctx));
    if (result.context && ctx.hasUI) ctx.ui.notify(result.context, "warning");
  });
}

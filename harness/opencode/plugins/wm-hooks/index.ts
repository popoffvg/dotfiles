import { spawn } from "node:child_process";
import { Plugin } from "@opencode/plugin";
import { Error as ToolError } from "@opencode/plugin/promise/tool";

type HookResult = { block: boolean; reason: string; context: string };

function runWmHook(event: string, payload: Record<string, unknown>): Promise<HookResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [
      "{{HOME}}/.config/opencode/harness/wm_hooks.py", "--runtime", "opencode",
      "--root", "{{HOME}}/.config/opencode/harness/plugins/wm", "--event", event,
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

export default Plugin.define({
  id: "dotfiles.wm-hooks",
  async setup(context) {
    const sessions = new Map<string, {
      ready: Promise<HookResult>; cwd: string; startup: string; prompt: string; tool: string; stopActive: boolean;
    }>();
    const sessionState = async (sessionID: Parameters<typeof context.session.get>[0]["sessionID"]) => {
      const session = await context.session.get({ sessionID });
      let state = sessions.get(sessionID);
      if (!state) {
        state = {
          ready: runWmHook("SessionStart", { cwd: session.location.directory, session_id: sessionID, source: "startup" }),
          cwd: session.location.directory, startup: "", prompt: "", tool: "", stopActive: false,
        };
        sessions.set(sessionID, state);
        state.startup = (await state.ready).context;
      }
      await state.ready;
      state.cwd = session.location.directory;
      return { state, payload: { cwd: session.location.directory, session_id: sessionID } };
    };
    await context.session.hook("prompt", async event => {
      const { state, payload } = await sessionState(event.sessionID);
      const result = await runWmHook("UserPromptSubmit", { ...payload, prompt: event.prompt.text });
      state.prompt = result.context;
      state.tool = "";
      if (!event.metadata?.wmContinuation) state.stopActive = false;
    });
    await context.session.hook("context", async event => {
      const { state } = await sessionState(event.sessionID);
      const text = [state.startup, state.prompt, state.tool].filter(Boolean).join("\n");
      if (text) event.system.push({ type: "text", text });
    });
    await context.session.hook("compaction", async event => {
      const { state, payload } = await sessionState(event.sessionID);
      const result = await runWmHook("PreCompact", payload);
      if (result.context) event.system.push({ type: "text", text: result.context });
      state.startup = (await runWmHook("SessionStart", { ...payload, source: "compact" })).context;
      state.prompt = "";
      state.tool = "";
    });
    await context.tool.hook("execute.before", async event => {
      const { state, payload } = await sessionState(event.sessionID);
      const result = await runWmHook("PreToolUse", { ...payload, tool_name: event.tool, tool_input: event.input });
      if (result.block) throw new ToolError({ message: result.reason });
      if (result.context) state.tool = result.context;
    });
    await context.tool.hook("execute.after", async event => {
      if (event.status !== "completed") return;
      const { state, payload } = await sessionState(event.sessionID);
      const result = await runWmHook("PostToolUse", {
        ...payload, tool_name: event.tool, tool_input: event.input,
        tool_response: { stdout: typeof event.result.content === "string" ? event.result.content : JSON.stringify(event.result.content) },
      });
      if (result.context) state.tool = result.context;
    });
    const controller = new AbortController();
    const events = context.event.subscribe({
      types: ["session.execution.succeeded", "session.archived", "session.deleted"],
      signal: controller.signal,
    });
    const worker = (async () => {
      for await (const event of events) {
        const sessionID = event.data.sessionID;
        const state = sessions.get(sessionID);
        if (!state) continue;
        const payload = { cwd: event.location?.directory ?? state.cwd, session_id: sessionID };
        if (event.type !== "session.execution.succeeded") {
          await runWmHook("SessionEnd", payload);
          sessions.delete(sessionID);
          continue;
        }
        const result = await runWmHook("Stop", { ...payload, stop_hook_active: state.stopActive });
        if (result.block) {
          state.stopActive = true;
          await context.session.prompt({
            sessionID, text: result.reason, metadata: { wmContinuation: true }, delivery: "queue",
          });
        }
      }
    })();
    worker.catch(error => { if (!controller.signal.aborted) console.error("WM lifecycle stream failed:", error); });
    return () => controller.abort();
  },
});

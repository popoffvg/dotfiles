import { expect, mock, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

mock.module("@opencode/plugin", () => ({
  Plugin: { define: (value: unknown) => value },
}));
mock.module("@opencode/plugin/promise/tool", () => ({
  Error: class extends Error { constructor(input: { message: string }) { super(input.message); } },
}));

function hookFixture(runtime: string) {
  const home = mkdtempSync(join(tmpdir(), "wm-native-"));
  const directory = runtime === "pi" ? ".pi/agent" : ".config/opencode";
  const library = join(home, directory, "harness");
  mkdirSync(join(library, "plugins"), { recursive: true });
  const wm = new URL("../../plugins/wm/", import.meta.url);
  symlinkSync(wm, join(library, "plugins/wm"));
  copyFileSync(new URL("../wm_hooks.py", import.meta.url), join(library, "wm_hooks.py"));
  copyFileSync(new URL("hooks/hooks.json", wm), join(library, "wm-hooks.json"));
  const source = runtime === "pi"
    ? new URL("../pi-wm-hooks.ts", import.meta.url)
    : new URL("../../opencode/plugins/wm-hooks/index.ts", import.meta.url);
  const module = join(home, "adapter.ts");
  writeFileSync(module, readFileSync(source, "utf8").replaceAll("{{HOME}}", home).replaceAll("__HOME__", home));
  const cwd = join(home, "project");
  mkdirSync(join(cwd, ".notes"), { recursive: true });
  writeFileSync(join(cwd, ".notes/spec.md"), "---\nstatus: review\n---\n");
  return { home, cwd, module };
}

test("OpenCode native hooks inject notes and block invalid writes", async () => {
  const fixture = hookFixture("opencode");
  try {
    const hooks = new Map<string, (event: any) => Promise<any>>();
    const plugin = (await import(pathToFileURL(fixture.module).href)).default;
    const cleanup = await plugin.setup({
      session: {
        get: async () => ({ location: { directory: fixture.cwd } }),
        hook: async (name: string, callback: (event: any) => Promise<any>) => { hooks.set(name, callback); },
      },
      tool: { hook: async (name: string, callback: (event: any) => Promise<any>) => { hooks.set(name, callback); } },
      event: { subscribe: async function* () {} },
    });
    await hooks.get("prompt")!({ sessionID: "session", prompt: { text: "continue" } });
    const event = { sessionID: "session", system: [] as Array<{ text: string }> };
    await hooks.get("context")!(event);
    expect(event.system.map(item => item.text).join("\n")).toContain("PHASE: review");
    await expect(hooks.get("execute.before")!({
      sessionID: "session", tool: "write", input: { path: ".notes/spec.md", content: "approve: invalid\n" },
    })).rejects.toThrow("approve");
    await hooks.get("execute.before")!({
      sessionID: "session", tool: "write", input: { path: ".notes/spec.md", content: "approve: none\n" },
    });
    await hooks.get("compaction")!(event);
    expect(event.system.map(item => item.text).join("\n")).toContain("review");
    cleanup();
  } finally {
    rmSync(fixture.home, { recursive: true, force: true });
  }
});

test("Pi native hooks inject notes and block invalid edits", async () => {
  const fixture = hookFixture("pi");
  try {
    const hooks = new Map<string, (event: any, ctx: any) => Promise<any>>();
    const plugin = (await import(pathToFileURL(fixture.module).href)).default;
    plugin({ on: (name: string, callback: (event: any, ctx: any) => Promise<any>) => { hooks.set(name, callback); } });
    const ctx = {
      cwd: fixture.cwd,
      sessionManager: { getSessionId: () => "session", getSessionFile: () => undefined },
    };
    await hooks.get("session_start")!({}, ctx);
    const prompt = await hooks.get("before_agent_start")!({ prompt: "continue", systemPrompt: "base" }, ctx);
    expect(prompt.systemPrompt).toContain("PHASE: review");
    const denied = await hooks.get("tool_call")!({
      toolName: "edit", input: { path: ".notes/spec.md", oldText: "status: review", newText: "approve: invalid" },
    }, ctx);
    expect(denied.block).toBe(true);
    const allowed = await hooks.get("tool_call")!({
      toolName: "edit", input: { path: ".notes/spec.md", oldText: "status: review", newText: "approve: none" },
    }, ctx);
    expect(allowed).toBeUndefined();
    expect(hooks.has("agent_before_settle")).toBe(true);
    expect(hooks.has("session_compact")).toBe(true);
    expect(hooks.has("session_shutdown")).toBe(true);
    if (Bun.which("jj")) {
      const stopped = await hooks.get("agent_before_settle")!({ entries: [] }, ctx);
      expect(stopped.continue).toBe(true);
      const second = await hooks.get("agent_before_settle")!({ entries: stopped.entries }, ctx);
      expect(second).toBeUndefined();
    }
  } finally {
    rmSync(fixture.home, { recursive: true, force: true });
  }
});

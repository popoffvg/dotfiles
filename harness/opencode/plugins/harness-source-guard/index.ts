import { spawnSync } from "node:child_process";
import { Plugin } from "@opencode/plugin";

export default Plugin.define({
  id: "dotfiles.harness-source-guard",
  async setup(context) {
    await context.tool.hook("execute.before", (event) => {
      if (!["edit", "patch", "apply_patch", "write", "shell"].includes(event.tool)) return;
      const input = typeof event.input === "object" && event.input !== null ? event.input as Record<string, unknown> : { patch: event.input };
      const result = spawnSync("python3", [
        "{{HOME}}/.config/opencode/harness/guard.py",
        "--home", "{{HOME}}", "--protocol", "opencode",
      ], {
        input: JSON.stringify({
          cwd: context.location.directory,
          tool_name: event.tool,
          tool_input: { ...input, path: input.path ?? input.filePath, patch: input.patch ?? input.patchText },
        }),
        encoding: "utf8",
        timeout: 5000,
      });
      if (result.status !== 0) {
        throw new Error(result.stderr?.trim() || "OpenCode harness source guard failed.");
      }
    });
  },
});

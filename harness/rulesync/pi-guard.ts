// Pi supplies a different event payload; keep its adapter separate from Claude.
import { spawnSync } from "node:child_process";

export default function (pi: any) {
  pi.on("tool_call", async (event: any, ctx: any) => {
    if (!["edit", "write", "apply_patch", "bash"].includes(event.toolName)) return;
    const result = spawnSync("python3", ["__GUARD__", "--home", "__HOME__", "--protocol", "pi"], {
      input: JSON.stringify({ cwd: ctx.cwd, tool_input: event.input }), encoding: "utf8",
    });
    if (result.status !== 0) {
      return { block: true, reason: result.stderr.trim() || "Harness source guard failed." };
    }
  });
}

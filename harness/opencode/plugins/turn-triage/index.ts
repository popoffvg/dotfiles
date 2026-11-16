import { readFileSync } from "node:fs";
import { Plugin } from "@opencode/plugin";
import { triageConfigPath } from "./triage-state";

export default Plugin.define({
  id: "dotfiles.turn-triage",
  async setup(context) {
    const { rule } = JSON.parse(readFileSync(triageConfigPath, "utf8"));
    await context.session.hook("context", event => {
      event.system.push({ type: "text", text: rule });
    });
  },
});

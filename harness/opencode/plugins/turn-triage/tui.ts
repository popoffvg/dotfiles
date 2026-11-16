import { readFileSync } from "node:fs";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { Plugin } from "@opencode/plugin/tui";
import { readTriageTag, triageConfigPath, triageTitle } from "./triage-state";

export default Plugin.define({
  id: "dotfiles.turn-triage.tui",
  setup(context) {
    if (process.env.ZED_TERM !== "true") return;
    const { marks } = JSON.parse(readFileSync(triageConfigPath, "utf8")) as {
      marks: Record<string, string[]>;
    };
    return context.ui.slot({
      append: "app",
      render: () => {
        const [frame, setFrame] = createSignal(0);
        const current = createMemo(() => {
          const route = context.ui.router.current();
          if (route.type !== "session") return { state: "untagged", name: "OpenCode" };
          const id = route.sessionID;
          const name = context.data.session.get(id)?.title || "OpenCode";
          const permission = context.data.session.permission.list(id) ?? [];
          const forms = context.data.session.form.list(id) ?? [];
          if (permission.length || forms.length) return { state: "question", name };
          if (context.data.session.status(id) === "running") return { state: "working", name };
          const messages = context.data.session.message.list(id);
          for (let index = messages.length - 1; index >= 0; index--) {
            const message = messages[index];
            if (message.type === "user") break;
            if (message.type !== "assistant") continue;
            const text = message.content.filter(part => part.type === "text").map(part => part.text).join("\n");
            return { state: readTriageTag(text), name };
          }
          return { state: "untagged", name };
        });
        let last = "";
        createEffect(() => {
          const { state, name } = current();
          const frames = marks[state] ?? marks.untagged;
          const title = triageTitle(frames[frame() % frames.length], name);
          if (title === last) return;
          context.renderer.setTerminalTitle(title);
          last = title;
        });
        const timer = setInterval(() => setFrame(value => value + 1), 1000);
        onCleanup(() => clearInterval(timer));
        return null;
      },
    });
  },
});

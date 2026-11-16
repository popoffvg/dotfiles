import { expect, test } from "bun:test";
import type { Context } from "@opencode/plugin/tui/context";
import { showSessionRewind } from "./session-rewind";

test("rewind restores files only after the selected prompt is confirmed", async () => {
  const staged: unknown[] = [];
  let confirmed = false;
  let selected: string | undefined = "earlier";
  let choice = "Undo conversation and files";
  const summarized: unknown[] = [];
  const context = {
    ui: {
      router: { current: () => ({ type: "session", sessionID: "one" }) },
      dialog: {
        select: async (options: { title: string; options: { title: string; value: unknown }[] }) =>
          options.title === "Choose an action" ? options.options.find(option => option.title === choice)?.value : selected,
        confirm: async () => confirmed,
        alert: async () => {},
      },
      toast: { show: () => {} },
    },
    data: { session: { status: () => "idle", sync: async () => {}, message: { sync: async () => {} } } },
    client: { rpc: () => ({ summarize: async (input: unknown) => { summarized.push(input); return { text: "The summary" }; } }), session: {
      context: async () => [{ type: "user", id: "earlier", text: "The earlier prompt", time: { created: 1 } }],
      revert: { stage: async (input: unknown) => { staged.push(input); } },
    } },
  } as unknown as Context;
  await showSessionRewind(context);
  expect(staged).toEqual([]);
  confirmed = true;
  await showSessionRewind(context);
  expect(staged).toEqual([{ sessionID: "one", messageID: "earlier", files: true }]);
  choice = "Undo conversation only";
  confirmed = false;
  await showSessionRewind(context);
  expect(staged).toHaveLength(1);
  confirmed = true;
  await showSessionRewind(context);
  expect(staged).toEqual([
    { sessionID: "one", messageID: "earlier", files: true },
    { sessionID: "one", messageID: "earlier", files: false },
  ]);
  for (const [title, direction] of [["Summarize above", "above"], ["Summarize below", "below"]]) {
    choice = title!;
    await showSessionRewind(context);
    expect(summarized.at(-1)).toEqual({ sessionID: "one", messageID: "earlier", direction });
    expect(staged).toHaveLength(2);
  }
  selected = undefined;
  await showSessionRewind(context);
  expect(staged).toHaveLength(2);
});

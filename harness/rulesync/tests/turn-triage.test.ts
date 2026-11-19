import { afterEach, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readTriageTag, triageTitle } from "../../opencode/plugins/turn-triage/triage-state";

const triage = JSON.parse(readFileSync(new URL("../../claude/scripts/turn-triage.json", import.meta.url), "utf8"));

test.each([
  ["Complete.\ntriage: done", "done"],
  ["Still active.\ntriage: wait", "wait"],
  ["Continue?\n**triage: question**", "question"],
  ["TRIAGE: DONE\n\n", "done"],
  ["triage: done\ntriage: question", "question"],
  ["triage: done\none\ntwo\nthree", "untagged"],
  ["Complete without a tag.", "untagged"],
  ["triage: unknown", "untagged"],
])("read the triage tag from %s", (text, state) => {
  expect(readTriageTag(text)).toBe(state);
});

test("remove terminal control characters from a session title", () => {
  expect(triageTitle("?", "Name\x1b]0;other\x07\n")).toBe("? Name ]0;other  ");
});

mock.module("@opencode/plugin", () => ({ Plugin: { define: (plugin: unknown) => plugin } }));
mock.module("@opencode/plugin/tui", () => ({ Plugin: { define: (plugin: unknown) => plugin } }));

const cleanups: Array<() => void> = [];
let effects: Array<() => void> = [];
mock.module("solid-js", () => ({
  createMemo: (read: () => unknown) => read,
  createSignal: (initial: number) => {
    let value = initial;
    return [() => value, (update: (current: number) => number) => {
      value = update(value);
      effects.forEach(effect => effect());
    }];
  },
  createEffect: (effect: () => void) => {
    effects.push(effect);
    effect();
  },
  onCleanup: (cleanup: () => void) => cleanups.push(cleanup),
}));
mock.module("node:fs", () => ({
  readFileSync: (path: string | URL, ...args: unknown[]) =>
    String(path).includes("{{HOME}}") ? JSON.stringify(triage) : readFileSync(path, ...args as []),
}));

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  effects = [];
  delete process.env.ZED_TERM;
});

test("inject the triage instruction inside a Zed terminal", async () => {
  process.env.ZED_TERM = "true";
  const { default: plugin } = await import("../../opencode/plugins/turn-triage/index");
  let hook: (event: { system: unknown[] }) => void = () => {};
  await plugin.setup({
    session: { hook: async (name: string, callback: typeof hook) => {
      expect(name).toBe("context");
      hook = callback;
    } },
  } as never);
  const event = { system: [] };
  hook(event);
  expect(event.system).toEqual([{ type: "text", text: triage.rule }]);
});

test.each([undefined, "", "false"])("skip triage instructions outside Zed with ZED_TERM=%s", async value => {
  if (value === undefined) delete process.env.ZED_TERM;
  else process.env.ZED_TERM = value;
  const { default: plugin } = await import("../../opencode/plugins/turn-triage/index");
  await expect(plugin.setup({} as never)).resolves.toBeUndefined();
});

test("update only the visible Zed session title and stop the timer on cleanup", async () => {
  process.env.ZED_TERM = "true";
  const { default: plugin } = await import("../../opencode/plugins/turn-triage/tui");
  const titles: string[] = [];
  let id = "active";
  let state = "idle";
  let permission: unknown[] = [];
  let forms: unknown[] = [];
  let messages: unknown[] = [{ type: "assistant", content: [{ type: "text", text: "triage: done" }] }];
  const context = {
    ui: {
      router: { current: () => ({ type: "session", sessionID: id }) },
      slot: ({ render }: { render: () => void }) => { render(); return () => cleanups.splice(0).forEach(stop => stop()); },
    },
    renderer: { setTerminalTitle: (title: string) => titles.push(title) },
    data: { session: {
      get: (sessionID: string) => ({ title: sessionID }),
      status: () => state,
      permission: { list: () => permission },
      form: { list: () => forms },
      message: { list: () => messages },
    } },
  };
  const stop = plugin.setup(context as never) as () => void;
  const update = () => effects.forEach(effect => effect());
  expect(titles.at(-1)).toBe("◉ active");
  state = "running";
  update();
  expect(titles.at(-1)).toBe("◰ active");
  permission = [{}];
  update();
  expect(titles.at(-1)).toBe("? active");
  permission = [];
  forms = [{}];
  update();
  expect(titles.at(-1)).toBe("? active");
  forms = [];
  state = "idle";
  for (const tag of ["question", "wait", "done"]) {
    messages = [{ type: "assistant", content: [{ type: "text", text: `triage: ${tag}` }] }];
    update();
    expect(titles.at(-1)).toBe(`${triage.marks[tag][0]} active`);
  }
  messages.push({ type: "user" });
  update();
  expect(titles.at(-1)).toBe("○ active");
  id = "other";
  update();
  expect(titles.at(-1)).toBe("○ other");
  expect(cleanups).toHaveLength(1);
  stop();
  expect(cleanups).toHaveLength(0);
});

test("leave non-Zed terminals unchanged", async () => {
  const { default: plugin } = await import("../../opencode/plugins/turn-triage/tui");
  expect(plugin.setup({} as never)).toBeUndefined();
});

import { expect, test } from "bun:test";
import { SideChats, type SideTurn } from "./side-chat";

test("side chat keeps follow-up turns separate for each main session", async () => {
  const saved = new Map<string, SideTurn[]>();
  const prompts: { sessionID: string; prompt: string }[] = [];
  const store = { get: async (key: string) => saved.get(key), set: async (key: string, turns: SideTurn[]) => { saved.set(key, structuredClone(turns)); } };
  const chat = new SideChats(store, async (sessionID, prompt) => { prompts.push({ sessionID, prompt }); return "The side answer"; });
  await chat.ask("one", "First question", async () => {});
  const restarted = new SideChats(store, async (sessionID, prompt) => { prompts.push({ sessionID, prompt }); return "The next answer"; });
  await restarted.ask("one", "Follow-up question", async () => {});
  expect(prompts[1]?.sessionID).toBe("one");
  expect(prompts[1]?.prompt).toContain("Assistant: The side answer");
  expect(prompts[1]?.prompt).toContain("User: Follow-up question");
  expect((await chat.list("two")).turns).toEqual([]);
  expect((await restarted.clear("one")).turns).toEqual([]);
});

test("side chat rejects concurrent questions and permits retry after a model error", async () => {
  const saved = new Map<string, SideTurn[]>();
  let finish: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const chat = new SideChats({ get: async key => saved.get(key), set: async (key, turns) => { saved.set(key, turns); } },
    async () => { await gate; throw new Error("Model unavailable"); });
  const pending = chat.ask("one", "Question", async () => {});
  await expect(chat.ask("one", "Second question", async () => {})).rejects.toThrow("in progress");
  await expect(chat.clear("one")).rejects.toThrow("must finish");
  finish?.();
  const result = await pending;
  expect(result.waiting).toBe(false);
  expect(result.turns.at(-1)?.author).toBe("error");
  await chat.clear("one");
  expect((await chat.list("one")).turns).toEqual([]);
});

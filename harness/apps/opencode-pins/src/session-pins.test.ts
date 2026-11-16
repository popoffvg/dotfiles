import { describe, expect, test } from "bun:test";
import { rankSessionPins, SessionPins, type PinRecord } from "./pin-ledger";
import { parsePinPrStatus } from "./pin-pr-status";

const first: PinRecord = { url: "https://github.com/acme/app/pull/1", title: "First PR", why: "The current task" };
const second: PinRecord = { url: "file:///tmp/review.md", title: "Review notes", why: "The review input" };

describe("session pins", () => {
  test("rejects incomplete and duplicate ranks while a full rank succeeds", () => {
    for (const order of [[second.url], [first.url, first.url], [first.url, "https://example.com/unknown"]]) {
      expect(() => rankSessionPins([first], { ...second, order })).toThrow("Pin order");
    }
    expect(rankSessionPins([first], { ...second, order: [second.url, first.url] })).toEqual([second, first]);
    expect(() => rankSessionPins([], { ...first, url: "javascript:alert(1)", order: ["javascript:alert(1)"] })).toThrow("Pin URL");
  });

  test("keeps sessions separate and restores pins after a server restart", async () => {
    const stored = new Map<string, readonly PinRecord[]>();
    const storage = {
      get: async (key: string) => stored.get(key),
      set: async (key: string, value: readonly PinRecord[]) => { stored.set(key, structuredClone(value)); },
    };
    const pins = new SessionPins(storage);
    await pins.pin("one", { ...first, order: [first.url] });
    await pins.pin("two", { ...second, order: [second.url] });
    const restarted = new SessionPins(storage);
    expect(await restarted.list("one")).toEqual([first]);
    expect(await restarted.list("two")).toEqual([second]);
    await expect(restarted.pin("one", { ...second, order: [second.url] })).rejects.toThrow("Pin order");
    expect(await restarted.list("one")).toEqual([first]);
  });

  test("serializes concurrent updates so a stale rank cannot remove a pin", async () => {
    let stored: readonly PinRecord[] | undefined;
    const pins = new SessionPins({
      get: async () => stored,
      set: async (_key, value) => { await Bun.sleep(1); stored = value; },
    });
    const updates = await Promise.allSettled([
      pins.pin("one", { ...first, order: [first.url] }),
      pins.pin("one", { ...second, order: [second.url] }),
    ]);
    expect(updates.map(result => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(await pins.list("one")).toEqual([first]);
  });
});

test("PR status uses the latest run and counts cancellation as failure", () => {
  const status = parsePinPrStatus({
    title: "The PR", state: "OPEN", isDraft: false, reviewRequests: [{}], mergeable: "CONFLICTING",
    statusCheckRollup: [
      { workflowName: "CI", name: "test", startedAt: "2026-11-16T10:00:00Z", status: "COMPLETED", conclusion: "SUCCESS" },
      { workflowName: "CI", name: "test", startedAt: "2026-11-16T11:00:00Z", status: "COMPLETED", conclusion: "CANCELLED" },
      { context: "lint", state: "SUCCESS" },
    ],
  }, 123);
  expect(status.detail).toBe("open · CI failed 1/2 · Review needed · Merge conflicts");
  expect(status.checkedAt).toBe(123);
});

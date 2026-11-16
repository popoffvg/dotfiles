import { expect, test } from "bun:test";
import { mergeSummaryRange, replaceSummaryMessages, selectSummaryMessages } from "./context-summary";

test("range summaries remove matching tool results and retain the other turns", () => {
  const messages = [
    { id: "first", role: "user" }, { id: "answer", role: "assistant" }, { role: "tool" },
    { id: "next", role: "user" }, { id: "later", role: "assistant" },
  ];
  const summary = { ids: ["first", "answer"], anchors: ["first"], text: "The summary" };
  const replacement = { id: "summary", role: "user" };
  expect(selectSummaryMessages(messages, new Set(summary.ids))).toEqual(messages.slice(0, 3));
  expect(replaceSummaryMessages(messages, summary, replacement)).toEqual([replacement, ...messages.slice(3)]);
  const below = { ids: ["next", "later"], anchors: ["next"], text: "The later summary" };
  expect(replaceSummaryMessages(messages, below, replacement)).toEqual([...messages.slice(0, 3), replacement]);
  const sideQuestion = { role: "user" };
  expect(replaceSummaryMessages([...messages, sideQuestion], below, replacement)).toEqual([...messages.slice(0, 3), replacement, sideQuestion]);
});

test("rewind cannot reintroduce a summary that includes removed user turns", () => {
  const summary = { ids: ["first", "next"], anchors: ["first", "next"], text: "Contains later work" };
  const reverted = [{ id: "first", role: "user" }];
  expect(replaceSummaryMessages(reverted, summary, { id: "summary", role: "user" })).toEqual(reverted);
  expect(mergeSummaryRange([summary, { ids: ["next", "last"], anchors: ["next"], text: "Overlap" }], ["last"]).sort()).toEqual(["first", "last", "next"]);
});

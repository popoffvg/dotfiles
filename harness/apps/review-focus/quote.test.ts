import { expect, test } from "bun:test";
import { quoteReason, wrapWords } from "./quote";

test("a one-line reason is all body, so a hand-typed reason keeps its first line", () => {
  const quoted = quoteReason("token minting moved before identity bind", 40);
  expect(quoted.header).toBeUndefined();
  expect(quoted.body).toEqual(["token minting moved before identity bind"]);
});

test("a multi-line reason keeps its first line as the header and quotes the rest", () => {
  const quoted = quoteReason("3 comment(s), latest by alice\nswap the two calls", 40);
  expect(quoted.header).toBe("3 comment(s), latest by alice");
  expect(quoted.body).toEqual(["swap the two calls"]);
});

test("a body split over several source lines joins before it wraps", () => {
  const quoted = quoteReason("header\nfirst line\nsecond line", 80);
  expect(quoted.body).toEqual(["first line second line"]);
});

test("wrapping breaks on whitespace and never exceeds the width", () => {
  const lines = wrapWords("the quick brown fox jumps over the lazy dog", 12);
  expect(lines).toEqual(["the quick", "brown fox", "jumps over", "the lazy dog"]);
});

test("a word longer than the width is hard-broken instead of overflowing the pane", () => {
  expect(wrapWords("supercalifragilistic", 8)).toEqual(["supercal", "ifragili", "stic"]);
});

test("a word longer than the width flushes the line it would have joined", () => {
  expect(wrapWords("ok supercalifragilistic", 8)).toEqual(["ok", "supercal", "ifragili", "stic"]);
});

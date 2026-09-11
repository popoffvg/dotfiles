import { expect, test } from "bun:test";
import { parseNumstat, parseSuggestions } from "./generate";

test("parseNumstat reads counts and keeps tabs inside a path", () => {
  expect(parseNumstat("12\t3\tsrc/auth.ts\n0\t7\tdocs/old.md\n")).toEqual([
    { path: "src/auth.ts", additions: 12, deletions: 3 },
    { path: "docs/old.md", additions: 0, deletions: 7 },
  ]);
});

test("parseNumstat counts a binary file as zero instead of NaN", () => {
  expect(parseNumstat("-\t-\tlogo.png\n")).toEqual([{ path: "logo.png", additions: 0, deletions: 0 }]);
});

test("parseSuggestions pulls the array out of a fenced reply", () => {
  const reply = 'Here you go:\n```json\n[{"path":"a.ts","why":"new branch"},{"path":"b.ts"}]\n```\n';
  expect(parseSuggestions(reply, new Set(["a.ts", "b.ts"]))).toEqual([{ path: "a.ts", why: "new branch" }, { path: "b.ts" }]);
});

test("parseSuggestions drops paths the diff does not carry, and repeats", () => {
  const reply = '[{"path":"a.ts"},{"path":"invented.ts"},{"path":"a.ts","why":"again"}]';
  expect(parseSuggestions(reply, new Set(["a.ts"]))).toEqual([{ path: "a.ts" }]);
});

test("parseSuggestions returns nothing for a reply with no array", () => {
  expect(parseSuggestions("I could not read the diff.", new Set(["a.ts"]))).toEqual([]);
  expect(parseSuggestions("[not json", new Set(["a.ts"]))).toEqual([]);
});

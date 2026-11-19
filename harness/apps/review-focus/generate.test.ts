import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseNumstat, parseSuggestions } from "./generate";

test("askAgent routes model and effort through the light tier and preserves explicit overrides", () => {
  const root = mkdtempSync(join(tmpdir(), "review-focus-model-"));
  const agent = join(root, "agent");
  const previousAgent = process.env.REVIEW_FOCUS_AGENT;
  const previousModel = process.env.REVIEW_FOCUS_AGENT_MODEL;
  try {
    const harness = join(root, ".claude/harness");
    mkdirSync(harness, { recursive: true });
    copyFileSync(new URL("../../rulesync/effort.py", import.meta.url), join(harness, "effort.py"));
    const ledger = JSON.parse(readFileSync(new URL("../../rulesync/effort-ledger.json", import.meta.url), "utf8"));
    ledger.runtimes.claude.profiles.light = { model: "configured-light-model", reasoning: "low" };
    writeFileSync(join(harness, "effort-ledger.json"), JSON.stringify(ledger));
    writeFileSync(agent, `#!${process.execPath}\nconsole.log(JSON.stringify(process.argv.slice(2)));\n`, { mode: 0o755 });
    process.env.REVIEW_FOCUS_AGENT = agent;
    for (const model of ["", "  ", "requested-model"]) {
      process.env.REVIEW_FOCUS_AGENT_MODEL = model;
      const source = new URL("./generate.ts", import.meta.url).pathname;
      const output = execFileSync(process.execPath, ["--eval",
        `import { askAgent } from ${JSON.stringify(source)}; process.stdout.write(askAgent(${JSON.stringify(root)}, "rank files", 5000));`,
      ], { encoding: "utf8", env: { ...process.env, HOME: root } });
      const args = JSON.parse(output) as string[];
      expect(args[args.indexOf("--model") + 1]).toBe(model.trim() || "configured-light-model");
      expect(args[args.indexOf("--effort") + 1]).toBe("low");
      expect(args.filter((arg) => arg === "--model")).toHaveLength(1);
      expect(args).toContain("-p");
      expect(args).toContain("rank files");
    }
  } finally {
    if (previousAgent === undefined) delete process.env.REVIEW_FOCUS_AGENT;
    else process.env.REVIEW_FOCUS_AGENT = previousAgent;
    if (previousModel === undefined) delete process.env.REVIEW_FOCUS_AGENT_MODEL;
    else process.env.REVIEW_FOCUS_AGENT_MODEL = previousModel;
    rmSync(root, { recursive: true, force: true });
  }
});

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

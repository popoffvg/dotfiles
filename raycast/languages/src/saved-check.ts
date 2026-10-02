import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { LanguageToolResult } from "./languagetool";

export function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// One file per check that found mistakes: the texts plus the LanguageTool rule of each fix.
export function saveCheck(
  inboxDir: string,
  result: LanguageToolResult,
): string {
  const now = new Date();
  const path = join(
    inboxDir,
    `${now.toISOString().slice(0, 19).replace(/:/g, "-")}.md`,
  );
  const rules = result.mistakes.map(
    (mistake) =>
      `| ${cell(mistake.ruleDescription)} (${cell(mistake.ruleId)}) | ${cell(mistake.category)} | ${cell(mistake.wrong)} → ${cell(mistake.fix)} | ${cell(mistake.message)} |`,
  );
  const body = [
    `# Grammar check ${now.toLocaleString()}`,
    "## Rules",
    [
      "| Rule | Category | Fix | Message |",
      "| --- | --- | --- | --- |",
      ...rules,
    ].join("\n"),
    "## Original",
    `~~~~\n${result.original}\n~~~~`,
    "## Corrected",
    `~~~~\n${result.corrected}\n~~~~`,
  ].join("\n\n");

  mkdirSync(inboxDir, { recursive: true });
  writeFileSync(path, `${body}\n`, "utf-8");
  return path;
}

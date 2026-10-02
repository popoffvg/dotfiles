import { languagesPreferences } from "./preferences";

const FENCE = /^\s*```/;

export interface GrammarMistake {
  ruleId: string;
  ruleDescription: string;
  category: string;
  message: string;
  wrong: string;
  fix: string;
}

export interface LanguageToolResult {
  original: string;
  corrected: string;
  mistakes: GrammarMistake[];
}

interface Match {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string; description: string; category: { name: string } };
}

// Character ranges of fenced code blocks: LanguageTool flags code as misspelled.
function codeRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let offset = 0;
  let fenceStart: number | undefined;
  for (const line of text.split("\n")) {
    if (FENCE.test(line)) {
      if (fenceStart === undefined) {
        fenceStart = offset;
      } else {
        ranges.push([fenceStart, offset + line.length]);
        fenceStart = undefined;
      }
    }
    offset += line.length + 1;
  }
  return ranges;
}

async function requestMatches(text: string): Promise<Match[]> {
  const { languageToolUrl, language } = languagesPreferences();
  let response: Response;
  try {
    response = await fetch(`${languageToolUrl}/v2/check`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, language }).toString(),
    });
  } catch {
    throw new Error(
      `LanguageTool server is not running at ${languageToolUrl}. Run: brew services start languagetool`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `LanguageTool: HTTP ${response.status} ${await response.text()}`,
    );
  }
  const { matches } = (await response.json()) as { matches: Match[] };
  return matches;
}

export async function checkWithLanguageTool(
  text: string,
): Promise<LanguageToolResult> {
  const code = codeRanges(text);
  const fixable = (await requestMatches(text))
    .filter(
      (match) =>
        !code.some(
          ([start, end]) => match.offset >= start && match.offset < end,
        ),
    )
    .sort((a, b) => a.offset - b.offset);

  let corrected = "";
  let cursor = 0;
  const mistakes: GrammarMistake[] = [];
  for (const match of fixable) {
    if (match.offset < cursor) continue;
    const fix = match.replacements[0]?.value;
    if (fix === undefined) continue;
    const wrong = text.slice(match.offset, match.offset + match.length);
    corrected += text.slice(cursor, match.offset) + fix;
    cursor = match.offset + match.length;
    mistakes.push({
      ruleId: match.rule.id,
      ruleDescription: match.rule.description,
      category: match.rule.category.name,
      message: match.message,
      wrong,
      fix,
    });
  }
  corrected += text.slice(cursor);

  return { original: text, corrected, mistakes };
}

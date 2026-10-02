import { languagesPreferences } from "./preferences";

const OLLAMA_URL = "http://localhost:11434";

const POLISH_PROMPT = [
  "Rewrite the user text so it reads naturally to a native English speaker.",
  "Keep the meaning, every idea, the line breaks, code, paths and identifiers.",
  "Do not add new information. Answer with the rewritten text only:",
  "no preface, no quotes around it, no notes after it.",
].join(" ");

// phi4-mini still opens with "Sure, here is the rewritten text:" and quotes the answer.
const PREFACE = /^(sure|certainly|of course|here)\b[^\n]*:[ \t]*\n+/i;

function withoutPreface(polished: string, original: string): string {
  const text = polished.trim().replace(PREFACE, "").trim();
  const quoted = text.match(/^"([\s\S]*)"$/);
  return quoted && !original.trim().startsWith('"')
    ? (quoted[1] ?? "").trim()
    : text;
}

export async function polishText(text: string): Promise<string> {
  const { polishModel } = languagesPreferences();
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: polishModel,
      system: POLISH_PROMPT,
      prompt: text,
      stream: false,
      options: { temperature: 0 },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `ollama ${polishModel}: HTTP ${response.status} ${await response.text()}`,
    );
  }
  const { response: polished } = (await response.json()) as {
    response: string;
  };
  return withoutPreface(polished, text);
}

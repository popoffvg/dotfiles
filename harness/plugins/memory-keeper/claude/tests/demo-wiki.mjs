import { readFileSync } from "fs";
import { generateText } from "ai";
import { loadConfig } from "../lib/config.mjs";
import { createModel } from "../lib/llm.mjs";
import { CLASSIFY_PROMPT } from "../worker/prompts.mjs";
import { qmdDedup, saveInsight } from "../worker/process-sessions.mjs";

const file = process.argv[2];
const lines = readFileSync(file, "utf8").trim().split("\n");
const msgs = [];
for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    if (obj.type === "user" && typeof obj.message?.content === "string") {
      const c = obj.message.content;
      if (!c.startsWith("<command") && !c.startsWith("<system") && !c.startsWith("<local"))
        msgs.push("User: " + c);
    }
    if (obj.type === "assistant" && Array.isArray(obj.message?.content)) {
      for (const b of obj.message.content) {
        if (b.type === "text" && b.text) msgs.push("Assistant: " + b.text);
      }
    }
  } catch {}
}

const budget = 6000;
let conv = "";
for (let i = msgs.length - 1; i >= 0; i--) {
  const candidate = msgs[i] + "\n\n" + conv;
  if (candidate.length > budget) break;
  conv = candidate;
}

const config = loadConfig();
const model = createModel(config);
const project = "pl";

console.log("=== SESSION PREVIEW ===");
console.log(conv.slice(0, 500) + "...\n");

console.log("=== LLM EXTRACTION (gemma-3-4b-it) ===");
const { text } = await generateText({
  model,
  prompt: CLASSIFY_PROMPT + `[Project: ${project}]\n\n` + conv,
  maxTokens: 800,
  temperature: 0.1,
});

const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
const parsed = JSON.parse(cleaned);
const results = Array.isArray(parsed) ? parsed : [parsed];

for (const r of results) {
  if (r.classification === "none") continue;
  console.log(`\n--- ${r.classification} | repo: ${r.repo} ---`);
  console.log(`## ${r.topic}`);
  console.log(r.body);

  const targetRepo = r.repo || project;
  const qmd = qmdDedup(r.topic, r.body, targetRepo);
  console.log(`\n[QMD dedup]: action=${qmd.action}${qmd.reason ? " reason=" + qmd.reason : ""}${qmd.links?.length ? " links=" + qmd.links.join(", ") : ""}`);

  if (qmd.action === "save") {
    let body = r.body;
    if (qmd.links?.length) body += `\n\n**See also**: ${qmd.links.join(", ")}`;
    const savedTo = saveInsight(config, targetRepo, r.classification, r.topic, body);
    if (savedTo) console.log(`\n[SAVED]: ${savedTo}`);
    else console.log(`\n[DEDUP]: skipped by heading check`);
  }
}

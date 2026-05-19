// Process a single event from the queue. Branches by event_type.
// On success: returns normally. On failure: throws (daemon handles requeue).
//
// The LLM is asked to return two arrays per event:
//   { long_term: [...], daily: [{themes, fact}] }
// Long-term entries flow through the existing insight/task/agent_edit pipeline
// with QMD dedup. Daily entries are appended to today's _daily/<date>.md file,
// theme-grouped.

import { join } from "path";
import {
  extractHeadings,
  saveInsight,
  qmdDedup,
} from "./process-sessions.mjs";
import { appendDailyFact } from "../lib/daily.mjs";
import { CLASSIFY_PROMPT, PROMPT_CLASSIFY_PROMPT } from "./prompts.mjs";

function parseJsonLoose(text) {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

/**
 * Normalize legacy / loose LLM responses into { long_term, daily }.
 * - Object with long_term/daily keys → pass-through
 * - Plain array → treat as long_term (legacy single-tier)
 * - Single object with classification → wrap in long_term
 */
function normalizeResponse(parsed) {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    if ("long_term" in parsed || "daily" in parsed) {
      return {
        long_term: Array.isArray(parsed.long_term) ? parsed.long_term : [],
        daily: Array.isArray(parsed.daily) ? parsed.daily : [],
      };
    }
    if ("classification" in parsed) {
      return { long_term: [parsed], daily: [] };
    }
  }
  if (Array.isArray(parsed)) return { long_term: parsed, daily: [] };
  return { long_term: [], daily: [] };
}

async function classifySessionEnd({ event, config, generate }) {
  const { project, payload: conversation } = event;
  const insightsRoot = config.insights_root;

  const existingTopics = [
    ...extractHeadings(join(insightsRoot, project || "", "insights.md")),
    ...extractHeadings(join(insightsRoot, "claude-config", "behavior.md")),
    ...extractHeadings(join(insightsRoot, "_tasks", "pending.md")),
  ];
  const dedupBlock = existingTopics.length > 0
    ? `\n[Existing topics — do NOT duplicate these]:\n${existingTopics.map((t) => `- ${t}`).join("\n")}\n\n`
    : "\n";

  const { text } = await generate(
    CLASSIFY_PROMPT + `[Project: ${project}]` + dedupBlock + conversation
  );

  return normalizeResponse(parseJsonLoose(text));
}

async function classifyUserPrompt({ event, generate }) {
  const { project, payload: promptText } = event;
  if (!promptText || promptText.trim().length === 0) return { long_term: [], daily: [] };

  const { text } = await generate(
    PROMPT_CLASSIFY_PROMPT + `[Project: ${project}]\n` + promptText
  );

  return normalizeResponse(parseJsonLoose(text));
}

function writeLongTerm({ event, config, results, log }) {
  const project = event.project || "unknown";
  let saved = 0;

  for (const result of results) {
    const { classification, repo, topic } = result;
    if (!classification || classification === "none") continue;

    let { body } = result;
    const targetRepo = repo || project;

    if (!body) {
      const { facts, summary } = result;
      const factLines = Array.isArray(facts) && facts.length > 0 ? facts.map((f) => `- ${f}`).join("\n") : "";
      body = [summary, factLines].filter(Boolean).join("\n");
    }
    if (!topic || !body) {
      log(`SKIP event=${event.id} class=${classification} (missing topic/body)`);
      continue;
    }

    if (classification !== "task") {
      const qmd = qmdDedup(topic, body, targetRepo);
      if (qmd.action === "skip") {
        log(`QMD-DEDUP event=${event.id} "${topic}" repo=${targetRepo} reason=${qmd.reason}`);
        continue;
      }
      if (qmd.links.length > 0) body += `\n\n**See also**: ${qmd.links.join(", ")}`;
    }

    const savedTo = saveInsight(config, targetRepo, classification, topic, body);
    log(`LONG-TERM event=${event.id} class=${classification} repo=${targetRepo} topic="${topic}" file=${savedTo || "dedup"}`);
    if (savedTo) saved++;
  }
  return saved;
}

function writeDaily({ event, config, daily, log }) {
  if (!Array.isArray(daily) || daily.length === 0) return 0;
  let written = 0;
  for (const item of daily) {
    if (!item || typeof item.fact !== "string" || !item.fact.trim()) continue;
    const themes = Array.isArray(item.themes) && item.themes.length > 0 ? item.themes : ["Misc"];
    const path = appendDailyFact(config.insights_root, themes, item.fact);
    if (path) {
      log(`DAILY event=${event.id} themes=[${themes.join(",")}] fact="${item.fact.slice(0, 60)}${item.fact.length > 60 ? "…" : ""}"`);
      written++;
    }
  }
  return written;
}

export async function processEvent({ event, config, generate, log }) {
  const { id, event_type, session_id, project } = event;
  log(`PROCESS event=${id} type=${event_type} session=${session_id} project=${project}`);

  let response;
  if (event_type === "session_end") {
    response = await classifySessionEnd({ event, config, generate });
  } else if (event_type === "user_prompt") {
    response = await classifyUserPrompt({ event, generate });
  } else {
    log(`DROP event=${id} unknown type=${event_type}`);
    return;
  }

  const longCount = writeLongTerm({ event, config, results: response.long_term || [], log });
  const dailyCount = writeDaily({ event, config, daily: response.daily || [], log });

  log(`DONE event=${id} long_term=${longCount} daily=${dailyCount}`);
}

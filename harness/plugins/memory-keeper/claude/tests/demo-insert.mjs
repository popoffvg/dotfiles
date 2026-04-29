#!/usr/bin/env node
// Inserts a test session into SQLite to simulate the Stop hook.
import { getDb } from "../lib/db.mjs";

const db = getDb();

const conversation = [
  "User: improve prompt for worker. It should not only classify but also extract facts and decisions.",
  "",
  "Assistant: Updated CLASSIFY_PROMPT to ask for a facts array of concrete statements instead of a summary. Changed output format to { classification, topic, facts: ['fact1', 'fact2'] }. Updated saveInsight to render facts as bullet points. All three entry types updated: insight, task, agent_edit.",
  "",
  "User: facts should be about code changes and patterns, not general insights",
  "",
  "Assistant: Updated the prompt examples to focus on concrete code changes: 'added retry_count column to sessions table', 'used dependency injection for generateText', 'file-based lock with 5min stale timeout'. Replaced vague insight examples with actionable technical facts.",
  "",
  "User: facts is required, not 1-5",
  "",
  "Assistant: Changed prompt to state facts field is REQUIRED with at least one entry for non-none classifications. Removed the 1-5 upper limit.",
].join("\n");

db.prepare(
  `INSERT OR IGNORE INTO sessions (session_id, cwd, project, conversation, status)
   VALUES (?, ?, ?, ?, 'pending')`
).run(
  "demo-facts-" + Date.now(),
  "/Users/popoffvg/.claude/plugins/memory-keeper",
  "memory-keeper",
  conversation
);

const row = db.prepare("SELECT id, session_id, status FROM sessions ORDER BY id DESC LIMIT 1").get();
console.log("Inserted:", row);

db.close();

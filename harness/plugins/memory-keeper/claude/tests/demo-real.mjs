#!/usr/bin/env node
// Inserts a real session from ~/.claude/projects/ into SQLite for demo.
import { readFileSync } from "fs";
import { getDb } from "../lib/db.mjs";

const MAX_CHARS = 8000;

// Pick the most recent pl session
const jsonlPath = process.argv[2] || "/Users/popoffvg/.claude/projects/-Users-popoffvg-Documents-git-mil-tasks-MILAB-5836-k8s-golang-tests/92eda2ab-6322-4286-b471-14c3a0405ebc.jsonl";

const lines = readFileSync(jsonlPath, "utf8").split("\n").filter(Boolean);
const messages = [];

for (const line of lines) {
  try {
    const r = JSON.parse(line);
    if (r.type === "user" || r.type === "human") {
      const t = typeof r.message?.content === "string" ? r.message.content : "";
      if (t && !t.startsWith("<command") && !t.startsWith("<system") && !t.startsWith("<local")) {
        messages.push(`User: ${t}`);
      }
    } else if (r.type === "assistant") {
      const blocks = r.message?.content || [];
      const texts = Array.isArray(blocks)
        ? blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n")
        : typeof blocks === "string" ? blocks : "";
      if (texts) messages.push(`Assistant: ${texts}`);
    }
  } catch {}
}

// Take last N messages within budget
let total = 0;
const selected = [];
for (let i = messages.length - 1; i >= 0; i--) {
  if (total + messages[i].length > MAX_CHARS) break;
  selected.unshift(messages[i]);
  total += messages[i].length;
}

const conversation = selected.join("\n\n");
console.log(`Extracted ${selected.length} messages (${conversation.length} chars)`);
console.log("---");
console.log(conversation.slice(0, 500) + "\n...");

const db = getDb();
db.prepare(
  `INSERT OR IGNORE INTO sessions (session_id, cwd, project, conversation, status)
   VALUES (?, ?, ?, ?, 'pending')`
).run(
  "demo-real-" + Date.now(),
  "/Users/popoffvg/Documents/git/mil/pl",
  "pl",
  conversation
);

const row = db.prepare("SELECT id, session_id, status FROM sessions ORDER BY id DESC LIMIT 1").get();
console.log("\nInserted:", row);
db.close();

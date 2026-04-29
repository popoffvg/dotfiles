#!/usr/bin/env node
// Demo: insert a conversation that should classify as agent_edit
import { getDb } from "../lib/db.mjs";

const db = getDb();

const conversation = [
  "User: I want to improve work-manager plugin. Forbid agents from loading if dir is not about tasks.",
  "",
  "Assistant: Added directory guards to all 4 work-manager agent descriptions requiring cwd: ~/Documents/git/* for task/work operations. Agents now refuse to spawn outside project contexts.",
  "",
  "User: also add mandatory notes block to all actionable skills",
  "",
  'Assistant: Added "MANDATORY: Update Notes" block to 8 actionable skills (work-start, work-implement, work-plan, work-update, work-done, work-pr, work-research). Each skill now enforces documenting discoveries during execution.',
  "",
  "User: skills should describe pure workflow steps, don't mention subagents or delegation",
  "",
  "Assistant: Updated all skill descriptions to focus on the what (steps, templates, writing rules) and moved how (delegation, tool restrictions, subagent spawning) to agent frontmatter. Skills own user contract, agents own implementation.",
].join("\n");

db.prepare(
  `INSERT OR IGNORE INTO sessions (session_id, cwd, project, conversation, status)
   VALUES (?, ?, ?, ?, 'pending')`
).run("demo-edit-" + Date.now(), "/Users/popoffvg/.claude/plugins/work-manager", "work-manager", conversation);

const row = db.prepare("SELECT id, session_id, status FROM sessions ORDER BY id DESC LIMIT 1").get();
console.log("Inserted:", row);
db.close();

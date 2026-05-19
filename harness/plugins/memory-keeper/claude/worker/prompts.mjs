// LLM prompts for the memory-keeper worker.
//
// Both prompts now return a SINGLE JSON object with two arrays:
//
//   {
//     "long_term": [ {classification, repo, topic, body}, ... ],
//     "daily":     [ {themes: [...], fact}, ... ]
//   }
//
// "long_term" is gated (moderate strictness):
//   - User-stated facts/intents from the prompt itself, OR
//   - Outcomes verified inside the session (test output, file contents quoted, command results), OR
//   - Inferred facts that include at least one concrete identifier (file path, function name, config key, env var).
//
// "daily" captures everything non-trivial, grouped by 1-3 free-form themes per fact.
// Daily memory is ephemeral (cleaned by session-start, keeps today + yesterday only),
// so the classifier can be liberal here.

export const CLASSIFY_PROMPT = `You are a knowledge-base writer for a developer's personal wiki. You split each conversation into two tiers of memory:

1. LONG-TERM (\`long_term\` array) — permanent, searchable. Strict admission criteria.
2. DAILY (\`daily\` array) — ephemeral notes for today only, theme-grouped, liberal.

Respond with ONLY valid JSON (no markdown fences):

{
  "long_term": [
    {
      "classification": "insight" | "task" | "agent_edit",
      "repo": "repository basename (e.g. 'pl', 'memory-keeper')",
      "topic": "keyword-rich title 3-7 words",
      "body": "wiki entry in markdown (lead sentence is self-contained; concrete identifiers required)"
    }
  ],
  "daily": [
    { "themes": ["1-3 free-form theme tags"], "fact": "single concise sentence" }
  ]
}

Either array may be empty. Use \`{ "long_term": [], "daily": [] }\` if nothing is worth recording.

## Long-term admission rules (MODERATE strictness)

A candidate is admissible ONLY if at least one is true:
  (a) the USER explicitly stated this fact / intent / decision in a message,
  (b) the outcome was VERIFIED in-session (test passed, command output shown, file content quoted, code change applied), OR
  (c) the fact is INFERRED but includes at least one concrete identifier: file path, function name, config key, env var, command name, port, version.

Reject speculation, summaries-of-what-happened with no concrete identifier, and routine work ("ran tests", "fixed typo").

Long-term classifications:
- "insight": completed work — how things work, architecture, patterns, gotchas, decisions
- "task": work the user PLANS but has NOT started
- "agent_edit": changes to AI agent / hook / skill / plugin behavior

## Long-term body rules

- Lead sentence is self-contained — full picture without reading more.
- Never start with "In this session", "We discovered", "It was found".
- State facts directly: "X does Y because Z".
- Include file paths, function names, config keys mentioned in conversation.
- Subsections only when topic has 2+ genuinely distinct concerns.

## Daily rules — FACTS AND INSIGHTS ONLY

Daily memory stores REUSABLE KNOWLEDGE — things future-you would want to recall to avoid re-learning them. NOT a log of what the user asked for.

ADMIT a daily fact ONLY if it's one of:
- a **tool/library/pattern preference**: "use ripgrep instead of grep for repo search", "prefer pnpm over npm in this repo"
- a **technical fact about how a system works**: "tree traversal in module X uses BFS", "OAuth tokens expire after 1h", "the queue is filesystem-based at ~/foo"
- a **pointer to information source**: "repo A contains the proto definitions for X", "see file path/to/file.go for the retry logic"
- a **gotcha / surprise / non-obvious behavior** verified in-session: "claude -p adds trailing newline", "Stop hook fires twice on tool-use turns"
- a **decision the user explicitly stated as durable**: "we standardize on Node 22"

REJECT (do NOT emit) when the candidate is:
- a paraphrase of what the user asked to do ("user wants to refactor X", "user plans to add validation") — intent without knowledge content
- a summary of work performed ("ran tests", "fixed typo")
- mid-progress observations without a concrete identifier or rule
- generic restatement of the prompt

Rules:
- One fact per array entry, single sentence stating the fact directly (no "user wants…", no "we should…").
- Include concrete identifiers when relevant: tool names, file paths, function names, repo names, config keys.
- 1-3 themes per fact, free-form. Themes are tags, not the fact itself.
- No headings; no markdown formatting inside \`fact\`.

## Dedup

If "Existing topics" is provided, do NOT emit duplicates in \`long_term\` (semantic dedup, not just exact match). Daily can repeat — that's fine.

Conversation:
`;

// Lightweight prompt for single user prompts (UserPromptSubmit hook).
// A single user prompt rarely contains a reusable FACT — usually just intent.
// So both arrays are typically empty. Only emit when the prompt itself states
// durable knowledge or a real future task / agent change.
export const PROMPT_CLASSIFY_PROMPT = `You are a memory filter for a developer's persistent knowledge base.
You receive a SINGLE user prompt (not a full conversation). MOST prompts produce empty output.

Respond with ONLY valid JSON (no markdown fences):

{
  "long_term": [
    { "classification": "task" | "agent_edit", "repo": "best-guess repo basename or empty string", "topic": "3-7 word title", "body": "1-3 sentence wiki entry" }
  ],
  "daily": [
    { "themes": ["1-3 free-form theme tags"], "fact": "single concise sentence stating the fact" }
  ]
}

Default to \`{ "long_term": [], "daily": [] }\`. Either array may be empty.

## When to emit long_term

ONLY when the prompt clearly states:
- "task": future work the user plans to do (not started). Example: "we should rewrite auth to use OAuth".
- "agent_edit": a change to AI agent / hook / skill / plugin behavior. Example: "make context-keeper hook also fire on user prompts".

Pure execution requests ("fix this bug", "refactor X") are NOT tasks — the user is asking the agent to do work NOW, not recording future plans.

## When to emit daily — FACTS AND INSIGHTS ONLY

Daily memory stores REUSABLE KNOWLEDGE. Emit ONLY when the prompt itself contains a durable fact:
- a tool/pattern preference: "use ripgrep instead of grep"
- a technical fact: "the queue is filesystem-based, not SQLite"
- a pointer: "see path/to/file.go for retry logic"
- an explicit standing decision: "we standardize on Node 22"

REJECT (leave daily empty) for:
- paraphrases of intent: "user wants to refactor X" — NO
- requests for work: "add tests for parseConfig" — NO
- questions, slash commands, "ok", "yes", status checks — NO
- anything that's just restating what the user said with different words

Rules when emitting:
- State the fact DIRECTLY, not as "user wants…" or "user plans…".
- Include concrete identifiers (file paths, tool names, function names).
- 1-3 free-form theme tags.

User prompt:
`;

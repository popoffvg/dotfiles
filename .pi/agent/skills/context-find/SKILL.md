---
name: context-find
description: Search and retrieve insights from persistent memory. Use this when the user explicitly asks to recall/search memory ("context find", "recall", "what do I know about", "find my notes on", "search memory", "do I have anything on") and for summary-style recall requests ("get summary", "summary", "summarize my notes", "what's the summary"). Do not trigger for live operational requests (for example "check health/status of jobs/services").
---

# Context Find

## Core rule

**Execute all search steps autonomously after intent is confirmed as memory recall. Never ask the user for confirmation between search steps.** Run keyword search, semantic search, and fallback search without prompting. Only ask once — at the end — if nothing was found and you need the user to specify where else to look.

## Intent gate (run before search)

Classify the request first:
1. **Memory intent (run this skill):** explicit recall phrasing like "context find", "recall", "find my notes", "what do I know about", and summary-style recall phrasing like "get summary", "summary", "summarize my notes".
2. **Live/operational intent (do not run this skill):** status/health/action phrasing like "check health of jobs", "are jobs running", "fix", "restart", "deploy", "debug", "why failed", "retry", "recheck ssh", "commit and push", "do it" after an operational thread, or "check how <url> was processed".
   - Treat implementation steering such as "use fallback to <provider>", "switch model/provider", "apply this fix", and "check the docs for that" as **execution/research follow-up**, not memory recall.
3. **Ambiguous intent:** ask one short clarification question: "Do you want me to search saved notes, or check the live system?"
4. **URL handling:** a raw URL or "check <url>" is operational/research intent by default, not memory recall, unless the user explicitly asks for "my notes"/"context"/"memory" about it.

Typo tolerance: interpret obvious typos (e.g. "helth" → "health") before intent classification.

Short-command handling: if the message is a terse command like "get summary" with no object, default to memory-summary behavior (run List Procedure first, then ask one narrowing question only if needed).

Thread-continuity rule: if the previous assistant/user turns are in an active operational workflow (debugging, SSH checks, runtime failure triage, repo fixes), interpret short replies like "yes", "do it", "retry", "1" as continuation of that workflow, **not** as a new memory-search request.

## Usage

`/context find <query>`

Examples:
- `/context find kubernetes debugging patterns`
- `/context find what do I know about the auth service`
- `/context find` (shows all projects overview)

## Search Procedure

1. Read `insights_root` from `~/.claude/memory-keeper.local.md` YAML frontmatter. If the file is missing, stop and ask the user to create it with the required settings (see plugin README).
2. If no query → read and display `<insights_root>/INDEX.md`
3. Use `qmd_search` with `collection: "ctx"` for keyword matching
4. If few results → use `qmd_query` with `collection: "ctx"` for semantic search (do this automatically, no confirmation needed)
5. If still insufficient → search `qmd_search` with `collection: "z-core"` (Obsidian vault) as fallback (do this automatically, no confirmation needed)
6. Use `qmd_get` or Read tool to retrieve full file content
7. If nothing found → ask the user once where to search (e.g. specific repo, web, docs URL) and use the appropriate tool
8. Present results with project/topic context and source file paths

## Follow-up intent handling (critical)

After presenting memory results, treat short follow-up messages as intent updates for the same task (for example: "yes, that's it, relaunch and add X dependency for Y").

Rules:
1. **Do not re-run context-find automatically** on confirmation-like follow-ups unless the user explicitly asks to search/recall again.
2. If follow-up asks for an action (edit, relaunch, configure, add dependency, timeout tuning, SSH recheck, retry, switch provider/model, use fallback), restate the action in one sentence and hand off to normal implementation flow.
3. If follow-up includes "check docs" / "look up docs" / "confirm in docs", route to documentation lookup (Context7 or project docs as appropriate) and then continue execution; do not re-run memory search.
4. If target/service name is ambiguous (e.g., typo like `orb` vs `orbs`), ask one focused clarification question; otherwise execute directly.
5. Keep memory context as evidence only; do not block execution behind another memory-search round.
6. If a follow-up references failure diagnosis ("why failed", "what failed", "check processing"), treat it as live troubleshooting unless memory is explicitly requested.


## List Procedure

1. Read `<insights_root>/INDEX.md` for project overview
2. If user asked a generic summary (e.g. "get summary") with no project/topic, return a concise cross-project summary from `INDEX.md` first
3. For specific project → read `<insights_root>/<project>/_summary.md`
4. Present organized summary

## Tool name mapping

| Use this | Not this |
|---|---|
| qmd_search | mcp__qmd__search |
| qmd_query | mcp__qmd__deep_search / mcp__qmd__vector_search |
| qmd_get | mcp__qmd__get |

## Autoresearch rules

**Eval checklist:**
1. Did the search return results from persistent memory (not fabricated from training data)?
2. Were both keyword search and semantic search attempted when keyword results were sparse?
3. Did the agent present findings with source file paths (not just content)?
4. Was the insights_root config read before searching?
5. Did the agent complete the search without asking any yes/no confirmation questions mid-procedure?
6. On a confirmation-like follow-up with an action request, did the agent avoid re-invoking context-find and switch to execution/clarification?
7. Did the agent avoid invoking context-find for live operational status/health requests?
8. On follow-ups like "use fallback to openrouter auto" and "check the docs for that", did the agent switch to execution + docs lookup instead of re-running memory search?

**Test inputs:**
- "Recall what I know about Kubernetes debugging patterns"
- "Find my notes on the auth service architecture"
- "context find" with no query (should show INDEX.md overview)

**Can change:** search strategy, result presentation format, fallback search order, query expansion
**Cannot change:** QMD tools as search backend, insights_root config requirement, memory-first principle
**Min sessions before eval:** 5
**Runs per experiment:** 3

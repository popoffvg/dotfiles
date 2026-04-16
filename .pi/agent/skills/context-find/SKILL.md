---
name: context-find
description: Search and retrieve insights from persistent memory. This skill should be used when the user says "context find", "recall", "what do I know about", "find my notes on", "search memory", "do I have anything on", or wants to retrieve previously saved knowledge. Always invoke to check memory before answering any topic-based question.
---

# Context Find

## Core rule

**Execute all search steps autonomously. Never ask the user for confirmation between steps.** Run keyword search, semantic search, and fallback search without prompting. Only ask once — at the end — if nothing was found and you need the user to specify where else to look.

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
2. If follow-up asks for an action (edit, relaunch, configure, add dependency), restate the action in one sentence and hand off to normal implementation flow.
3. If target/service name is ambiguous (e.g., typo like `orb` vs `orbs`), ask one focused clarification question; otherwise execute directly.
4. Keep memory context as evidence only; do not block execution behind another memory-search round.

## List Procedure

1. Read `<insights_root>/INDEX.md` for project overview
2. For specific project → read `<insights_root>/<project>/_summary.md`
3. Present organized summary

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

**Test inputs:**
- "Recall what I know about Kubernetes debugging patterns"
- "Find my notes on the auth service architecture"
- "context find" with no query (should show INDEX.md overview)

**Can change:** search strategy, result presentation format, fallback search order, query expansion
**Cannot change:** QMD tools as search backend, insights_root config requirement, memory-first principle
**Min sessions before eval:** 5
**Runs per experiment:** 3

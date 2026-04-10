---
name: context-find
description: Search and retrieve insights from persistent memory. This skill should be used when the user says "context find", "recall", "what do I know about", "find my notes on", "search memory", "do I have anything on", or wants to retrieve previously saved knowledge. Always invoke to check memory before answering any topic-based question.
---

# Context Find

## Usage

`/context find <query>`

Examples:
- `/context find kubernetes debugging patterns`
- `/context find what do I know about the auth service`
- `/context find` (shows all projects overview)

## Search Procedure

1. Read `insights_root` from `~/.claude/memory-keeper.local.md` YAML frontmatter. If the file is missing, stop and ask the user to create it with the required settings (see plugin README).
2. If no query → read and display `<insights_root>/INDEX.md`
3. Use `mcp__qmd__search` with `collection: "ctx"` for keyword matching
4. If few results → use `mcp__qmd__deep_search` with `collection: "ctx"` for semantic search
5. If still insufficient → search `mcp__qmd__search` with `collection: "z-core"` (Obsidian vault) as fallback
6. Use `mcp__qmd__get` or Read tool to retrieve full file content
7. If nothing found → ask the user where to search (e.g. specific repo, web, docs URL) and use the appropriate tool
8. Present results with project/topic context

## List Procedure

1. Read `<insights_root>/INDEX.md` for project overview
2. For specific project → read `<insights_root>/<project>/_summary.md`
3. Present organized summary

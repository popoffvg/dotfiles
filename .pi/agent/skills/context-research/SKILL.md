---
name: context-research
description: This skill should be used when the user says "research", "look into", "look up", "find out about", "search for", or asks about a topic needing investigation. Checks persistent memory first, performs web research if insufficient, persists results.
---

# Context Research

## Procedure

### Step 1: Check memory first

1. Use `mcp__qmd__search` with `collection: "ctx"` for the topic
2. Use `mcp__qmd__deep_search` with `collection: "ctx"` if few results
3. Use `mcp__qmd__search` with `collection: "z-core"` (Obsidian vault) as secondary fallback
4. Present what's already known

### Step 2: New research (if memory insufficient)

1. Use `mcp__firecrawl__firecrawl_search` to find current information
2. Use `mcp__firecrawl__firecrawl_scrape` to read relevant pages
3. Synthesize findings into a clear summary

### Configuration

Read `insights_root` from `~/.claude/memory-keeper.local.md` YAML frontmatter. If the file is missing, stop and ask the user to create it with the required settings (see plugin README).

### Step 3: Save results to memory

1. Always persist research results using the `context-save` skill procedure with **`type: common`** — research output is global/cross-project knowledge
2. Include sources (URLs, dates) in the Sources section
3. Update `_summary.md` and `<insights_root>/INDEX.md`

## Output

Return both the answer AND confirmation of what was persisted to memory.

## Autoresearch rules

**Eval checklist:**
1. Was persistent memory checked BEFORE performing web research?
2. Did web research only trigger when memory was insufficient (not by default)?
3. Were research results persisted to memory for future recall?
4. Did the agent present what was already known before adding new findings?

**Test inputs:**
- "Research Go context cancellation patterns" (likely in memory)
- "Research a brand new library released last week" (memory empty, needs web)
- "Look into why our CI is slow" (mixed: some memory, some new research)

**Can change:** memory check depth, web search strategy, persistence format, presentation order
**Cannot change:** memory-first principle, QMD for memory, firecrawl for web, persist-results requirement
**Min sessions before eval:** 5
**Runs per experiment:** 3

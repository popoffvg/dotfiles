---
name: improve-claude-local
description: >
  Improve a whole CLAUDE.local.md — the private, per-project rules captured from
  user corrections. Wraps each conditional rule in a <task-relevant> block so it
  only surfaces for matching work, merges duplicates, generalizes one-off facts,
  drops stale entries, and routes raw project facts to engram. Use when the user
  says "improve claude.local", "clean up the local rules", "claude.local is
  bloated", or after the Stop hook has appended many rules.
---

Rewrite CLAUDE.local.md so its rules stay sharp instead of diluting each other. CLAUDE.local.md holds private per-project guidance — mostly behavioral rules the Stop hook captured from user corrections (`## Self-improvement`), plus any local facts the user pinned.

## Core problem

Claude Code injects every CLAUDE.local.md with: *"this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant."*

The Stop hook appends a new rule each time the user corrects behavior. The file grows. Most rules match no current task, so the model treats the whole file as noise — including the rule that matters right now.

## Solution: `<task-relevant>` blocks

Wrap each conditional rule in a `<task-relevant when="...">` XML block. Same tag pattern Claude Code's own system prompt uses — an explicit relevance signal that cuts through the "may or may not be relevant" framing. The model sees every rule but attends only to the one whose `when` matches the task.

## Principles

### 1. Foundational context bare, conditional rules wrapped

Leave bare anything relevant to nearly every task in this repo — project identity, a one-line map, where things live. Wrap anything that only matters for a kind of work. Rule of thumb: relevant to 90%+ of tasks → bare; relevant to a specific task → `<task-relevant>`. Most of CLAUDE.local.md is the wrapped kind.

### 2. One rule, one block, one condition

Each rule gets its own block with a narrow `when`. Never group unrelated rules under one broad condition — broad conditions match everything, so they dilute nothing and the file reverts to noise.

```
<task-relevant when="diagnosing a missing agent or plugin">
Check what's *enabled* (settings.json enabledPlugins + installed_plugins.json installPath), not what exists on disk. The active cache dir name need not match the source dir.
</task-relevant>

<task-relevant when="an explore/research flow could add a user-confirmation gate">
Don't gate on confirmation when a downstream loop already backstops wrong choices. Surface the choice in a log line; don't block.
</task-relevant>
```

### 3. Generalizable rule, not a fact

Each rule states **what to do differently next time** — a behavioral correction. Strip project-specific names, paths, and IDs into the `when` condition or out entirely; raw facts belong in engram (`mem_save`), not here. If an entry can't be phrased as "next time, do X instead of Y" and isn't foundational context, it's a fact — route it to engram and drop it.

### 4. Merge overlapping rules

Before keeping two rules, check if one refines the other. Two rules about the same trigger → merge into one block with the sharper condition. No two blocks the model would weigh for the same task.

### 5. Drop stale rules

A rule pinned to a file, flag, or workflow that no longer exists is dead weight. Verify the referenced thing still exists; if not, delete the rule.

### 6. Keep the `when` in the user's terms

Write the condition for how a *task* looks, not how the codebase looks: "when committing across multiple repos", not "when in a monorepo". The model matches `when` against the work it's about to do.

## How to apply

1. Read the whole CLAUDE.local.md.
2. Separate foundational context (project identity, map) from conditional rules. Leave foundational context bare at the top.
3. For each conditional entry: is it a behavioral correction? If it's a raw project fact, route it to engram and drop it here.
4. Generalize each surviving rule — strip IDs/paths, phrase as "do X instead of Y."
5. Merge entries that share a trigger.
6. Verify referenced files/flags/workflows still exist; delete rules whose anchors are gone.
7. Wrap each final rule in `<task-relevant when="...">` with a task-shaped condition.
8. Write back. Keep the `## Self-improvement` header bare — it's the section anchor the Stop hook appends to.

## Scope

Touch only CLAUDE.local.md. Leave CLAUDE.md (the checked-in project instructions) alone — this skill improves private captured corrections, not shared onboarding context.

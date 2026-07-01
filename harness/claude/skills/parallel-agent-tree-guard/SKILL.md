---
name: parallel-agent-tree-guard
description: Guard against parallel subagents straying outside their assigned files when they share one working tree. Use when fanning out multiple agents that create or edit files concurrently in the same repo/tree, before committing their combined output.
---

# Parallel-agent tree guard

A subagent told to touch only its named files (or to read-only a file) can still modify or delete files outside that scope — the instruction is not enforced. Protect the tree.

## Before committing fan-out output

- Enumerate the expected output set up front (which files each agent creates/edits).
- After all agents finish, list the actual changed set (`git status`, `ls` the target dir) and diff it against expected.
- Reconcile every mismatch: an unexpected deletion or edit of a file no agent was assigned is a stray write — restore it (`git checkout <ref> -- <path>`) before committing.
- Pay attention to files an agent was told only to *read* — those are the easiest to lose, and their absence is silent.

## Prevent it

- Give each agent a disjoint write set; never two agents on one file.
- When agents mutate a shared tree and a stray write would corrupt correctness, run each in its own worktree (isolation) instead of the shared tree.
- Keep destructive/index operations (git, bulk renames, CHANGELOG appends) in the orchestrator, not in the parallel agents — they race and stray.

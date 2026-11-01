---
name: minions
description: Delegate bounded read-and-report tasks or independent work units to subagents while keeping the main context for conclusions. Use before launching any subagent that picks a model, or when a task splits into independent reading or writing units.
---

# Minions — Cursor

Invoke as `/minions <task>`. Read [ledger.md](ledger.md) in full on each invocation
before selecting subagents or models. Cursor does not run Claude's `!`-shell
injection, so read the ledger explicitly.

Apply that ledger, then follow the shared workflow at
`~/Documents/git/dotfiles/harness/claude/skills/minions/references/workflow.md`
(read it in full; it is harness-neutral).

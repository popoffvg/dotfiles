---
name: minions
description: Delegate bounded read-and-report tasks or independent work units while keeping the main context for conclusions.
---

# Minions — Codex

Invoke as `$minions <task>`. Read [ledger.md](ledger.md) in full on each invocation
before selecting models. To inject its current contents into tool context, run
`cat <this-skill-directory>/ledger.md`, resolving this directory from this installed
SKILL's canonical path. Codex reads this ledger explicitly; Claude's shell-injection
syntax belongs to the Claude entry point.

Apply that ledger, then follow [the shared workflow](../../claude/skills/minions/references/workflow.md).

---
name: minions
description: Delegate bounded read-and-report tasks or independent work units while keeping the main context for conclusions. Load it before any Agent call that picks a model or a fork — a fork always runs on the parent model and cannot start agents, so a loop that starts sonnet or haiku agents stays in this session.
argument-hint: [the task to farm out]
---

# Minions — Claude

Invoke as `/minions <task>`. Apply the injected Claude routing ledger, then follow
[the shared workflow](references/workflow.md).

!`cat "$HOME/.claude/skills/minions/ledger.md"`

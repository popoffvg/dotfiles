---
name: minions
description: Delegate bounded tasks using the current harness delegation workflow.
disable-model-invocation: true
---

Read `{{SKILL_ROOT}}/minions/ledger.md` explicitly before selecting agents or models;
reading the skill file does not execute its Claude shell-injection syntax.
Read `{{SKILL_ROOT}}/minions/SKILL.md` and follow its workflow for the request below.
Resolve resources relative to that internal skill directory. Load other named
skills through the harness skill index. Translate tool names to the current
harness while preserving the workflow's permissions and completion conditions.
Use the request below for any argument placeholder in the internal skill.

Request: {{ARGUMENTS}}

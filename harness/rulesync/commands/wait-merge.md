---
name: wait-merge
description: Drive one PR to merge: triage the merge blockers, then fix red CI until it merges.
disable-model-invocation: true
---

Read `{{SKILL_ROOT}}/wait-merge/SKILL.md` and follow its workflow for the request below.
Resolve resources relative to that internal skill directory. Load other named
skills through the harness skill index. Translate tool names to the current
harness while preserving the workflow's permissions and completion conditions.
Use the request below for any argument placeholder in the internal skill.

Request: {{ARGUMENTS}}

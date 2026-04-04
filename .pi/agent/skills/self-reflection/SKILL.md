---
name: self-reflection
description: >
  Capture short, actionable reflections when instructions, workflows, or tools
  caused friction. Use to improve future agent runs.
---

# self-reflection

When instructions are unclear, outdated, or lead to repeated mistakes, write a brief reflection.

## When to reflect

Write a reflection only if the issue is likely to happen again:

- Instructions were ambiguous or misleading
- A better approach worked than the documented one
- A tool/workflow failed compared to documented behavior
- You had to deviate from instructions to complete the task

## How to reflect

Append an entry to `agent/shared/agent-reflections.md` using `edit` (preferred) or `write`.

Template:

```markdown
### YYYY-MM-DD - <Agent/Skill> - <Topic>
**Issue:** <what was unclear or wrong>
**Resolution:** <what actually worked>
**Suggestion:** <how to improve instructions/workflow>
```

## Rules

- Keep each reflection to 3-5 lines
- Focus on actionable improvements
- Do not log one-off incidents unlikely to repeat
- Do not include secrets, API keys, or personal data
- Skip reflection if there is no clear improvement to propose

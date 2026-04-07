---
name: self-reflection
description: >
  Capture short, actionable reflections when instructions, workflows, or tools
  caused friction. Use to improve future agent runs.
---

# self-reflection

When something didn't go smoothly — unclear instructions, unexpected behavior, wasted effort, a better path discovered — write a reflection.

## When to reflect

Reflect when the experience is likely to recur or has broader implications:

- Instructions were ambiguous, misleading, or missing context
- A workaround or alternative approach worked better than the documented one
- A tool or workflow behaved differently than expected
- You had to deviate from instructions to complete the task
- A pattern emerged that could benefit other tasks or skills
- Time was spent on something that could have been avoided with better preparation
- An assumption turned out to be wrong

Think beyond the immediate problem. Ask: what systemic issue does this reveal? What would a different agent or future session benefit from knowing?

## Storage — daily files with rotation

Reflections are stored **one file per day**:

```
agent/shared/reflections/YYYY-MM-DD.md
```

- Use today's date for the filename (e.g., `2026-04-07.md`).
- If the file already exists, **append** to it; if not, create it.
- Old files beyond 10 days are pruned automatically on pi startup (session_start / session_shutdown hooks). Do not delete files manually.

## How to reflect

Append an entry to `agent/shared/reflections/YYYY-MM-DD.md` (today's date) using `edit` (preferred) or `write`.

Template (adapt freely — structure matters less than insight):

```markdown
### HH:MM - <Agent/Skill/Workflow> - <Topic>
**What happened:** <the situation and what went wrong or was surprising>
**Root cause:** <why it happened — dig deeper than the surface symptom>
**What would help:** <concrete improvement — to instructions, tools, skills, or workflow>
```

## Rules

- Keep each reflection concise but don't sacrifice insight for brevity
- Focus on patterns and root causes, not surface symptoms
- Consider whether the issue affects other skills, workflows, or projects
- Do not include secrets, API keys, or personal data
- Skip reflection only if the incident is truly one-off with no transferable lesson

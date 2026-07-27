---
name: skill-build
description: Router for authoring a Claude Code skill. Use when the user wants to "build a skill", "write a skill", "create a skill", "author a SKILL.md", or build a specific shape — a "workflow" (step-by-step guide), a "loop" (repeat a flow), an "instruction" (rules / reference), or a "router" (dispatch table over branches). Names each shape and routes to its guide.
---

# skill-build — pick the skill's shape, then follow its guide

A skill is one `SKILL.md` with `name:` + `description:` frontmatter, plus optional `references/`. The frontmatter earns invocation; the body earns predictability — the agent running the **same process** every run.

Settle the two always-required frontmatter fields and the invocation choice before writing any shape:

- **name** — the skill's slug.
- **description** — triggers only. One trigger per distinct branch; front-load the leading word; drop identity already stated in the body.
- **invocation** — two independent frontmatter fields, both default on (you + Claude can invoke; description always in context). Set exactly one axis off when you want to restrict; leave both default otherwise:
  - `disable-model-invocation: true` — **user-only** `/` command; Claude never auto-fires it and its **description leaves context** (zero load). For side-effecting or timing-sensitive actions (`/deploy`, `/commit`) — you don't want the model deciding when.
  - `user-invocable: false` — **model-only**; hidden from the `/` menu, Claude auto-fires it on the `description` (which **stays in context**). For non-actionable background knowledge / captured-lesson skills the user shouldn't see as a command.

  Depth on description quality + the YAML-parse trap: `authoring-model-invocable-skills`. Source: https://code.claude.com/docs/en/skills (§ Control who invokes a skill).

Cross-cutting principles that apply to **every** shape — pruning / no-ops, leading words, failure modes — live in `references/foundations.md`. Read it once; the shapes below assume its vocabulary. Fuller treatment (information hierarchy, progressive disclosure, more on invocation) in **writing-great-skills** (https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-great-skills/SKILL.md).

## Skill shapes

Pick the shape by what the body mostly *is*: ordered actions, a repeated flow, or consulted rules. Load the one matching guide; ignore the others.

| Shape | Use when the skill is… | Guide |
|---|---|---|
| `workflow` | An ordered sequence of steps run once — a procedure, checklist, or guide. Each step ends on a checkable completion criterion. | `references/workflow.md` |
| `loop` | A control that repeats a flow — accumulate, page, retry-until-dry. Names the flow, does not restate it. | `references/loop.md` |
| `instruction` | A flat set of rules / definitions / facts consulted on demand — a review checklist, a style guide, a glossary. No ordered steps. | `references/instruction.md` |
| `router` | A thin dispatch table over branches — subcommands or shapes. Names each branch, matches the request, loads one branch's guide. This skill is one. | `references/router.md` |

---
name: skill-build
description: Router for authoring a Claude Code skill. TRIGGERS user asks rewrite, improve create or update a skill.
---

# skill-build — pick the skill's shape, then follow its guide

A skill is one `SKILL.md` with `name:` + `description:` frontmatter, plus optional `references/`. The frontmatter earns invocation; the body earns predictability — the agent taking the **same process** every run, rather than producing the same output.

Read `references/foundations.md` first, whatever the shape. It settles the frontmatter fields and the invocation choice every skill needs, and it holds the vocabulary the shape guides assume: the two loads, the information hierarchy, completion criteria, leading words, and pruning.

## Skill shapes

Pick the shape by what the body mostly *is*: ordered actions, a repeated flow, consulted rules, or a dispatch. Load the one matching guide; ignore the others.

| Shape | Use when the skill is… | Guide |
|---|---|---|
| `workflow` | An ordered sequence of steps run once — a procedure, checklist, or guide. Each step ends on a checkable completion criterion. | `references/workflow.md` |
| `loop` | A control that repeats a flow — accumulate, page, retry-until-dry. Names the flow, does not restate it. | `references/loop.md` |
| `instruction` | A flat set of rules / definitions / facts consulted on demand — a review checklist, a style guide, a glossary. No ordered steps. | `references/instruction.md` |
| `router` | A thin dispatch table over branches — subcommands or shapes. Names each branch, matches the request, loads one branch's guide. This skill is one. | `references/router.md` |

A skill that matches two rows holds two jobs: split it, and let each half take its own shape.

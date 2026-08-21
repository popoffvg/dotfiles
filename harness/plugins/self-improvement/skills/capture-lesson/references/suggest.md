# Suggest where a lesson belongs in the current harness

One session scored high enough to keep. This pass answers the next question and only that one: **given the harness as it exists today, what single change would carry this lesson?** It writes a suggestion for a human to accept or throw away. It never edits a skill, a doc, or a setting.

`suggest-session.sh` reads this file into the prompt verbatim, so this is the single home for the rules and the output shape.

## What you are given

| Reaches you | Never reaches you |
|---|---|
| the prompts the person typed, in order, separated by `---` | assistant turns, tool results, the session's `ai-title` |
| the score, scope and one-line reason the scoring pass produced | anything the assistant concluded about the session |
| an inventory of the harness: one row per existing skill and doc, with its trigger | the bodies of those skills — open at most two, with `Read`, and only ones you name as candidates |

The lesson is in the user's words. The score is a prior, not evidence: if the prompts do not carry a rule you can state in one sentence, say so and return `covered` or `none` rather than inventing one.

## Pick the smallest change that carries the lesson

In order. Stop at the first that fits:

| Verdict | Use when | Target |
|---|---|---|
| `covered` | an existing skill's trigger already fires on this situation and its body already says this | the skill that covers it |
| `extend` | an existing skill's trigger already fires, but its body is missing this rule | that skill's `SKILL.md` |
| `doc` | the rule is a standing convention with no trigger — it holds in every session, or in every session in one repo | `~/.claude/CLAUDE.md`, `CODE_STYLE.md`, or the repo's `CLAUDE.md` |
| `new-skill` | no existing trigger fires on this situation at all | a new `<slug>/SKILL.md` under the right scope |

`covered` is the most valuable verdict this pass can return, and the inventory is what makes it possible. This harness carries 90+ skills, a third of them autocreated (`[auto]` in the inventory) and most of them near-duplicates of each other. Another skill that restates one of those makes the corpus worse, not better — every session pays for it in context and nothing new fires. Prefer `covered` over `extend`, `extend` over `doc`, `doc` over `new-skill`, and only reach the last row when you have checked the inventory and can name what you searched for.

Scope follows the rule, not the repo you happened to be in: `global` when it holds away from these files, `project` when it is true of this repo's tooling, layout or order.

## Output contract

Write the markdown document below to stdout and nothing else — no preamble, no code fence around the whole document, no closing remark. Keep it under 40 lines: a suggestion a human will not read is a suggestion that does not land.

```
# <the lesson in one line, in the imperative>

- **Verdict:** covered | extend | doc | new-skill
- **Target:** <absolute path, or the proposed path for new-skill>
- **Scope:** global | project
- **Confidence:** high | medium | low

## The user's words

> <one or two verbatim lines from the prompts that carry the lesson>

## Why this target

<one to three sentences. Name the trigger that already fires, or state what you
searched the inventory for and did not find.>

## Proposed change

<For extend/doc: the exact text to add, and where in the body it goes. For
new-skill: the frontmatter `description` (the trigger) plus the rule. For
covered: the word `none`, and which line of the existing skill already says it.>

## Alternatives considered

- <the runner-up target, and why it lost>
```

Nothing is applied by this pass. The human runs `/capture-lesson` or `/dream` to act on it, and both re-judge the verdict rather than trusting it.

---
name: skill-build
description: Router for authoring a Claude Code skill. TRIGGERS user asks rewrite, improve create or update a skill.
---

# skill-build — pick the shape, then write under its guide

A skill is one `SKILL.md` (`name:` + `description:` frontmatter) plus optional `references/`. The frontmatter earns invocation; the body earns the agent taking the same process every run. A skill is **token-efficient**: the description is the line every turn pays for — one leading word, one trigger per branch, nothing the body already carries. In the body a sentence stays only when deleting it changes behaviour, a block the house uses in its public form becomes a golden word, and lookups the agent needs on some paths only go behind a `references/` pointer.

1. Read `references/foundations.md`. Done when `name`, `description`, and the invocation axes are decided.
2. Pick one row below by what the body mostly *is*, and load that guide only. A skill that matches two rows is two skills — split it. Done when exactly one row matches.
3. Write the body under the guide. For a new skill, start from golden words: name the public form each rule block copies, keep the house deltas as plain rules, and verify on a real input — `references/golden-words.md`. Done when every block that names a form has passed the two-arm check or kept its rules. When those words must make a model emit a document in a fixed shape, load `skill-blank` for the words and keep this guide for the file shape.
4. Normalize each rule: open it with the general artifact noun it governs (`code comment`, `commit message`, `test`) and an RFC 2119 keyword, then say what. Good: `A code comment MUST state a fact the signature cannot show.` Bad: `Give every public symbol one doc line.` — "doc line" hides the artifact, so a search for "comment" misses it. Then search `~/.claude/CLAUDE.md`, `~/.notes/rules/`, and the skills that load on the same work for that noun. Done when every rule opens with its artifact and keyword, and no MUST meets a MUST NOT on the same artifact, or the operator has chosen which rule stays.
5. Run one `prune-text` pass over the files touched and apply its cuts. Done when the description is at most one leading word plus one trigger per branch, and `SKILL.md` holds only what the agent needs on every path.

| Shape | Use when the body is… | Guide |
|---|---|---|
| `workflow` | Ordered steps run once, each ending on a checkable completion criterion. | `references/workflow.md` |
| `loop` | A control that repeats a named flow — accumulate, page, retry-until-dry. | `references/loop.md` |
| `instruction` | A flat set of rules or facts consulted on demand — a checklist, a style guide, a glossary. | `references/instruction.md` |
| `router` | A dispatch table over branches — subcommands or shapes. This skill is one. | `references/router.md` |

# Loose `~/.claude` skills

One directory per skill, each with a `SKILL.md` carrying `name:` + `description:` frontmatter and
optional `references/` docs. Stowed to `~/.claude/skills`.

## Rule: run `prune-text` after writing markdown here

Any change to a `SKILL.md` or a `references/` doc under this tree ends with the `prune-text` skill
(`harness-dev` plugin) over the files the change touched. It cuts what two files repeat, cuts the
dead weight inside each file, then reshapes the file into steps plus disclosed reference.

A new skill is not done until it passes `prune-text`. An edit to an existing skill runs it over that
skill, not over the whole tree.

# Plugins

Every plugin root lives here as self-contained markdown. Structure rules are in the repo root
`CLAUDE.md` § Plugins.

## Rule: run `prune-text` after writing markdown here

Any change to a `SKILL.md`, a command file, an agent file, or a `references/` doc under this tree
ends with the `prune-text` skill (`harness-dev` plugin) over the files the change touched. It cuts
what two files repeat, cuts the dead weight inside each file, then reshapes the file into steps plus
disclosed reference.

A new file is not done until it passes `prune-text`. An edit to an existing file runs it over that
file, not over the whole plugin.

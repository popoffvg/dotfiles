# Loose skills

One directory per skill, at `<group>/<name>/`. Each directory has a `SKILL.md` with `name:` and `description:` frontmatter, and optional `references/` docs. Claude, Codex, and Pi share these skills. Rulesync installs the copies. Claude settings, agents, commands, and hooks stay in `harness/claude/`.

## Group folders

| Group | What goes in it | Examples |
|---|---|---|
| `base` | Skills that the global rules require in every session, with their workers | `show-me`, `change-review` |
| `everyday` | Skills the operator uses in daily work: reports, handoffs, reviews, prompts, explanations | `daily`, `handoff`, `to-user`, `tour-v2` |
| `software-practice` | Rules and methods for design, code, specs, and proofs | `good-design-dry`, `golang`, `adr`, `with-proof` |
| `tool` | How to work with one CLI utility or MCP server: commands, setup, repair | `prdash`, `bg-cli`, `git-spice`, `todoist-cli`, `firecrawl` |
| `other` | Skill authoring, eval prompts, and the rest | `skill-builder`, `skill-blank`, `drunk-claude` |

The group is only a source folder. The installed tree is flat: `deploy.py` (`loose_skill_dirs`) copies each `<group>/<name>/` to `<name>/` before Rulesync imports it. So:

- A skill name MUST be unique across all groups. The deploy stops on a duplicate name.
- Every skill MUST be in a group. The deploy stops on a `SKILL.md` directly under `harness/skills/<name>/`.
- A link from one skill to another works only in the installed tree, unless both skills are in the same group. Keep skills that link to each other in one group, for example `show-me` and `change-review`, or the three `todoist-*` skills.
- A link that leaves `harness/skills/` (to `harness/plugins/` or `harness/claude/`) starts with `../../../`.
- A move to another group changes no installed path, `/name` command, or `publicAliases` entry. After a move, fix the relative links of the moved skill, then run the sync in [Make a skill public](#make-a-skill-public) step 4.

## Who can start a skill

Two independent switches decide it:

- **Human start**: the skill name is in `publicAliases` in [`harness/rulesync/config.json`](../rulesync/config.json). The deploy sets `user-invocable` from this list ([`invocation.mjs`](../rulesync/invocation.mjs)) and overwrites any value in the source. Do not write `user-invocable:` in a loose skill. The `user-invocable: false` lines that exist have no effect.
- **Model start**: the skill has no `disable-model-invocation: true` in its frontmatter. Then the model can load the skill when the request matches its `description`.

| Kind | In `publicAliases` | `disable-model-invocation` | Claude | Codex and Pi | Examples |
|---|---|---|---|---|---|
| Public, automatic | yes | absent | `/name` in the menu; the model can also load it | `$name` or `/name` alias, explicit only; the skill is `automatic` in `harness/skill-index.md` | `show-me`, `tour-v2`, `to-user`, `daily` |
| Public, manual-only | yes | `true` | `/name` in the menu; the model cannot load it | alias; the skill is `explicit` in the index | `huh`, `hunch`, `prompt`, `drunk-claude` |
| Worker | no | absent | not in the menu; the model loads it by description, or a router names it | `automatic` in the index | `golang`, `good-design-dry`, `readable-code` |
| Manual worker | no | `true` | nobody can start it with the Skill tool | `explicit` in the index | none; do not make one |

The `description` has a different job in each kind:

- In an automatic skill (public or worker), the description is the trigger. Write the requests and the situations that must load it.
- In a manual-only skill, the description is only the menu text. Keep it to one short sentence.

## Router and workers

A public skill with many kinds of work splits into one router and several workers. The router is public and holds the table that picks a worker. Each worker is not in `publicAliases`, and holds the procedure for one kind of work. A router whose forms no other skill loads keeps each form as a `references/` file instead of a worker. Example: `show-me` routes to `references/show-code.md`, `references/show-types.md`, and `references/show-cases.md`.

## Make a skill public

1. Add the skill name to `publicAliases` in `harness/rulesync/config.json`.
2. Copy `harness/rulesync/commands/huh.md` to `harness/rulesync/commands/<name>.md`, and change `name:`, `description:`, and the skill path. Codex and Pi use this alias. Claude uses the skill itself and skips the alias.
3. Add `disable-model-invocation: true` to the skill only when the model must not start it on its own, for example a persona or a skill with side effects.
4. From the checkout, run `mise run harness:sync`, then `python3 harness/rulesync/deploy.py --check`.

Done when `/name` shows in a new Claude session, and the skill row in `~/.codex/harness/skill-index.md` has the selection you chose.

## Run `prune-text` after you write markdown here

Any change to a `SKILL.md` or a `references/` doc under this tree ends with the `prune-text` skill (`harness-dev` plugin) over the files that the change touched. It cuts what two files repeat, cuts the dead weight inside each file, then reshapes the file into steps plus disclosed reference.

A new skill is not done until it passes `prune-text`. An edit to an existing skill runs it over that skill, not over the whole tree.

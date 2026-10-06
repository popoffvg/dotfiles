# TODO pairs

> Copy to `<notes-dir>/todos/CLAUDE.md` verbatim. Written once by `/code new` Step 0, which scaffolds the
> folder; no later subcommand rewrites it. Delete this block on copy; it is the only `>`
> block here, because a file copied verbatim needs no per-section rules.
> The prose follows `harness-dev:text-style`.

This folder holds the TODO bodies of one spec. **One ledger row is two files.** `N` is 1-indexed and
contiguous, one pair per row in the `spec.md` ledger. Written by `/code todo`.

## The pair

| File | Read by | Holds | Length |
|------|---------|-------|--------|
| `TODO-N.md` | the human, repo closed | frontmatter, Outcome, New terms, Components, **Increments** — the steps of the work, each with its own diff, **Flow changes**, Commit, Deviations | ≤ 550 lines |
| `TODO-N.test.md` | the human at the gate, then the implementer | Autotest — Unit and E2E | unlimited |
| `TODO-N.agent.md` | the implementer | Files — each path keyed to its increments, Pre-reads, Manual test, Gotchas | unlimited |

The split is by audience. `TODO-N.md` is the design a human approves: what the system will be able to
do, which symbols move, the steps that move them and what each symbol becomes, which running paths
gain a step or a check, and what the commit says. `TODO-N.test.md` is what proves it.
`TODO-N.agent.md` is where the work happens in the repo: the paths and the reading list.

## Read order

1. `TODO-N.md` — what to build, one increment at a time; `TODO-N.test.md` — what proves it.
2. Run `~/.claude/scripts/wm-constraints.py ../thoughts --todo TODO-N` before the first edit, and obey
   every rule it prints. This line is the one place the command is named: no pair file carries a
   rule or the command.
3. `TODO-N.agent.md` — the files and pre-reads of each increment.

Self-contained means the **pair plus those generated rules**. Implement from them alone.

## Write rules

- **Two stages.** `TODO-N.md`, `TODO-N.test.md`, and the `GLOSSARY.md` entries first; the human
  approves them, increments included; then `TODO-N.agent.md`, which finds the paths behind each
  approved increment. All three files are renumbered and deleted together.
- **One status per pair**, in `TODO-N.md` frontmatter: `todo → impl → verify → done`, with `blocked`
  as the failure branch. `TODO-N.agent.md` carries no frontmatter.
- **The diff lives once**, split across the increments of the human half — each increment carries its
  own diff and names no file. The agent half carries no ```diff block.
- **Neither half restates the other.** Each carries exactly one link to the other.
- **Neither half stores why.** A decision's reason is walked on demand from `../thoughts/` by the
  `trace` skill.
- **`## Deviations` is written by `/code impl`**, never by `/code todo`.

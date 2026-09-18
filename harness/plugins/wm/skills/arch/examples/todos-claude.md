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
| `TODO-N.md` | the human, repo closed | frontmatter, Outcome, Delivers, New terms, Components, **Surface** — the one diff in the pair, Autotest, Commit, Deviations | ≤ 550 lines |
| `TODO-N.agent.md` | the implementer | Constraints, Changes — the increments, described, Files, Pre-reads, Manual test, Definition of done | unlimited |

The split is by audience. `TODO-N.md` is the design a human approves: what the system will be able to
do, which symbols move, what they become, what proves it, and what the commit says. `TODO-N.agent.md`
is how to get there: the order of the work, what to do at each step, and the rules that bound it.

## Read order

1. `TODO-N.md` — what to build and what proves it.
2. `~/.claude/scripts/wm-constraints.py ../thoughts` — the rules the code must satisfy. No pair copies
   a rule; the agent half names this command instead.
3. `TODO-N.agent.md` — how, one increment at a time.

Self-contained means the **pair plus those generated rules**. Implement from them alone.

## Write rules

- **Both halves are written, renumbered, and deleted together.** One author per row; the two are
  written against each other — `## Components` is the map `## Changes` walks.
- **One status per pair**, in `TODO-N.md` frontmatter: `todo → impl → verify → done`, with `blocked`
  as the failure branch. `TODO-N.agent.md` carries no frontmatter.
- **The diff lives once**, in `## Surface` of the human half. The agent half carries no ```diff block.
- **Neither half restates the other.** Each carries exactly one link to the other.
- **Neither half stores why.** A decision's reason is walked on demand from `../thoughts/` by the
  `trace` skill.
- **`## Deviations` is written by `/code impl`**, never by `/code todo`.

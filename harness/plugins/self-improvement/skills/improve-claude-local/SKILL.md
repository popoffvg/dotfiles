---
name: improve-claude-local
description: >
  Triage captured lessons and route each to where it belongs
---

Run two steps in order: **(1) route every captured lesson to its correct home**, then **(2) keep what lands in CLAUDE.local.md sharp**. Route first, then tidy — a lesson in the wrong file is lost (too local) or noise (too broad).

# Step 1 — Route each lesson

Run every captured lesson through three gates, in order. Take the first that fits.

## Gate 1 — Global? (project-agnostic)

Would this lesson help on a *different* codebase? Code style, architecture principles, language idioms, general workflow/tooling habits, review taste — these transfer.

→ **Yes → a global skill + a pointer in `~/.claude/CLAUDE.md`.** Don't paste the instruction into CLAUDE.md — that file is always-on for every project and stays terse. Instead:

1. **Write a skill** at `~/.claude/skills/<slug>/SKILL.md` (write to `~/.claude` directly — never the dotfiles `harness/` source). The lesson body is the skill content; the **if/when trigger is the skill's `description`** (skills auto-load when their description matches the task). Phrase it generally; strip this project's names/paths.
2. **Add one pointer line to `~/.claude/CLAUDE.md`** — the if/when + a reference to the skill, nothing more:
   ```
   <task-relevant when="<trigger>">
   Use the `<slug>` skill.
   </task-relevant>
   ```
3. If a skill already covers this trigger, extend it instead of creating a new one.
4. Then drop the lesson from CLAUDE.local.md.

Examples: "prefer composition over inheritance for X-shaped problems", "name test files `*_test.go` next to source", "default to table-driven tests", "write commit subjects as `<prefix>: <why>`".

→ **No → Gate 2.**

## Gate 2 — Project-scoped pattern?

A reusable **pattern / convention / style** for *this* project that shapes a whole class of work — states what to do differently next time.

→ **Yes → the project's `CLAUDE.local.md`** as a `<task-relevant>` block (see "Which CLAUDE.local.md" below, then Step 2).

Examples: "in repo subfolders write `CLAUDE.md`, not `README.md`"; "a `*-help` command prints its table verbatim — no preamble, no tool calls"; "a router SKILL.md gives every subcommand its own `references/<sub>.md`".

→ **No → Gate 3.**

## Gate 3 — Otherwise: memory

A concrete one-off fact — a path, flag, command, ID, env quirk, "X lives at Y". Answers a lookup, doesn't shape behavior across tasks.

→ **engram** (`mem_save`). Drop from CLAUDE.local.md.

Examples: "the staging cluster is `dev-htz-fra1`"; "`gh` needs `--user vgpopov` for org repos"; "the DB dump script is `mise run dump-db`".

## Routing summary

```
global (helps other repos)?      ─yes→ ~/.claude skill + pointer in ~/.claude/CLAUDE.md
        │no
project pattern (class of work)? ─yes→ project CLAUDE.local.md (<task-relevant>)
        │no
        ▼
        memory (engram mem_save)       (concrete one-off fact)
```

## Which CLAUDE.local.md, and keep it private

Project-scoped rules go in the **project's** `CLAUDE.local.md` at the repo root (`git rev-parse --show-toplevel`). Create it if missing — the project is always a git repo. Keep it out of version control via the `local-gitignore` skill (adds `CLAUDE.local.md` to `.gitignore.local`); never commit it.

If the cwd is **not** a git repo, route the rule to the global `~/CLAUDE.local.md` instead.

# Step 2 — Keep CLAUDE.local.md sharp

Applies to everything that landed in CLAUDE.local.md (the score-4/5 patterns).

## Format: `<task-relevant>` blocks

Wrap each conditional rule in a `<task-relevant when="...">` block — an explicit relevance signal so the model attends to a rule only when its `when` matches the task at hand.

### Principles

**1. Foundational context bare, conditional rules wrapped.** Leave bare anything relevant to ~90%+ of tasks in this repo (project identity, one-line map, where things live). Wrap anything that only matters for a kind of work. Most rules are the wrapped kind.

**2. One rule, one block, one condition.** Each rule gets its own block with a narrow `when`. Never group unrelated rules under one broad condition — broad conditions match everything and dilute nothing.

```
<task-relevant when="documenting a module/folder's structure or intent">
Write CLAUDE.md in that folder, not README.md.
</task-relevant>
```

**3. Generalizable rule, not a fact.** Each surviving block states **what to do differently next time**. (If it's a raw fact, it should have gone to engram in step 1.)

**4. Merge overlapping rules.** If one block refines another for the same trigger, merge into the sharper one. No two blocks the model weighs for the same task.

**5. Drop stale rules.** A rule pinned to a file/flag/workflow that no longer exists is dead weight — verify the anchor exists; delete if gone.

**6. Keep the `when` in the user's terms.** Describe how a *task* looks, not how the codebase looks: "when committing across multiple repos", not "when in a monorepo".

## Guards

- Keep the `## Self-improvement` header bare — it's the anchor the Stop hook appends to.
- Never touch the project's *checked-in* `CLAUDE.md` — that's shared onboarding, not captured corrections.

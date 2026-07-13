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

→ **Yes → a global skill.** Don't paste the instruction into CLAUDE.md — that file is always-on for every project and stays terse. Instead:

1. **Write a skill** at `~/.claude/skills/<slug>/SKILL.md` (write to `~/.claude` directly — never the dotfiles `harness/` source). The lesson body is the skill content; the **if/when trigger is the skill's `description`** (skills auto-load when their description matches the task). Phrase it generally; strip this project's names/paths.
3. If a skill already covers this trigger, extend it instead of creating a new one.
4. Then drop the lesson from CLAUDE.local.md.

Examples: "prefer composition over inheritance for X-shaped problems", "name test files `*_test.go` next to source", "default to table-driven tests", "write commit subjects as `<prefix>: <why>`".

→ **No → Gate 2.**

## Gate 2 — Project-scoped: action, or pattern?

Project-specific and not global. Split on **shape**: does the lesson describe *steps to run in a situation* (an action), or *a rule to honor when deciding* (a pattern)?

### Gate 2a — Repeatable action (a procedure)

A **checklist / sequence of steps** to execute whenever a situation recurs — a verification pass, a regeneration sequence, a deploy ritual. States *what to do*, in order, next time the trigger fires.

→ **Yes → a project skill** at `<repo-root>/.claude/skills/<slug>/SKILL.md`. Mirror the global-skill move from Gate 1, at project scope:

1. **Write the skill.** The procedure's steps are the body. The **situation that triggers it is the `description`** (skills auto-load when the description matches the task). Keep this project's real paths/commands — it's project-scoped, so concreteness helps.
2. **Scope activation** with `paths:` when the trigger is "touched these files" — e.g. the LLM-config files for a post-model-change check. This makes the skill auto-fire only on relevant edits.
3. **Invocation frontmatter** (verified vs code.claude.com/docs/en/skills.md):
   - Default (omit both) → Claude auto-invokes on match **and** user can run `/slug`. Use for verification/checks that should fire unprompted next time.
   - `disable-model-invocation: true` → user-only via `/slug`, never auto-fires. Use for deliberate or destructive actions (deploy, migrations) the user must trigger.
   - `user-invocable: false` → hidden from the `/` menu, model-only.
4. If a skill already covers this trigger, extend it instead of creating a new one.
5. Keep it private like `CLAUDE.local.md`: add `.claude/skills/<slug>` to `.gitignore.local` via the `local-gitignore` skill. Never commit captured corrections. Then drop the lesson from CLAUDE.local.md.

Example: after changing the LLM model in the API settings and shipping a mistake, the fix is a *procedure* — "when editing the LLM model/API config, verify token limits, pricing, and the model id against the claude-api skill before shipping". That's a skill (`paths:` scoped to the config files), not a bare rule.

→ **No → Gate 2b.**

### Gate 2b — Project pattern (a rule)

A reusable **pattern / convention / style** for *this* project that shapes a whole class of work — a decision to make differently next time, with no procedure to run.

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
project action (steps to run)?   ─yes→ project .claude/skills/<slug>/SKILL.md
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

---
name: improve-claude-local
description: >
  Triage captured lessons and route each to where it belongs, then keep
  CLAUDE.local.md sharp. Three destinations: project-agnostic lessons (code/arch
  style, language idioms) → global ~/.claude/CLAUDE.md; concrete project facts →
  engram (mem_save); project-scoped patterns/conventions → CLAUDE.local.md as
  <task-relevant> blocks. Use when the user says "improve claude.local", "clean up
  the local rules", "claude.local is bloated", or after the Stop hook has appended
  rules.
---

Run two steps in order: **(1) route every captured lesson to its correct home**, then **(2) keep what lands in CLAUDE.local.md sharp**. Route first, then tidy — a lesson in the wrong file is lost (too local) or noise (too broad).

# Step 1 — Classify and route each lesson

For every captured entry, ask two questions.

## Q1: Is it project-agnostic?

Would this lesson help on a *different* codebase? Code style, architecture principles, language idioms, general workflow/tooling habits, review taste — these transfer.

→ **Yes → global `~/.claude/CLAUDE.md`.** Append it to the user's cross-project rules. Phrase it generally; strip this project's names/paths. This file is always-on for every project, so keep it terse and only add lessons that are genuinely transferable. Then drop it from CLAUDE.local.md.

→ **No (specific to this repo) → Q2.**

Examples that go global: "prefer composition over inheritance for X-shaped problems", "name test files `*_test.go` next to source", "default to table-driven tests", "write commit subjects as `<prefix>: <why>`".

## Q2: Score the project-scoped lesson 1..5

Score by **abstraction / reusability within this project** — how many future tasks it shapes.

| Score | Nature | Destination |
|---|---|---|
| **1–2** | Concrete one-off fact — a path, flag, command, ID, env quirk, "X lives at Y". Answers a lookup, doesn't change behavior across tasks. | **engram** (`mem_save`). Drop from CLAUDE.local.md. |
| **3** | Borderline. If it generalizes to a "next time do X instead of Y" rule → CLAUDE.local.md. If it's really a lookup → engram. | judgment |
| **4–5** | A reusable **pattern / convention / style** for this project that shapes a whole class of work. | **CLAUDE.local.md** as a `<task-relevant>` block. |

Score-5 examples (these belong in CLAUDE.local.md): "in repo subfolders write `CLAUDE.md`, not `README.md`"; "a `*-help` command prints its table verbatim — no preamble, no tool calls"; "a router SKILL.md gives every subcommand its own `references/<sub>.md`".

Score-1 examples (these go to engram): "the staging cluster is `dev-htz-fra1`"; "`gh` needs `--user vgpopov` for org repos"; "the DB dump script is `mise run dump-db`".

## Routing summary

```
project-agnostic? ─yes→ ~/.claude/CLAUDE.md   (transferable rule, generalized)
        │no
        ▼
score 1..5 ─1-2→ engram (mem_save)            (concrete fact)
           ─4-5→ CLAUDE.local.md              (project pattern, as <task-relevant>)
           ─ 3 → judgment: rule→local, fact→engram
```

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

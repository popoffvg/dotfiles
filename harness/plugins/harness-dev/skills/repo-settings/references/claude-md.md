# The repo CLAUDE.md

`CLAUDE.md` is loaded into every session in this repo. It holds the **maintenance contract**: the rules an agent cannot derive from the code. It does not repeat the README, and it does not restate what the deploy and adr skills already say.

## Required sections

### Overview

Two or three sentences: what the repo produces, and the one structural fact an agent must hold — monorepo, event-sourced, generated client, whatever a reader would otherwise get wrong.

### Deploy

State the trigger and the boundary, then point at the skill:

```md
## Deploy

Deploy runs through `.claude/skills/deploy/SKILL.md` — never through ad-hoc commands. Invoke it as `/deploy`.

The skill is generated from `<the CI workflows and release scripts>`. When any of those change, regenerate the skill in the same change — a stale deploy skill is worse than none.

Applying steps (`apply`, `push`, `promote`) always ask before running, whatever the permission mode.
```

Replace `<the CI workflows and release scripts>` with the real paths found in the survey.

### Decisions

State when Claude raises an ADR, and point at the skill:

```md
## Decisions

Active architecture decisions live in `docs/adr/`, superseded and deprecated ones in `docs/!archived/adr/`. The `adr` skill holds the format, the metadata keys, and the tests for what qualifies.

Offer an ADR when a change is hard to reverse, surprising without context, and the result of a real trade-off — all three. Draft it from `docs/adr/TEMPLATE.md` and ask; do not commit an ADR unreviewed.

Every edit to an ADR bumps `updated` and appends a line to its closing `## Changelog` section. An ADR that a new one replaces gets `status: superseded-by-NNNN` and moves to `docs/!archived/adr/`.

Before proposing a technology, integration pattern, or boundary change, read both directories — a rejected alternative is often already recorded there.
```

### Conventions

Only the rules the code does not state: the ubiquitous language of this domain, the layering rule, the commit convention, the test command that must pass before a commit. Each as one line. A convention a linter already enforces does not belong here.

## Rules

- **One source of truth per fact.** The deploy procedure lives in the deploy skill; the ADR format lives in the adr skill; `CLAUDE.md` names *when* each fires. Restating either creates drift.
- **Point with resolvable relative paths.** `.claude/skills/deploy/SKILL.md`, `docs/adr/`.
- **Rules are positive.** State the target behaviour, so the unwanted one is never named.
- **Keep it under one screen.** `CLAUDE.md` costs context in every session in the repo. Detail moves to a skill or a `docs/` page behind a pointer.

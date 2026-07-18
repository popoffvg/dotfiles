---
status: todo          # todo → impl → verify → done  (blocked: dep unmet / verify DEVIATES). Machine: ref-write.md § Status
type: component       # workflow | state machine | component | event handler | data shape change
depends_on: []        # [TODO-M, …] — each must reach status: done first. [] if none
risk: 3               # 1–5 blast radius — retest reach, not effort. 1 = local additive · 3 = one component + callers · 5 = core types many modules depend on. See todo.md § Risk / blast radius
thoughts: []          # [NNN-decision-slug, NNN-fact-slug] — every thought this TODO implements or is constrained by; same notes as the spec.md Plan decision trail. [] only if the spec has no thoughts yet
---

# TODO-N: <imperative title, ≤ 60 chars>

<!-- ── Verification block: a human reads only down to Autotest, repo closed ── -->

## Outcome

<actor> can <capability> [when <condition>]. <2–5 sentences total. First sentence is the capability. Remaining sentences give a reader without context what they need: what triggers it, what state changes, what fails and how. Use-case language only — no file paths, type names, routes, libraries. Use terms from `GLOSSARY.md` verbatim.>

## New terms

<Only if the TODO introduces terms missing from `GLOSSARY.md`. Otherwise delete this section entirely — do not write "none". See todo.md § New terms.>

| Term | Kind | Description |
|------|------|-------------|
| <Term> | <entity \| value-object \| aggregate \| component \| service \| policy \| state \| command \| event> | <one sentence with the visible contract: TTL, bounds, error semantics> |

## Changes

<If a public interface changes, an Interface sub-block goes FIRST: unified git-diff for modifications, full listing for new interfaces. See todo.md § Changes.>

<TS pseudocode — follow `flow`. One ```ts block, ≤ 40 lines, all side effects + error paths visible. No real imports or file paths inside the snippet. Must deliver the Outcome above.>

## Autotest

- **Level:** unit | integration | e2e | none
- **Target files:** `<test file path>`
- **Cases:** <each case proves part of the Outcome>
  - <input → expected, one sentence each>
- **Command:** `<single runnable shell command>`
- **Expected:** <pass criteria>

<!-- ── Scaffolding block: for the implementer; machine-checkable, no human read ── -->

## Files

- `<repo-relative path>` — create | modify | delete | rename → <new path>

## Pre-reads (MUST read before editing)

- `<repo-relative path>` — <why the implementer must read it>

<If none: `none — reason: <specific>`>

## Skills to load

- `<skill-name>`

<If none: `none`>

## Manual test

- **Steps:**
  1. <literal command or action>
- **Expected:**
  1. <observable outcome — aligned 1:1 with Steps>
- **Skip?** no | skip — reason: <specific>

## Commit

- **Prefix:** feat | fix | refactor | chore | docs | test
- **Subject:** `<literal commit line, ≤ 72 chars, imperative, no period>`
- **Description:** <few sentences: why the change is needed, decisions made>

## Definition of done

- [ ] All files in **Files** modified/created as specified
- [ ] Autotest command passes
- [ ] Manual test steps produce **Expected** outcomes
- [ ] No edits outside **Files** without recording it in the notes (jj snapshots on session stop)
- [ ] Commit created with the message above

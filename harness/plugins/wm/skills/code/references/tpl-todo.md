---
status: todo          # todo → impl → verify → done  (blocked: dep unmet / verify DEVIATES). Machine: ref-write.md § Status
type: component       # workflow | state machine | component | event handler | data shape change
depends_on: []        # [TODO-M, …] — real edges only (they define the spec.md Plan waves); each must reach status: done first. [] if none
risk: 3               # 1–5 blast radius — retest reach, not effort. 1 = local additive · 3 = one component + callers · 5 = core types many modules depend on. See todo.md § Risk / blast radius
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

## Constraints

<One row per settled decision that an increment below can violate — this is the implementer's only source for settled decisions. Restate the rule, not its discussion. Omit a decision that binds a different TODO, and omit the section entirely when none binds this one. See todo.md § Constraints.>

| Constraint | From |
|------------|------|
| <what the code must do, one sentence — invariant or imperative, no trade-off prose> | [[NNN-decision-slug]] |

## Components

<The `package.Class` set this TODO touches, main part first. Exactly one row is `main`. ≤ 5 rows. New component → suffix ` (new)`. See todo.md § Components.>

| Component | Part | Role |
|-----------|------|------|
| `<package.Class>` | main | <one sentence — this TODO's slice of its job> |
| `<package.Class>` | supporting | <one sentence> |

## Changes

<An ordered increment sequence — the diffs that build the commit, in apply order. One increment = the smallest diff worth approving alone. `n` contiguous from 1, ≤ 10 increments, each naming one Components row. Order deepest-first so the repo builds after each. Increment 1 creates the commit; each later approved increment is appended to it. See todo.md § Changes.>

### 1. <imperative title> — `<package.Class>`

- **Files:** `<repo-relative path>` <this increment's paths only — a subset of ## Files>
- **Blast radius:** <predicted reach: the symbols, callers, consumers a mistake here forces you to retest. Name them — "low" is not a blast radius>
- **Diff:**

```diff
-<old line>
+<new line>
```

<≤ 25 changed lines, real language, one block per file. New surface → all-`+`, written out in full: every field, method, doc comment. No `// ...`. Cannot build alone → add `builds: only with increment <n>`.>

- **Behavior:** <only on the increment carrying the Outcome's logic, and only when the diff does not show the flow>

```ts
<TS pseudocode — follow `flow`. ≤ 40 lines, all side effects + error paths visible. No real imports or file paths inside the snippet. Must deliver the Outcome above.>
```

### 2. <imperative title> — `<package.Class>`

- **Files:** `<repo-relative path>`
- **Blast radius:** <named symbols/callers to retest>
- **Diff:**

```diff
+<new line>
```

## Autotest

<Both levels required. A level that cannot exist: `none — <concrete reason>`; an E2E deferred to another TODO names it. See todo.md § Autotest.>

### Unit

- **Target files:** `<test file path>` (create | modify)
- **Cases:** <each case proves part of the Outcome or a ## Constraints row>
  - <input → expected, one sentence each>
- **Command:** `<single runnable shell command>`

### E2E

- **Target files:** `<test file path>` (create | modify)
- **Entry point:** <where the request/command enters, as a caller enters it>
- **Cases:** <each case asserts the Outcome as an observer sees it>
  - <input → expected, one sentence each>
- **Command:** `<single runnable shell command>`

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
- [ ] Every **Constraints** row holds in the shipped code
- [ ] Both Autotest commands pass — Unit and E2E (or the level is `none` with its stated reason)
- [ ] Manual test steps produce **Expected** outcomes
- [ ] No edits outside **Files** without recording it in the notes (jj snapshots on session stop)
- [ ] Commit created with the message above

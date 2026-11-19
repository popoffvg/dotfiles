---
name: change-review
description: The template of a document that a human reads to approve one code change — before the code exists (a plan, a TODO, a slice of a spec) or after it lands (a PR description, a review summary, a handoff of a branch). Sections Outcome, New terms, Components, Flow changes, Increments with their commits, and Deviations, each with the line that tells the reviewer what to check. Load it when you write or rewrite such a document, or when the user says "write it up for review", "describe this change", "review template", or "plan this change for my approval".
---

# change-review — one change, read once, approved or rejected

A change review is one markdown document about one change. A reviewer reads it with the repo closed and approves or rejects the change. Copy the sections below in this order. [references/example.md](references/example.md) is the filled example: copy the shape of each section from it.

## Rules every section shares

- **Symbols, not paths.** Name a symbol as `## Components` names it (`pkg/auth.Handler`). Write a glossary term of the project verbatim. File paths stay out of the document.
- **A required section with nothing to say has one line: `none — <concrete reason>`.** Omit an optional section instead.
- **Tables have no row cap.** A row left out to keep a section short is a fact the implementer guesses.
- **A size cap is a split signal.** Past a cap, split the change into two changes. Do not shorten the section.
- **Each section stands on its own** for a reader who reads only that section.
- **Each H2 opens with its `> **Check:**` line, copied verbatim.** It tells the reviewer what to check before approval. You MAY add one sentence that names the point most worth checking in this change.
- The prose follows the `i-have-adhd` rules, because a human reads it to decide.

## Title

`# <what the change brings>`, at most 60 characters. The title states the gain that a user or the system has once the change lands, never the work.

- Good: "A stolen refresh token stops working at the next refresh".
- Bad: "Rotate refresh tokens on /auth/refresh" (the work), "Add `TokenPair` type" (a type), "Refactor `Session`" (a verb with no result).

## Outcome

> **Check:** each bullet is a thing a user or a caller can do once this change lands. Find the capability you expect and do not see, and the one you did not ask for.

- One feature per bullet: `<actor> can <capability> [when <condition>]`, or `<aggregate> emits <event> when <command> succeeds`. Then an em dash and what lands: `<kind> on <symbol>` — a public method, a state machine, an event, an endpoint, a config key, a migration, a script.
- Two to seven bullets, one sentence each, the biggest first. The first is the capability. The others give the trigger, the state change, and the failure.
- Do not write paths, routes, libraries, "add a field", or "wire up".
- A pure refactor writes one bullet: "No new capability; reshapes `<symbol>` so `<what>` shares one path."

## New terms

> **Check:** read each **Description** once. Say if you would use another word for this thing, or if the word already means something else in the code.

*Optional.* One row per domain term that the change adds and the project glossary does not carry: `| Term | Kind | Description | Forbidden |`. **Description** is one sentence with the visible contract: TTL, bounds, error semantics. **Forbidden** lists the other names you met for the concept, or `none`. A second name for a concept that has a name is a rename, not a new term.

## Components

> **Check:** this tree is the whole reach of the change. Find the component you know must change and do not see here. Confirm that the `main` component is the one that carries the Outcome.

A component tree (`show-me`), one tree per package:

- The root is the package path with `# OWNS <one clause>`: what the package answers for once the change lands. The tree with the `main` component comes first.
- A component is a child of the root, named bare (`Handler`). Its line starts with a mark in the first column (`+` new, `~` changed, `-` gone) and ends with `# <brick> · <part> — <role>`. A root line starts with two spaces.
- **Brick**: `command | service | flow | gateway | server | consumer | policy | scheduler | wiring`. A component that fits no brick, or two, has two jobs: split it.
- **Part**: `main` or `supporting`. Exactly one component in all trees is `main`: the one that carries the Outcome. Two candidates mean the change does two things.
- **Role**: one sentence, the slice of the component's job that this change touches.
- A child of a component is one member that the change decides: a method, a field, a case. It has a mark and a comment with no `·` pair.
- A component that the change only reads is not in the tree.
- **Every public member names its caller**: `called by <package.Symbol>`, or `implements <Interface>`. A member with no caller outside its package is private. A test is not a caller. A fixed sequence of calls that keeps one invariant is one public operation with private steps. A mechanism that keeps an invariant (a lease, a lock, a retry loop) is private.

## Flow changes

> **Check:** read the marked steps only. Confirm that each new check runs at the right place, and that each stop gives the caller the right answer.

One H3 per running path that the change touches, drawn in the form of `show-me` § Flows: the heading names the entry point in domain words, the line under it is the `package.Class.method` that runs it in italic code, and the `python` block marks each changed step. When the path is a step of the main user flow of the project, add `— main flow step <n>`.

- Write a review step in domain words, before or after the code lands. A symbol keeps its exact name only when it is a `## Components` row or an error the caller matches on. Existing-code traces outside a change review use exact code names under `show-code`. No types, error plumbing, or imports.
- Every marked `if`, `elif`, `else`, or `raise` has a test case. A new path with no case is a path nobody tests.
- A change with no running path to show writes `none — <reason>`, for example a rename.

## Increments

> **Check:** for each increment, read the summary, then **Surprises**. Agree or disagree with each surprise: these are the details you would otherwise find only in the code. Confirm that each diff stays in the one component under its heading. At each `### Commit` section, confirm that its title states one change.

The whole change cut into the steps the implementer applies, one H3 per step in apply order, grouped into commits. An increment is the smallest step worth approval on its own. A commit is the smallest group of increments with one cause.

**Heading:** `### <c>.<i>. <imperative title>`. `c` is the commit and `i` the increment in it, both 1-indexed. `i` starts again at 1 in each commit. The title uses domain words and no symbol. Then, in this order:

| Part | Content |
|------|---------|
| **component** | The line under the heading: the `## Components` row in italic code |
| **summary** | One to three sentences: what the increment brings. For changed behavior: `Before, <what the code did>. Now, <what it does>.` No code |
| **Change** | The kind of change of this increment: new behavior, signature change, call-site migration, wiring, refactor, and so on |
| **Extends** | The existing symbol the increment grows and what it gains, or `new — checked <A>, <B>: <why none fits>` |
| **Surprises** | One to seven bullets: the details the reader would find only in the code |
| **Surface** | The diff the increment lands as one `diff` block, a plain contract block, or `none — <reason>` |

- **One increment, one component.** A change in a second component (a caller moved to a new signature, a route to the new method) is its own increment.
- **Each increment stands alone.** The summary never points elsewhere ("as above"), and the diff holds every symbol the summary names as new or changed.
- **Surprises** name a symbol, a value, or a case: an edge case, a refused input, a changed default, an order that matters, a callee error passed through, a caller that stops compiling. A restated summary or "be careful" is not a surprise.
- **Extends makes a new symbol cost a search.** Grow what exists first. `new` is legal only with the symbols you checked and the fact that rules out each one.
- **Surface is what a caller sees**: types, fields, signatures, and settings with their real values, in real syntax, with nothing elided. No comments in a diff. The diff carries the decided change, not the edits it forces in other components, and the surface, not a body. A whole body (a script, a migration) gets a plain contract block: invocation, arguments, exit codes, output.
- **An interface implementation shows one assertion line per interface**, plus its constructor and the public methods that no interface declares.
- **Order: deepest first.** The callee comes before its caller, the type before its user, the wiring last. A signature change that breaks a caller in another component is followed at once by the increment that moves that caller, in the same commit. Its **Surprises** name the callers that stop compiling.
- **Sizes:** at most 10 increments per commit, 4 commits, and 150 changed lines per diff. Past that, split the change.

### Commit

After the last increment of a commit, write a `---` line and `### Commit <c>` with three fields:

- **Title**: the exact line to commit: `<prefix>: <line>`, at most 72 characters, imperative, no period.
- **Body**: the cause, the goal, and the decision when a real alternative lost, one paragraph each. The reader has only the repo: no ticket, no increment number. The `commit-message` skill owns the full contract.
- **Proves**: the test cases that pass from this commit on, as `<level> — <case>`. Each case names the first commit at which it can pass. A commit with no case writes `none — <reason>`.

Together, the commit titles state the change that the Outcome promises. A capability in one and not in the other means the document is wrong: fix it before any increment lands.

## Deviations

> **Check:** each row is a place where the shipped code differs from the text you approved. Agree with each **Why**, or ask for the approved shape.

*Only after the code lands.* The implementer appends it when the shipped code differs from an approved section. The approved text above stays as it was. One row per difference: `| What | Shipped instead | Why |`. **What** names the section and the symbol or case. **Shipped instead** and **Why** are one line each. A difference that reaches past this change belongs in a new review, not here.

Done when every section is present or written as `none — <reason>`, every H2 has its **Check** line, and no file path appears outside a **Surface** contract.

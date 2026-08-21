# code — prototype

A prototype is not an implementation. It is the smallest visible code diff that lets the user
judge an **open question** by reading it. Vocabulary: `wm:GLOSSARY.md`.

## Rules

- Touches **real code** in the real repo — no scratch dirs, no `/tmp`.
- Does not run: no `go build`, no lint, no tests, no codegen, no commits.
- The diff is the artefact — the user reads it to decide.
- Scope ≤ 4 files. Beyond that, the implementer stops and reports.
- Compile breaks at the prototype's edges are expected — leave a `TODO(<TICKET>) prototype:` marker showing the real wiring. Do not "fix" them; that wiring is a downstream TODO's job.

## When to use

An open question note (`thoughts/NNN-question-*.md`, `status: open`) needs settling, downstream TODOs can't be authored honestly until the shape is known, and spiking it beats discussing longer. Not for production work — the output is a dirty tree to review then discard or harden.

## Workflow

### 1. Pin the question
Read the open question note (list them: `~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts`). Append to that note which candidate option is being prototyped and why this one first. One shape per spawn — never "try all three at once".

### 2. Name the candidate options
The question note lists candidates as `(a) / (b) / (c)`, one line each, so feedback is unambiguous ("reject (b), do (c)"). Recommend a default; the user overrides. "Let's try option X" is binding for the pass.

### 3. Brief the implementer in full
A fresh agent with no planning context. The prompt carries: working dir (absolute); current tree state (instruct `git diff` / `git status` first); the shape by option letter; exact files + line numbers from `<notes-dir>/research/`; step-by-step changes with verbatim type snippets where the type system is load-bearing; non-goals (no build/lint/test/commit/codegen, ≤ N files); expected compile breaks named so they aren't "fixed"; deliverable format (< 250 words: `git diff --stat`, key code blocks inline, compile breaks with file:line).

### 4. Read the diff, not the report
The report is a navigation aid. Judge from `git -C <repo> diff <files-touched>`. Report claims disagree with the diff → push back or re-spawn.

### 5. Iterate on the shape
- **Reject** → capture *why* in the question note (permanent context), pick the next candidate, re-spawn. The implementer **reverts** prior prototype edits first — never stack shapes.
- **Accept** → write the answer as a new `NNN-decision-*.md` (`ref-note-format.md` § Resolution): option chosen, rationale, rejected candidates. Marking the question answered archives it. Then body the downstream TODOs via `/code todo`. The real impl may diverge — expected.

## The "valid for a prototype, broken as a contract" smell

Prototypes breed convenience hacks — nullable dependencies, fallback branches, sentinel values, silent no-ops — each a future bug surface if treated as the answer. Before resolving, ask:

- A `nil`-tolerant dependency production would never tolerate?
- A zero-value / sentinel ambiguity (two states that look the same)?
- A silent-degradation path (misconfigured looks like a valid mode)?
- Is the invariant the decision was meant to establish actually enforced, or side-stepped?

Any yes → the prototype answered "is this shape expressible?" but not "is it correct?". Tighten the contract — split one nullable type into two non-nullable ones, move the invariant into the constructor (error/panic on misconfigure), or lift variation to another layer — and **re-spawn before resolving**.

## Ends

After review, control returns to the user's call: the thought note to record the resolution, or `/code todo` to body the unblocked TODOs. No automatic chaining. Each pass's option, compile breaks, and verdict live in the question note while it is open, and carry over into the decision note that answers it; the notes jj repo snapshots them on session stop (`code:ref-jj-notes.md`).

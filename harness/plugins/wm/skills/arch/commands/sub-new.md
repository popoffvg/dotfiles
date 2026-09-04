# code — new (the grill loop)

Obeys the shared subcommand rules — see `code:ref-subcommand-rules.md`.

## Step 0: Starting state

> The notes jj repo is inited on session start and committed on stop — `code:ref-jj-notes.md`. No manual init.

No `<notes-dir>/spec.md` → write a minimal one (full template: `ref-write.md` § spec.md template):

- **Frontmatter** — a `---` block with `status: init`, `approve: increment` (the default; Step 0.6 replaces it with the user's answer — `ref-write.md` § Approval), `branch:` (current branch, `git rev-parse --abbrev-ref HEAD`), and `drives:` (one sentence from the user's request). No phase-rules prose in the body — the machine lives in `ref-write.md` § Status.
- **Description** — one sentence from the request. **Goal** — 2–3 plain sentences.
- **Open questions** — seed 1–3 as `thoughts/NNN-question-*.md` notes (`status: open`, example `examples/note-question.md`). They live in the thought graph, not in `spec.md`; the spec has no Open Questions section. **TODO List** — empty until the grill closes.
- Create `<notes-dir>/GLOSSARY.md` from `examples/glossary.md`, empty.
- Create `<notes-dir>/CLAUDE.md` from `examples/notes-claude.md` — the corpus guide any agent entering the folder reads. Copy the example's fenced block verbatim, not its header.
- Create `<notes-dir>/PATTERNS.md` from `examples/patterns.md` — the implementation patterns and reference files the implementer follows. Empty or "follow language defaults" at init; `spec.md` mentions `@PATTERNS.md` and holds no pattern content.
- What we're NOT doing — empty or "follow language defaults". No `Design Decisions` and no `Open Questions` section: both live in `thoughts/` (`ref-write.md` § Artifacts).

`CLAUDE.md` and `RULES.md` are written **once**; if either already exists, leave it — the user owns it after init. `PATTERNS.md` is created once and stays open to extension — patterns as they surface. It is never rewritten from the example after init. No rules file is created: the rules every TODO obeys are generated from `thoughts/` (`ref-todo-sections.md` § Constraints).

spec.md exists → check the frontmatter `branch` against the current branch (`ref-write.md` § Spec ownership by branch):

- **Shares part** (one contains the other as a substring) → same work; this is iteration, skip to Step 0.5.
- **No shared part** → the spec belongs to unrelated work; author a fresh minimal spec (the bullets above) with `branch` set to the current branch. The prior spec stays in the notes jj history.

## Step 0.5: Ingest explore artifacts

Run every time. Check `<notes-dir>/research/`:

- Empty or missing → skip to Step 1.
- Present → read `INDEX.md` first (else every `.md`). For each concrete finding — observed code behavior, user assertion, flagged gap — write one `NNN-fact-*.md` thought (`source: auto`, example `examples/note-fact.md`, shared counter from 001). One fact per finding; **before the grill starts**, so decisions can link them. Write each research gap as one `NNN-question-*.md` thought (`source: auto`, `status: open`, example `examples/note-question.md`) — same directory, same counter. Print: `Ingested explore artifacts: N fact notes, M question notes.`

## Step 0.6: Set the rules

Runs once, only when `<notes-dir>/RULES.md` is missing. Skip it entirely when the file exists.

Ask **four** questions as **one** `to-user` file (`code:ref-subcommand-rules.md` § Put a batch of
questions in a file the human edits) — approval depth during `impl`, plus the three init knobs from
`examples/rules.md` (which questions reach the human during the grill, test timing, and who
commits). Each block's **Recommended** is the default. Do not assume an answer: this is the one
place the user sets the interaction contract. A block the user leaves as written takes the default.

The four answers land in **two** files, each in its one home:

- **Approval depth** — *each increment* / *once per TODO* / *autonomous* — is the `spec.md`
  frontmatter `approve` key, written as `increment` / `todo` / `none` (`ref-write.md` § Approval).
  Replace the `increment` default Step 0 wrote. It is spec metadata, not a rule, because `impl`
  branches on the value rather than raising a choice with the human. The answer sets the depth for
  every TODO the spec drives; a single TODO that needs a different one overrides it in its own
  frontmatter, and the question is not re-asked per TODO.
- **The other three** go into `<notes-dir>/RULES.md` using the example's copy block: fill the
  Answers table with the three settings and expand each `<…>` in the per-step table. No placeholder
  may survive.

Then print: `RULES.md written — <the three settings, one line>. Approval: <approve value>.`

Every later subcommand reads `RULES.md` first and obeys it over its own defaults. It never lowers
a hard gate: the human still reads the spec at the `review→impl` gate, and destructive git actions
are still confirmed.

## Step 1: Grill

Run the `grilling` skill until no `status: open` question note is left in `thoughts/` (list them: `~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts`). Every resolution **writes the answer as a new `decision` or `fact` note** at the next `NNN`, restating the question verbatim, and marks the question note answered — a hook archives it, which is what drops it off the list (`ref-note-format.md` § Resolution). A new question raised mid-grill gets its own `NNN-question-*.md` note before you answer it; the decision tree **is** the spec — walk it branch by branch. A question the codebase can answer, read instead of ask.

Record docs as the grill goes with the `domain-modeling` skill — each resolved decision as an ADR, each term in the glossary. Inside the wm flow the glossary is `<notes-dir>/GLOSSARY.md`, never `CONTEXT.md`, and every new or renamed term needs the human's approval first (`code:ref-subcommand-rules.md` § Glossary).

### Exit contract

#### 1. Back-link every thought
Back-fill `Affects` and populate `links` per `ref-note-format.md` § Back-linking.

#### 2. Confirm spec.md reflects every resolution
Every decision is a `thoughts/NNN-decision-*.md` note — **not** a spec section (`spec.md` has no Design Decisions); a decision an increment can violate is a `decision` note whose `description` states the rule the generator prints (`ref-todo-sections.md` § Constraints); routine picks land in GLOSSARY.md / scope instead; new out-of-scope items in What we're NOT doing. **No `status: open` question note left** (`~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts` exits 0; any open one = NOT READY). Advance the frontmatter `status: init → review`. Self-check against `ref-write.md` § Spec-Readiness Checklist.

#### 3. Compile the plan
Write a `## Plan` at the bottom of spec.md — 3–5 sentences (one per major branch) plus the **wave** table. No decision-trail table: the graph lives in `thoughts/`, the rules it settled are printed by `~/.claude/scripts/wm-constraints.py <notes-dir>/thoughts`, and a reader who wants the reasoning behind either runs the `trace` skill.

```markdown
## Plan

<target-picture summary, one sentence per branch>

### Waves — parallel execution
| Wave | TODOs | Runs together because |
|------|-------|-----------------------|
| W1 | TODO-1, TODO-2 | no `depends_on` between them; Files sets disjoint |
| W2 | TODO-3 | `depends_on: [TODO-1]` |
```

Build the waves per `ref-write.md` § Waves — group for maximum parallelism: compute the real edges, put every edge-free TODO in `W1`, keep one wave's **Files** sets disjoint, and prefer a split that removes an edge over one that adds a chain. A spec whose waves are all one TODO wide is a serialized spec — re-check whether those edges are real.

### Step 2. Commit + report
`jj commit -m "<what was grilled, decisions added, questions closed, note count>"` in `<notes-dir>`. Then print: shared-understanding summary (2–3 sentences), note count (N decisions, M facts, K questions still open — 0 for READY), the wave table, and the next action — **review the spec, then `/code todo`**.

## Stop at the gate

`new` ends here. It writes neither half of a row — not `todos/TODO-N.md`, not `todos/TODO-N.agent.md`. The spec + thought graph are now
reviewable; the human reviews and runs `/code todo` when satisfied (the gate — `ref-write.md`). Review
surfaces gaps → run `/code new` again to re-grill.

# code — new (the grill loop)

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

## Step 0: Starting state

> The notes jj repo is inited on session start and committed on stop — `ref-jj-notes.md`. No manual init.

No `<notes-dir>/spec.md` → write a minimal one (full template: `ref-write.md` § spec.md template):

- **Frontmatter** — a `---` block with `status: init`, `branch:` (current branch, `git rev-parse --abbrev-ref HEAD`), and `drives:` (one sentence from the user's request). No phase-rules prose in the body — the machine lives in `ref-write.md` § Status.
- **Description** — one sentence from the request. **Goal** — 2–3 plain sentences.
- **Open questions** — seed 1–3 as `thoughts/NNN-question-*.md` notes (`status: open`, template `tpl-note-question.md`). They live in the thought graph, not in `spec.md`; the spec has no Open Questions section. **TODO List** — empty until the grill closes.
- Create `<notes-dir>/GLOSSARY.md` from `references/tpl-glossary.md`, empty.
- Guidelines / What we're NOT doing — empty or "follow language defaults". No `Design Decisions` and no `Open Questions` section: both live in `thoughts/` (`ref-write.md` § Artifacts).

spec.md exists → check the frontmatter `branch` against the current branch (`ref-write.md` § Spec ownership by branch):

- **Shares part** (one contains the other as a substring) → same work; this is iteration, skip to Step 0.5.
- **No shared part** → the spec belongs to unrelated work; author a fresh minimal spec (the bullets above) with `branch` set to the current branch. The prior spec stays in the notes jj history.

## Step 0.5: Ingest explore artifacts

Run every time. Check `<notes-dir>/research/`:

- Empty or missing → skip to Step 1.
- Present → read `INDEX.md` first (else every `.md`). For each concrete finding — observed code behavior, user assertion, flagged gap — write one `NNN-fact-*.md` thought (`source: explore`, template `tpl-note-fact.md`, shared counter from 001). One fact per finding; **before the grill starts**, so decisions can link them. Write each research gap as one `NNN-question-*.md` thought (`source: explore`, `status: open`, template `tpl-note-question.md`) — same directory, same counter. Print: `Ingested explore artifacts: N fact notes, M question notes.`

## Step 1: Grill

Run `/grill-with-docs` until no `status: open` question note is left in `thoughts/` (list them: `~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts`). Every resolution **flips its question note in place** into a `decision` or `fact` note — same `id`, same file, renamed (`ref-note-format.md` § Resolution — flip in place). A new question raised mid-grill gets its own `NNN-question-*.md` note before you answer it; the decision tree **is** the spec — walk it branch by branch. A question the codebase can answer, read instead of ask.

### Exit contract

#### 1. Back-link every thought
Back-fill `Affects` and populate `links` per `ref-note-format.md` § Back-linking.

#### 2. Confirm spec.md reflects every resolution
Every decision is a `thoughts/NNN-decision-*.md` note — **not** a spec section (`spec.md` has no Design Decisions); routine picks land in GLOSSARY.md / scope instead; new out-of-scope items in What we're NOT doing. **No `status: open` question note left** (`~/.claude/scripts/wm-open-questions.sh <notes-dir>/thoughts` exits 0; any open one = NOT READY). Advance the frontmatter `status: init → review`. Self-check against `ref-write.md` § Spec-Readiness Checklist.

#### 3. Compile the plan
Write a `## Plan` at the bottom of spec.md — 3–5 sentences (one per major branch) plus the **wave** table. No decision-trail table: the graph lives in `thoughts/`, and the reader enters it through each TODO's `## Constraints` rows.

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

`new` ends here. It does not write `todos/TODO-N.md`. The spec + thought graph are now
reviewable; the human reviews and runs `/code todo` when satisfied (the gate — `ref-write.md`). Review
surfaces gaps → run `/code new` again to re-grill.

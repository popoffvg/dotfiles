# code — new (the grill loop)

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`.

## Step 0: Starting state

> The notes jj repo is inited on session start and committed on stop — `ref-jj-notes.md`. No manual init.

No `<notes-dir>/spec.md` → write a minimal one (full template: `ref-write.md` § spec.md template):

- **Frontmatter** — a `---` block with `status: init`, `branch:` (current branch, `git rev-parse --abbrev-ref HEAD`), and `drives:` (one sentence from the user's request). No phase-rules prose in the body — the machine lives in `ref-write.md` § Status.
- **Description** — one sentence from the request. **Goal** — 2–3 plain sentences.
- **Open Questions** — seed 1–3 from the request. **TODO List** — empty until the grill closes.
- Create `<notes-dir>/GLOSSARY.md` from `references/tpl-glossary.md`, empty.
- Guidelines / What we're NOT doing / Design Decisions — empty or "follow language defaults".

spec.md exists → check the frontmatter `branch` against the current branch (`ref-write.md` § Spec ownership by branch):

- **Shares part** (one contains the other as a substring) → same work; this is iteration, skip to Step 0.5.
- **No shared part** → the spec belongs to unrelated work; author a fresh minimal spec (the bullets above) with `branch` set to the current branch. The prior spec stays in the notes jj history.

## Step 0.5: Ingest explore artifacts

Run every time. Check `<notes-dir>/research/`:

- Empty or missing → skip to Step 1.
- Present → read `INDEX.md` first (else every `.md`). For each concrete finding — observed code behavior, user assertion, flagged gap — write one `NNN-fact-*.md` thought (`source: explore`, template `tpl-note-fact.md`, shared counter from 001). One fact per finding; **before the grill starts**, so decisions can link them. Seed each research gap into Open Questions, prefixed `[from explore]`. Print: `Ingested explore artifacts: N fact notes, M open questions.`

## Step 1: Grill

Run `/grill-with-docs` until Open Questions is empty. Every resolution writes one thought (`ref-note-format.md`); the decision tree **is** the spec — walk it branch by branch. A question the codebase can answer, read instead of ask. 

### Exit contract

#### 1. Back-link every thought
Back-fill `Affects` and populate `links` per `ref-note-format.md` § Back-linking.

#### 2. Confirm spec.md reflects every resolution
Each decision is in Design Decisions (or, if routine, in GLOSSARY.md / scope); new out-of-scope items in What we're NOT doing; **Open Questions empty** (any surviving `- [ ]` = NOT READY). Advance the frontmatter `status: init → review`. Self-check against `ref-write.md` § Spec-Readiness Checklist.

#### 3. Compile the plan
Write a `## Plan` at the bottom of spec.md — 3–5 sentences (one per major branch) plus the **trace** table:

```markdown
### Plan

<target-picture summary, one sentence per branch>

### Decision trail
| # | Note | Decision | Constrained by | Affects |
|---|------|----------|----------------|---------|
| 001 | [[001-fact-token-ttl]] | *(fact)* | — | 003 |
| 003 | [[003-decision-single-flight]] | Reject concurrent refreshes with 409 | [[001-fact-token-ttl]] | — |
```

The Plan is the reader's entry point: start there, follow `Depends on` backward and `Affects` forward, reconstruct the whole tree without reopening the conversation.

### Step 2. Commit + report
`jj commit -m "<what was grilled, decisions added, questions closed, note count>"` in `<notes-dir>`. Then print: shared-understanding summary (2–3 sentences), note count (N decisions, M facts), the decision-trail table, remaining unknowns (none for READY), and the next action — **review the spec, then `/code todo`**.

## Stop at the gate

`new` ends here. It does not write `todos/TODO-N.md`. The spec + thought graph are now
reviewable; the human reviews and runs `/code todo` when satisfied (the gate — `ref-write.md`). Review
surfaces gaps → run `/code new` again to re-grill.

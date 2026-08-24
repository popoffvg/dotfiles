# code — fix

Fix the **thought** first, then the code. Code changed without correcting the thought drifts back; a thought corrected without touching the code is philosophy.

Obeys the shared subcommand rules — see `code:ref-subcommand-rules.md`. Commit rules: `sub-commit.md`; the message itself: the `commit-message` skill.

The user points at a gap — a **bug** (behavior wrong), a **missing part** (behavior absent), or an **adjust** (behavior works but should change). The loop: locate the thought → mark or add it → write the correct one → fix the code.

## Trigger kinds

| Kind | What the user points at | Thought action |
|---|---|---|
| **bug** | broken behavior — output wrong, crash, regression | a thought is **wrong** → supersede + replace |
| **missing** | something never built — a case unhandled, a step skipped | a thought is **missing** → add new |
| **adjust** | working behavior that should differ — new requirement, changed decision | a thought is **outdated** → supersede + replace |

`bug` and `adjust` share the loop (supersede old, write replacement); `missing` skips the supersede, straight to a new note.

**A thought can be absent (code-only drift).** When the gap traces to no thought change — the thought is correct and only the code diverged (typo, off-by-one, a branch that doesn't match the decision it cites) — skip Steps 2–3, go to Step 4. Report: *"no thought change — code diverged from a correct thought."*

## Contract

- **Start at the thought.** Every fix opens with: *"Mark an existing thought wrong/outdated, add a new one, or is the thought already correct (code-only drift)?"* Rule the correct-thought case out before touching code.
- **One thought per fix.** Multiple affected thoughts → one `/code fix` each, in sequence.
- Correct the thought (or confirm it's already right) before changing code. A code change over a standing wrong thought is deferred drift.

## Step 1: Analyze the cause

Before touching code, answer three, one sentence each:

1. **What's the gap?** — observable symptom (bug), absent behavior (missing), or desired change (adjust).
2. **Which thought is involved?** — the decision/fact/impl-decision note that's wrong, outdated, or absent. Read the notes linked from the relevant TODO.
3. **What should the thought say instead?** — the corrected or new version.

No existing thought covers the gap (always for **missing**, sometimes **adjust**) → the cause is a missing thought; write a new one, skip Step 2.

### Finding the wrong thought

Note layout and filenames: `arch:ref-note-format.md`. **Start at `TODO-N.trace.md`** — it is the row's only index of origins, and it is built for exactly this walk: find the anchor covering the gap (`Constraints: C<n>`, a `## Surface` symbol, an `Autotest` level, an increment number), and its `Origin` is the note to open. Follow that note's `Depends on` backward from there.

When the trace does not name the culprit, search the metadata rather than reading the
directory: `~/.claude/scripts/wm-thought-index.py <notes-dir>/thoughts -m '<terms of the gap>'`
prints each note's `description`, and the descriptions say which notes could hold the wrong answer
(`arch:ref-note-format.md` § Finding the thought for your task). Open those, not the rest.

- Which fact was wrong? (e.g. "Token TTL is 15 min" but the code uses 5 min)
- Which decision was wrong? (e.g. "Reject concurrent refreshes" but they should be queued)
- Which impl choice was wrong? (e.g. "Use sync.Mutex" but the code spans goroutines)

Show the user: *"Found it: `003-decision-single-flight.md` is wrong because X. The correction is Y."* Wait for confirmation.

## Step 2: Mark the wrong thought

On confirmation, mark the wrong note superseded — same frontmatter keys as every other supersede
(`arch:ref-note-format.md` § Superseding), plus the reason as the first body line:

```markdown
---
status: declined
superseded_by: "NNN"
---

# <original title>

Superseded by [[NNN-type-slug]] — <one-line reason this thought is wrong>
```

- Keep the original content below — the history is the audit trail.
- `superseded_by` points to the replacement (filled after Step 3).
- **Do not move the file.** The `thoughts-archive.sh` hook takes it to `thoughts/archived/` on the
  next tool call, filename unchanged, and prints the live notes whose wikilinks you still owe a
  repoint at the replacement.
- Commit in `<notes-dir>`: `fix: superseded NNN-<type>-<slug>`.

## Step 3: Write the corrected thought

Write a new note to `thoughts/` at the next counter `NNN`, same type as the original (`decision` / `fact` / `impl-decision`). Templates and format: `arch:ref-note-format.md`.

Links:

- **Depends on**: the superseded note, annotated *"supersedes [[NNN-old-slug]] — <why>"*.
- **Affects**: back-filled at loop end per `arch:ref-note-format.md` § Back-linking.

Frontmatter marks it a replacement:

```yaml
replaces: "NNN-old-slug"
```

Then **repoint the trace**: every `TODO-N.trace.md` row citing `NNN-old-slug` now cites the
replacement, in every TODO that cites it — not only the one this fix started from. The old note is
about to leave `thoughts/`, and a row pointing into `archived/` is a TODO obeying a decision that no
longer stands. A gap that needed a *new* thought (the **missing** kind) earns a new row instead,
anchored where the corrected behavior lands.

Commit: `fix: add NNN-<type>-<slug> as replacement for NNN-old-slug`.

## Step 4: Fix the code

With the thought corrected:

1. Read the corrected and superseded notes — understand what changed.
2. Find the files from `todos/TODO-N.agent.md` **Files**.
3. Make the minimal change aligning code with the corrected thought.
4. If the fix renames or introduces a domain term, update `<notes-dir>/GLOSSARY.md` in the same commit.
5. Run the TODO's Autotest (or write one that proves the fix).
6. Commit: `fix: <subject> — corrects NNN-old-slug with NNN-new-slug`.

## Step 5: Report

In `<notes-dir>`:

```
jj commit -m "[FIX:<kind>] <one-line gap>
  - thought: NNN-old-slug superseded (reason: <reason>) | none (missing) | none (code-only drift)
  - corrected/new thought: NNN-new-slug | none
  - trace rows repointed: TODO-N (C2), TODO-M (Outcome) | none
  - commit: <sha>
  - autotest: pass | fail (details)"
```

`<kind>` is `bug`, `missing`, or `adjust`. Send the user:

1. **Gap**: one-line symptom / absent behavior / desired change (with kind)
2. **Old thought**: NNN-old-slug — superseded (reason), or *none* (missing / code-only drift)
3. **Corrected/new thought**: NNN-new-slug — what changed or adds, or *none* (code-only drift)
4. **Commit**: sha + subject
5. **Autotest**: command + outcome

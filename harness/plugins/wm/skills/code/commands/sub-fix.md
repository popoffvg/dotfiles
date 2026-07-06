# code — fix

Fix the **thought** first, then the code. Code changed without correcting the thought drifts back; a thought corrected without touching the code is philosophy.

Obeys the shared subcommand rules — see `ref-subcommand-rules.md`. Commit conventions: `sub-commit.md`.

The user points at a gap — a **bug** (behavior wrong), a **missing part** (behavior absent), or an **adjust** (behavior works but should change). The loop: locate the thought → mark or add it → write the correct one → fix the code.

## Trigger kinds

| Kind | What the user points at | Thought action |
|---|---|---|
| **bug** | broken behavior — output wrong, crash, regression | a thought is **wrong** → deprecate + replace |
| **missing** | something never built — a case unhandled, a step skipped | a thought is **missing** → add new |
| **adjust** | working behavior that should differ — new requirement, changed decision | a thought is **outdated** → deprecate + replace |

`bug` and `adjust` share the loop (deprecate old, write replacement); `missing` skips deprecation, straight to a new note.

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

Note layout and filenames: `ref-note-format.md`. Walk the thought graph from the TODO's `## Changes`:

- Which fact was wrong? (e.g. "Token TTL is 15 min" but the code uses 5 min)
- Which decision was wrong? (e.g. "Reject concurrent refreshes" but they should be queued)
- Which impl choice was wrong? (e.g. "Use sync.Mutex" but the code spans goroutines)

Show the user: *"Found it: `003-decision-single-flight.md` is wrong because X. The correction is Y."* Wait for confirmation.

## Step 2: Mark the wrong thought

On confirmation, prepend a deprecation block to the wrong note:

```markdown
---
deprecated: true
deprecated_by: "NNN"
deprecation_reason: "<one-line reason this thought is wrong>"
---

# <original title>
```

- Keep the original content — the history is the audit trail.
- `deprecated_by` points to the replacement (filled after Step 3).
- Commit in `<notes-dir>`: `fix: deprecated NNN-<type>-<slug>`.

## Step 3: Write the corrected thought

Write a new note to `thoughts/` at the next counter `NNN`, same type as the original (`decision` / `fact` / `impl-decision`). Templates and format: `ref-note-format.md`.

Links:

- **Depends on**: the deprecated note, annotated *"supersedes [[NNN-old-slug]] — <why>"*.
- **Affects**: back-filled at loop end per `ref-note-format.md` § Back-linking.

Frontmatter marks it a replacement:

```yaml
replaces: "NNN-old-slug"
```

Commit: `fix: add NNN-<type>-<slug> as replacement for NNN-old-slug`.

## Step 4: Fix the code

With the thought corrected:

1. Read the corrected and deprecated notes — understand what changed.
2. Find the files from `todos/TODO-N.md` **Files**.
3. Make the minimal change aligning code with the corrected thought.
4. If the fix renames or introduces a domain term, update `<notes-dir>/GLOSSARY.md` in the same commit.
5. Run the TODO's Autotest (or write one that proves the fix).
6. Commit: `fix: <subject> — corrects NNN-old-slug with NNN-new-slug`.

## Step 5: Report

In `<notes-dir>`:

```
jj commit -m "[FIX:<kind>] <one-line gap>
  - thought: NNN-old-slug deprecated (reason: <reason>) | none (missing) | none (code-only drift)
  - corrected/new thought: NNN-new-slug | none
  - commit: <sha>
  - autotest: pass | fail (details)"
```

`<kind>` is `bug`, `missing`, or `adjust`. Send the user:

1. **Gap**: one-line symptom / absent behavior / desired change (with kind)
2. **Old thought**: NNN-old-slug — deprecated (reason), or *none* (missing / code-only drift)
3. **Corrected/new thought**: NNN-new-slug — what changed or adds, or *none* (code-only drift)
4. **Commit**: sha + subject
5. **Autotest**: command + outcome

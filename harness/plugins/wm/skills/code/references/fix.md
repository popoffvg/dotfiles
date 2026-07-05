# code — fix

Make the code match intent. The user points at a gap — a **bug** (behavior is wrong),
a **missing part** (behavior is absent), or an **adjustment** (behavior works but should
change). Every gap traces to a thought in `thoughts/`: wrong, missing, or due for revision.
The fix loop: locate the thought → mark or add it → write the correct one → fix the code.

## Trigger kinds

| Kind | What the user points at | Thought action |
|---|---|---|
| **bug** | broken behavior — output wrong, crash, regression | a thought is **wrong** → deprecate + replace |
| **missing** | something never built — a case unhandled, a step skipped | a thought is **missing** → add new |
| **adjust** | working behavior that should differ — new requirement, changed decision | a thought is **outdated** → deprecate + replace |

`bug` and `adjust` follow the same loop (deprecate the old thought, write the replacement);
`missing` skips the deprecation step and goes straight to a new note.

**A thought can be absent.** When the gap doesn't trace to any thought change — the thought
is already correct and only the code drifted from it (typo, off-by-one, a branch that doesn't
match the decision it cites) — there is no thought to mark or add. Skip Steps 2–3 and go
straight to Step 4. Report it explicitly: *"no thought change — code diverged from a correct thought."*

## Contract

- **Start at the thought.** Every fix session starts by asking: *"Should I mark an existing
  thought as wrong/outdated, add a new one, or is the thought already correct (code-only drift)?"*
  Never skip this question. A correct thought needs no change — but you must rule it out first.
- **One thought per fix.** If multiple thoughts are affected, fix them one at a time — each gets
  its own `/code fix` invocation.
- **Fix the thought first, then the code.** Code changed without correcting the thought will
  drift back. A thought corrected without fixing the code is philosophy.

## Step 1: Analyze the cause

Before touching code, identify what the gap traces to. Answer three questions:

1. **What's the gap?** — the observable symptom (bug), the absent behavior (missing), or
   the desired change (adjust). One sentence.
2. **Which thought is involved?** — the specific decision/fact/impl-decision note in
   `thoughts/` that's wrong, outdated, or absent. Read the notes linked from the relevant TODO.
3. **What should the thought say instead?** — the corrected or new version. One sentence.

If no existing thought covers the gap (always true for **missing**, sometimes for **adjust**),
the cause is a **missing thought** — write a new one and skip Step 2.

### Finding the wrong thought

```
thoughts/
  NNN-decision-<slug>.md   ← decisions that shaped the code
  NNN-fact-<slug>.md       ← facts the decisions depend on
  NNN-impl-decision-*.md   ← implementation choices made during TODO writing
```

Walk the thought graph from the TODO's `## Changes`:
- Which fact was wrong? (e.g., "Token TTL is 15 min" but the code uses 5 min)
- Which decision was wrong? (e.g., "Reject concurrent refreshes" but the bug is that
  concurrent refreshes should be queued, not rejected)
- Which implementation choice was wrong? (e.g., "Use sync.Mutex" but the code spans goroutines)

Show the user: *"Found it: `003-decision-single-flight.md` is wrong because X. The correction
is Y."* Wait for confirmation before proceeding.

## Step 2: Mark the wrong thought

When the user confirms, open the wrong note and **prepend** a deprecation block:

```markdown
---
deprecated: true
deprecated_by: "NNN"
deprecation_reason: "<one-line reason this thought is wrong>"
---

# <original title>
```

- Do not delete the original content — the history is the audit trail.
- `deprecated_by` points to the replacement note (filled after Step 3).
- Push the note to git (commit in `.notes/` repo): `fix: deprecated NNN-<type>-<slug>`

## Step 3: Write the corrected thought

Write a new note to `thoughts/` using the next available counter `NNN`:

- If the original was a **decision** → write a new decision note (`NNN-decision-<slug>.md`).
  Template: [`note-template-decision.md`](note-template-decision.md).
- If the original was a **fact** → write a new fact note (`NNN-fact-<slug>.md`).
  Template: [`note-template-fact.md`](note-template-fact.md).
- If the original was an **impl-decision** → write a new impl-decision note
  (`NNN-impl-decision-<slug>.md`). Template: [`note-template-impl-decision.md`](note-template-impl-decision.md).

### Required links

- **Depends on**: link to the deprecated note with annotation: *"supersedes [[NNN-old-slug]] — <why>"*
- **Affects**: the replacement will be back-filled at loop end (same as `new` exit contract).

Mark the new note as a **replacement** in frontmatter:

```yaml
replaces: "NNN-old-slug"
```

Commit: `fix: add NNN-<type>-<slug> as replacement for NNN-old-slug`

## Step 4: Fix the code

Now that the thought is corrected, fix the code to match:

1. Read the corrected thought and the deprecated one — understand what changed.
2. Find the files the TODO touched (from `todos/TODO-N.md` **Files** section).
3. Make the minimal change that aligns the code with the corrected thought.
4. If the fix renames or introduces a domain term, update `<notes-dir>/GLOSSARY.md` in the same commit.
5. Run the Autotest from the TODO (or write a new one that proves the fix).
6. Commit with a message referencing both notes:
   ```
   fix: <subject> — corrects NNN-old-slug with NNN-new-slug
   ```

## Step 5: Report

Run, in `<notes-dir>`:

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
3. **Corrected/new thought**: NNN-new-slug — what changed or what it adds, or *none* (code-only drift)
4. **Commit**: sha + subject
5. **Autotest**: command + outcome

## Hard rules

- Never change code while a thought that contradicts it stands. Either correct the thought, or
  confirm the thought is already right and the code merely drifted from it. A code change that
  leaves a wrong thought in place is deferred drift.
- Never delete a thought — deprecate it. The history of wrong/outdated decisions is as valuable
  as the history of right ones.
- One thought per `/code fix`. If the gap spans multiple thoughts, fix them in sequence —
  each invocation corrects one thought and its code.
- Always ask: "Should I mark an existing thought as wrong/outdated, add a new one, or is it
  already correct?" before starting.
- For **missing** (and **adjust** with no existing thought), skip Step 2 and go straight to
  writing a new note. When the thought is already correct (code-only drift), skip Steps 2–3
  and go straight to Step 4.

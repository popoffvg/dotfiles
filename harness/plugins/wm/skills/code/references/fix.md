# code — fix

Fix broken behavior. Bugs exist because a thought (decision or fact) in `spec-notes/`
is wrong. The fix loop: find the wrong thought → mark it → write the correct one → fix the code.

## Contract

- **Thoughts are mandatory.** Every fix session starts by asking: *"Should I mark an existing
  thought as wrong, or add a new one?"* Never skip this question.
- **One thought per fix.** If multiple thoughts are wrong, fix them one at a time — each gets
  its own `/code fix` invocation.
- **Fix the thought first, then the code.** A bug fixed without correcting the thought will
  recur. A thought corrected without fixing the code is philosophy.

## Step 1: Analyze the cause

Before touching code, identify the root cause. Answer three questions:

1. **What broke?** — the observable symptom. One sentence.
2. **Which thought is wrong?** — the specific decision or fact note in `spec-notes/` that
   enabled the bug. Read `spec-notes/` notes linked from the relevant TODO.
3. **What should the thought say instead?** — the corrected version. One sentence.

If no existing thought explains the bug, the cause is a **missing thought** — write a new one.

### Finding the wrong thought

```
spec-notes/
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

Write a new note to `spec-notes/` using the next available counter `NNN`:

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
4. Run the Autotest from the TODO (or write a new one that proves the fix).
5. Commit with a message referencing both notes:
   ```
   fix: <subject> — corrects NNN-old-slug with NNN-new-slug
   ```

## Step 5: Report

Append to `<notes-dir>/worklog.md`:

```
- YYYY-MM-DD HH:MM: [FIX] <one-line symptom>
  - wrong thought: NNN-old-slug deprecated (reason: <reason>)
  - corrected thought: NNN-new-slug
  - commit: <sha>
  - autotest: pass | fail (details)
```

Send the user:
1. **Bug**: one-line symptom
2. **Wrong thought**: NNN-old-slug — deprecated (reason)
3. **Corrected thought**: NNN-new-slug — what changed
4. **Commit**: sha + subject
5. **Autotest**: command + outcome

## Hard rules

- Never fix code without fixing the thought. A thoughtless fix is a deferred bug.
- Never delete a thought — deprecate it. The history of wrong decisions is as valuable as
  the history of right ones.
- One thought per `/code fix`. If the bug spans multiple wrong thoughts, fix them in sequence —
  each invocation corrects one thought and its code.
- Always ask: "Should I mark an existing thought as wrong, or add a new one?" before starting.
- If no existing thought is wrong (missing thought case), skip Step 2 and go straight to
  writing a new note.

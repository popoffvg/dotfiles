---
name: name-the-cause-of-every-golden-diff
description: Use when a golden / snapshot / approval / fixture-capture file moves as part of a change and is about to be regenerated or accepted — `--snapshot-update`, `-update`, `pytest --force-regen`, `jest -u`, `cargo insta accept`, or a hand-run "regenerate the expected output" script. Also fires when reviewing a diff that contains both source edits and a regenerated capture. Regenerating makes the test green whether the movement was intended or not, so each moved field needs a cause named in the task before the new capture is accepted — and a capture cited as evidence for a case needs a row that actually exercises that case.
metadata:
  origin: self-improvement
---

# Every moved cell in a regenerated capture needs a named cause

A golden file is the only test that can catch an unintended output change — and regenerating
it is exactly how that catch is discarded. The suite goes green either way, so "tests pass
after regen" is not evidence; it is the absence of evidence.

## Procedure

1. **Read the old capture from the ref, not from memory.**
   `git show <pre-change-ref>:<path/to/golden> > /tmp/old && diff /tmp/old <path/to/golden>`
   Use the commit before the change, not `HEAD`, once the regen is already committed.
2. **Enumerate what moved, per field or column** — not per file. A whole-file "regenerated"
   note hides a single column that changed meaning across every row.
3. **Match each movement to a line in the task** that asked for it. A movement no increment,
   spec section, or test case names is a finding: the change altered an output contract nobody
   requested.
4. **On an unnamed movement, fix the source and regenerate back** to the old value. Do not
   accept the new capture and note the difference for later — the note is not enforced and the
   capture now certifies the wrong output.
5. **A capture proves only what its rows contain.** Before citing a golden as evidence for a
   claim about a combined or multi-value case, check that a row actually exercises it —
   `cut -f<n> <golden> | sort -u` on the column in question. When no row does, the claim is
   unverified: add a parent/input that produces such a row, or say so instead of implying the
   capture covers it.
6. **When part of the output is deliberately frozen** ("this mode's files stay byte-identical",
   "this column belongs to a later task"), assert the byte-identity for that part explicitly
   rather than relying on a reviewer to spot its rows in the diff.

## The shape that gets through review

The commonest form is a column whose *values* change while its name, width, and row count
stay put: a per-item name replaced by the mode or run label that produced it, an id replaced by
a display string, a unit rescaled. The diff looks like noise from the regeneration, every row
moves identically so no row stands out, and the field still validates. Only the old-vs-new
comparison of that one column shows it.

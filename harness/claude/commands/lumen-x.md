---
allowed-tools: Bash(~/.claude/scripts/lumen-x-pr-diff.sh:*), Bash(~/.claude/scripts/lumen-pane.sh:*), Bash(~/.claude/scripts/prx-diff-line-check.py:*), Read, Grep
description: Triage a big PR — check the mechanical propagation exhaustively, then open only the decision files in lumen
---

Split a pull request into the files that repeat one mechanical edit and the files
that carry a decision. Machine-check the mechanical class; give the reviewer only
the decision class.

Target: `$ARGUMENTS` (a PR number, a PR URL, or empty for the current branch's PR).

## Steps

1. Save the diff and read the file index:

   ```bash
   ~/.claude/scripts/lumen-x-pr-diff.sh $ARGUMENTS
   ```

   Keep the printed PR number and diff path. Read the diff file in slices — never
   paste it back to the user.

2. Classify every file into one of two classes.

   **Propagation** — every hunk in the file repeats the same edit shape, and the
   file gains no new branch, condition, computed value, or error path. Typical
   shapes: an argument added at each call site, a symbol renamed, an import
   updated, a new interface method with a body that only delegates, a mock or
   test double re-signed, generated or lock files.

   **Decision** — anything else: new or changed logic, a new default or fallback
   value, a changed condition, error handling, concurrency, a schema or wire
   change, a public API shape, a deleted check.

   A file that does not clearly fit Propagation is Decision. Misfiling a
   decision as mechanical hides it from review; the reverse only costs reading.

3. Check the Propagation class exhaustively — this is the part that replaces
   reading it. For each propagated change, verify with Grep over the repo, not by
   eye, and report only what fails:

   - a call site, interface implementation, or overload that was **not** updated;
   - a site passing a default, zero, `nil`, `None`, or empty value where its
     sibling sites pass a real one — name the odd site and its neighbours;
   - a renamed symbol still referenced under the old name, including in strings,
     configs, and docs;
   - a signature change with no matching update in tests, mocks, or fakes;
   - a value threaded through but never read at the far end (dead parameter).

   State the check that was run for each claim. A propagation file with no
   finding gets one line: path plus `checked: <what was verified>`.

4. Report before opening anything: the Decision list with a one-line reason per
   file, then the Propagation list with its per-file verdict, then the count of
   files the reviewer no longer has to read.

5. Open lumen on the Decision files **plus** any Propagation file that produced
   an anomaly. Run it in the background — it blocks until the viewer closes:

   ```bash
   ~/.claude/scripts/lumen-pane.sh --wait lumen-x --pr <number> --file <path> --file <path> ...
   ```

   Say one line — the pane is open, `i` annotates, `s` then Enter exits and sends
   the annotations. Then stop and wait for the script to finish.

   With no Decision file and no anomaly, say so and open nothing.

6. When it finishes, print the annotations under `--- annotations ---`. Append
   each one to the prx collection as `- <path>:<line> — <body>` (the `prx` skill
   owns that file and its format), then validate the placement against the saved
   diff:

   ```bash
   ~/.claude/scripts/prx-diff-line-check.py <diff-path> ~/.claude/prx/comments.md
   ```

   Report any `NOT_IN_DIFF` line, then tell the user to run `/prx post`.

`no annotations` means the viewer was closed with `q`. Say so and stop.

Ask before changing any code — this command reviews, it does not fix.

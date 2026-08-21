---
allowed-tools: Bash(~/.claude/scripts/lumen-x-diff.sh:*), Bash(~/.claude/scripts/lumen-x-diff-slice.sh:*), Bash(~/.claude/scripts/lumen-x-open.sh:*), Bash(~/.claude/scripts/prx-diff-line-check.py:*), Agent, Read, Grep, Write
description: Triage a big change — PR or local — by checking the mechanical propagation exhaustively, then opening only the decision files in lumen
---

Split a change into the files that repeat one mechanical edit and the files that
carry a decision. Machine-check the mechanical class; give the reviewer only
the decision class.

Target: `$ARGUMENTS` — empty for the uncommitted tree, a range like `main...HEAD`,
`--pr` for the current branch's PR, or a PR number or URL. Review work is the same
work whichever it is; only what lumen is pointed at differs.

Reading hunks and running the repo-wide greps is bounded read-and-report work, so
it goes to **haiku subagents** (`general-purpose`, `model: haiku`) fanned out in
parallel — one message, several `Agent` calls. Keep for yourself only what they
cannot do: choosing the batches, merging their verdicts, re-checking each finding,
and driving lumen. Never read the diff yourself.

## Steps

1. Save the diff and read the file index:

   ```bash
   ~/.claude/scripts/lumen-x-diff.sh $ARGUMENTS
   ```

   Keep the printed slug and diff path — the slug names every other file of this
   review. The index — path plus added/removed counts — is the only part of the diff
   you read. Never paste the diff back to the user. Relay a `note:` line about
   untracked files: those files are in nobody's diff and so in nobody's review.

2. Define the two classes. Both agent passes below quote these definitions
   **verbatim**; do not paraphrase them into a prompt.

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

3. **Classify pass** — batch the index into groups of at most 8 paths, grouping
   by directory so a batch shares context, and spawn one haiku subagent per
   batch, all in one message. Give each agent its own paths, the diff path, the
   two definitions, and this instruction:

   > Read only your own files' hunks:
   > `~/.claude/scripts/lumen-x-diff-slice.sh <diff-path> <path>...`
   > Classify each path against the definitions above. Do not grep the repo, do
   > not read the wider codebase, do not judge whether the change is correct.
   > Return one line per path and nothing else:
   > `<path> | propagation|decision | <edit-shape in 3-6 words> | <reason in one line>`
   > The edit-shape names the repeated edit for a propagation file (`arg added to
   > NewFoo calls`, `Bar renamed to Baz`); for a decision file it names what
   > carries the decision.

   A file whose slice command errors, or that an agent omits, is Decision.

4. Merge their lines yourself. Decision files go on the reviewer's list.
   Propagation files group **by edit-shape** — same shape, one group, however
   many files.

5. **Verify pass** — spawn one haiku subagent per propagation group, all in one
   message, since a propagation defect is cross-file and only shows up when the
   whole group is checked together. Give each agent the shape, its file list, the
   diff path, and this instruction:

   > Check this propagation exhaustively with `Grep` over the repo — by search,
   > never by eye. Slice the hunks with
   > `~/.claude/scripts/lumen-x-diff-slice.sh <diff-path> <path>...`, then hunt:
   > - a call site, interface implementation, or overload **not** updated;
   > - a site passing a default, zero, `nil`, `None`, or empty value where its
   >   sibling sites pass a real one — name the odd site and its neighbours;
   > - a renamed symbol still referenced under the old name, including in
   >   strings, configs, and docs;
   > - a signature change with no matching update in tests, mocks, or fakes;
   > - a value threaded through but never read at the far end (dead parameter).
   >
   > Report only failures, each as `<path>:<line> | <what is wrong> | grep: <the
   > exact pattern you ran>`. Then one final line: `checked: <the searches you
   > ran>`. Claim nothing you did not run a search for; say `no findings` when
   > the searches came back clean.

6. **Re-check every finding before relaying it.** Run the agent's own grep
   pattern yourself for each reported anomaly, and drop — not soften — any
   finding the search does not support. A cheap agent's counts and line numbers
   are the part that goes wrong; its prose can be right while its arithmetic is
   not.

7. Write the selection — the Decision files **plus** every propagation file whose
   anomaly survived step 6 — to the step-1 diff path with `.diff` swapped for
   `.files` (`Write` does not expand `$TMPDIR`, so use the printed absolute path),
   one path per line, each with its reason as a trailing `#` comment. That name is
   where step 8 looks for it. The file is the review artifact: it is what the user
   edits to drop or add a file, and re-running step 8 picks the edit up.

   ```
   # lumen-x pr-123 — 2 of 34 files carry a decision
   src/pay/charge.go   # decision: new fallback when the token is missing
   src/pay/refund.go   # anomaly: refund_test.go not re-signed
   ```

   Then report against it: the Decision list with its one-line reasons, the
   propagation groups with each group's shape and verdict (a clean group is one
   line: shape, file count, `checked: <what was verified>`), the count of files
   the reviewer no longer has to read, and the list file's path.

8. Open lumen on that list. Run it in the background — it blocks until the viewer
   closes:

   ```bash
   ~/.claude/scripts/lumen-x-open.sh --wait <slug>
   ```

   The slug carries the reference step 1 resolved, so pass nothing else. One
   exception: a PR review opens as `--pr <number>`, which makes lumen shell out to
   `gh` and fail with "Could not resolve to a Repository" whenever the active
   account cannot see a private org repo. When the branch is checked out, run from
   that worktree and add `--ref main...<branch>` — a local range needs no network
   and no account.

   Say one line — the pane is open, `i` annotates, `s` then Enter exits and sends
   the annotations. Then stop and wait for the script to finish.

   With no Decision file and no anomaly, write the list with its header comment
   and no paths, say so, and open nothing — the script refuses an empty list.

9. When it finishes, print the annotations under `--- annotations ---`. What happens
   to them depends on who the review is for, which is what the target already told
   you:

   **A PR** — the annotations are comments for its author. Append each one to the
   prx collection as `- <path>:<line> — <body>` (the `prx` skill owns that file and
   its format), then validate the placement against the saved diff:

   ```bash
   ~/.claude/scripts/prx-diff-line-check.py <diff-path> ~/.claude/prx/comments.md
   ```

   Report any `NOT_IN_DIFF` line, then tell the user to run `/prx post`.

   **The uncommitted tree or a local range** — there is nothing to post to. Treat
   each annotation as a task on that file and line, the way `/lumen` does, and ask
   before changing anything the annotation does not state plainly.

`no annotations` means the viewer was closed with `q`. Say so and stop.

Never change code on your own initiative: a PR annotation leaves as a comment, and a
local one waits for the user to confirm the task.

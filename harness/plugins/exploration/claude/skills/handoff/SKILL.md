---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save it as an in-memory tmp file at `$TMPDIR/claude-handoff/<short-slug>.md` (create the directory if missing). On macOS `$TMPDIR` is a per-user tmpfs-style location — fast, ephemeral, survives until reboot.

Before writing, list `$TMPDIR/claude-handoff/` and read any existing file with the same slug — extend it rather than overwriting. Print the absolute path of the saved file at the end so the next session can `Read` it directly.

### How to create the file

1. Resolve the path with Bash, stripping any trailing slash from `$TMPDIR` (macOS leaves one, producing `//` otherwise):
   ```bash
   DIR="${TMPDIR%/}/claude-handoff" && mkdir -p "$DIR" && echo "$DIR/<slug>.md"
   ```
2. Check for an existing handoff with the same slug:
   ```bash
   ls "${TMPDIR%/}/claude-handoff/" 2>/dev/null
   ```
   If `<slug>.md` exists, write to the another file with a different name (e.g. `<slug>-<label>.md`).
3. Use the `Write` tool with the absolute path from step 1 (not the `$TMPDIR` literal — `Write` does not expand shell variables).
4. Print the final absolute path back to the user.

Required structure:
- **Goal** — what the next session should accomplish
- **State** — what's done, what's in progress (reference commits/PRs/files by path, don't restate diffs)
- **Next steps** — concrete first actions
- **Open questions / risks**
- **Suggested skills** — skills the next session should invoke

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

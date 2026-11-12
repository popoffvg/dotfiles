---
name: annotate
description: Open the last reply, an earlier reply, or a markdown file in the Zed window on screen, so the operator writes notes into it as plain edits or as line comments, then act on each note when the tab closes. Use for "/annotate", "/annotate 3", "/annotate docs/plan.md", "let me comment on your reply", "annotate that in zed".
allowed-tools: Bash(~/.claude/scripts/open-file.sh:*), Bash(~/.claude/scripts/zed-focus-agent.sh:*), Bash(line-comment-lsp:*), Bash(diff:*), Bash(cp:*), Bash(mkdir:*), Bash(rm:*)
---

# annotate

Host: !`~/.claude/scripts/open-file.sh --host`

**Every note counts, in either form.** A plain edit is a note: a line the operator adds is a comment on the part above it, a line they delete is "delete this", and a line they change is the text they want. A line comment of the `line-comment` server is a note on the lines it covers. The diff against an untouched copy finds the edits, and `line-comment-lsp list` finds the comments.

**The file lives in the Zed project.** The line-comment server serves only files under its workspace root, so a file in the scratchpad gets no comment action and no close event.

## Steps

1. **Pick the text.** Done when you hold the text and a short label for it.

   | Request | Text | Label |
   | --- | --- | --- |
   | `/annotate` | your last reply to the operator, verbatim | `reply` |
   | `/annotate N` | your reply N back; 1 is the last one | `reply-N` |
   | `/annotate <path>` | the file at that path | the file name without `.md` |

   Copy a reply exactly as you sent it, with no tool output and no `triage:` line. A path that does not exist: say so in one line and stop.

2. **Write two files** in `<root>/.tmp/annotate/`, where `<root>` is what `line-comment-lsp root` prints: `<label>.md`, which the operator edits, and `<label>.orig.md`, which nobody edits. For a path, `cp` the file to both; the original file stays as it is. Done when both files hold the same text.

3. **Open the edit file.** Run `~/.claude/scripts/open-file.sh <edit file>` with `dangerouslyDisableSandbox: true`: inside the sandbox Zed fails with `Unknown Mach error: 44c`. When Host is `zed`, then run `line-comment-lsp wait-close <edit file> && ~/.claude/scripts/zed-focus-agent.sh` with Bash `run_in_background: true` and `dangerouslyDisableSandbox: true`. The close of the tab ends the task, which starts your next turn. Do not use `zed --wait`: it can return while the tab is still open. When `wait-close` fails at once with "does not serve", or Host is not `zed`, wait for the operator to say they are done. Done when you told the operator, in at most three lines, the path and how to write a note: edit the text or add a line comment, then close the tab to send.

4. **Read the notes** when the tab closes or the operator says they are done. Run `diff -U2 <orig file> <edit file>` for the edits, and `line-comment-lsp list` for the comments; keep only the comments on `.tmp/annotate/<label>.md`. Done when you hold one note per hunk and one per comment, each with the lines it is on.

   No hunk and no comment means no notes: say so in one line, delete both files, and stop.

5. **Act on the notes** as if the operator sent them as one prompt. Answer each note under a quote of the part it is on: a question gets an answer, a "delete this" or a rewrite of your reply changes your position or your next output, and a note on a file changes that file when the operator asked for a change. Drop the comments with `line-comment-lsp drop <file>:<line>...`, and delete both files. Done when every note has an answer or a change, and no comment and no file of `<label>` is left.

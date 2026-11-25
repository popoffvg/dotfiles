---
name: annotate
description: Open the last reply, an earlier reply, or a markdown file in the Zed window on screen, so the operator writes notes into it as plain edits or as line comments, then act on each note when the tab closes. Use for "/annotate", "/annotate 3", "/annotate docs/plan.md", "let me comment on your reply", "annotate that in zed".
allowed-tools: Skill, Bash(~/.claude/scripts/open-file.sh:*), Bash(~/.claude/scripts/zed-focus-agent.sh:*), Bash(~/.claude/scripts/mized-mcp.sh:*), Bash(line-comment-lsp:*), Bash(diff:*), Bash(cp:*), Bash(mkdir:*), Bash(mktemp:*), Bash(rm:*)
---

# annotate

Load the `agent-to-user` skill and select the host before you open a file. Keep both the editable copy and the original inside the editor workspace. Collect both text edits and line comments.

## Steps

1. **Pick the text.** Done when you hold the text and a short label for it.

   | Request | Text | Label |
   | --- | --- | --- |
   | `/annotate` | your last reply to the operator, verbatim | `reply` |
   | `/annotate N` | your reply N back; 1 is the last one | `reply-N` |
   | `/annotate <path>` | the file at that path | the file name without `.md` |

   Copy a reply exactly as you sent it, with no tool output and no `triage:` line. A path that does not exist: say so in one line and stop.

2. **Write two files** under `<root>/.tmp/annotate/`. In miZed, use the deepest root that contains the current directory from `list_workspaces`. Stop if no root matches. On other hosts, use `line-comment-lsp root`. Create a unique directory for the session with `mktemp -d`. Write the same text to `<label>.md` and `<label>.orig.md`.

3. **Open the edit file.** Tell the operator to edit the text or add a line comment, then close the tab. In miZed, tell them which store the Live comments instructions select. Call `open_file` with the absolute path, `wait_for_close: true`, and `focus_chat_on_close: true`. Continue when the tool returns after the tab closes. On other hosts, use [Open in Zed](#open-in-zed).

4. **Read the notes** when the tab closes or the operator says they are done. Run `diff -U2 <orig file> <edit file>` for edits. In miZed, list comments in the selected store with the absolute edit path. On other hosts, run `line-comment-lsp list` and keep only the comments on the edit file. Collect one note per hunk and one per comment.

5. **Act on the notes** as if the operator sent them as one prompt. Answer each question or make the requested change. Quote the passage each answer refers to. If there are no notes, say so in one line.

6. **Remove the session files and comments.** In miZed, use `clear_comments` with the absolute edit path. On other hosts, drop the comments on the edit file with `line-comment-lsp drop <file>:<line>...`. Delete both copies.

## Open in Zed

Run `~/.claude/scripts/open-file.sh <edit file>` outside the sandbox. In Zed, run `line-comment-lsp wait-close <edit file> && ~/.claude/scripts/zed-focus-agent.sh` in the background outside the sandbox. If the server cannot watch the file, or the host is outside Zed, wait for the operator to confirm they are done.

---
name: agent-to-user
description: Pick the channel that puts agent output in front of the operator and brings the answer back — files opened in the editor (Zed and other hosts) or the mized MCP tools (miZed). Load it before a skill hands the operator a file, a draft, line comments on code, or a set of code excerpts to read, for example from `to-user`, `tell-me`, `snapshot`, `handoff`, or a review. Also for "show it in miZed", "open it in the editor", "comment on these lines".
version: 0.1.0
---

# agent-to-user

Host: !`[ "${MIZED:-}" = 1 ] && echo mized || ~/.claude/scripts/open-file.sh --host`

miZed is the operator's fork of Zed. Its settings start every terminal agent with `MIZED=1` in the environment. The mized MCP server opens tabs in miZed and returns what the operator wrote.

## Steps

1. **Pick the pattern from Host.** Host `mized`: use the [MCP pattern](#mcp-pattern-mized). Any other host: use the [file pattern](#file-pattern-zed-and-other-hosts). Done when the pattern is named.
2. **Check the mized server before the first MCP call.** Find tools named `mcp__mized__*`, with `ToolSearch` if they are deferred. If none exist, run `~/.claude/scripts/mized-mcp.sh list`. If both fail, use the file pattern and tell the operator that the mized MCP server is not connected. Done when one channel answered.
3. **Hand over each item through the row of its kind** in the pattern table. Done when the operator has the item on screen and knows what to do with it.
4. **Read the answer back** as the row says, then continue the task. Done when every answer is acted on or listed as open.

## MCP pattern (mized)

| Kind | Tool | Answer |
|---|---|---|
| Draft or decision file the operator edits | `open_draft` with `title`, `text`, `focus_chat_on_close: true` | The tool returns the edited text when the tab closes. No file and no watch. |
| Notes on lines of code or of a diff | `add_comment` with an absolute `path`, `line`, `end_line`, `text`, and a `store` named for the task (`review`) | `list_comments` with the same `store` returns the replies. `clear_comments` removes the store after the task. |
| Code the operator must read | `open_multibuffer` with a `title` and the excerpts (absolute path, inclusive line range) | Set `wait_for_close: true` when the next step needs the read. |
| A file that exists, such as a report | `open_file` with an absolute `path` | Set `wait_for_close: true` when the next step needs the edit, then read the file. |

- Pass `workspace_id` only when the active workspace is not the one of the task. `list_workspaces` gives the ids.
- A waiting call blocks this turn. Keep a long draft on `open_draft`, and do independent work before the call.
- Without MCP tools in the session, call the same tool through the CLI: `~/.claude/scripts/mized-mcp.sh call <tool> '<json>'`. Pass `-` and the JSON on stdin for long text.

## File pattern (Zed and other hosts)

| Kind | Hand over | Answer |
|---|---|---|
| Draft or decision file the operator edits | Write the markdown file, then open it as `to-user` step 2 says | `to-user` step 3: a `watch-answers.sh` Monitor, then `check-answers`. |
| Notes on lines of code or of a diff | Put each note in the file as a block with `path:line` and a `**Reply:**` slot | Same as the row above. |
| Code the operator must read | Quote the lines in the file under their `path:line` | None, or the `**Comment:**` slot. |
| A file that exists, such as a report | `~/.claude/scripts/open-file.sh <file>` | `--wait` blocks only in a herdr pane. In Zed, ask the operator to confirm the edit before you read the file. |

---
name: agent-to-user
description: Put agent output in front of the operator in the medium and channel of the environment the session runs in, and bring the answer back — miZed through the mized MCP tools, Claude Desktop through an interactive HTML artifact in the right panel, Zed and other terminals through a markdown file opened with `open-file.sh`. Load it before a skill shows the operator a file, a draft, a page, a figure, line comments on code, or code excerpts, for example from `to-user`, `show-me`, `tell-me`, `snapshot`, `handoff`, `annotate`, or a review. Also for "show it to me", "show it in miZed", "open it in the editor", "show it on the right", "comment on these lines".
allowed-tools: Bash(~/.claude/scripts/open-file.sh:*), Bash(~/.claude/scripts/mized-mcp.sh:*), Bash(~/.claude/scripts/zed-edit-return.sh:*), Bash(~/.claude/scripts/watch-answers.sh:*)
version: 0.3.0
---

# agent-to-user

Environment: !`[ "${MIZED:-}" = 1 ] && echo mized || { [ "${CLAUDE_CODE_ENTRYPOINT:-}" = claude-desktop ] && echo desktop; } || ~/.claude/scripts/open-file.sh --host`

**Product.** One item on the operator's screen, in the medium of the environment, and the operator's answer read back into the task.

**Reader.** The operator. They read the item, answer in the slot or the field it gives, and close it.

**Properties** — each handover MUST pass each one:

1. The environment row picked the medium and the channel. No other input picked them.
2. The item is on screen when you tell the operator about it, or you said which step failed.
3. The item names what the operator does with it and how the answer comes back.
4. Each answer is read back and acted on, or listed as open.

**Cause.** The operator works in several environments, and each one shows a different medium well. A markdown file in a terminal session is out of sight in Claude Desktop. An HTML page has no place in a Zed tab. A per-request choice of medium gives a different result for the same content.

## Environments

The environment decides the medium. The caller decides the content, and `show-me` decides the form inside the medium.

| Environment | Detect | Medium | Figures in the medium | Channel |
|---|---|---|---|---|
| `mized` | `MIZED=1`. miZed is the operator's fork of Zed. Its settings start every terminal agent with this variable. | markdown in a miZed tab | ASCII in a fenced block; options as a lettered table | [MCP](#mcp-mized) |
| `desktop` | `CLAUDE_CODE_ENTRYPOINT=claude-desktop`. The session runs in the Claude Desktop app. | an interactive HTML page in the right panel | inline SVG, as `artifact-diagramming` says; options as a table whose rows are radio buttons | [Artifact](#artifact-claude-desktop) |
| `zed` | `open-file.sh --host` prints `zed`. | a markdown file in a Zed tab | ASCII in a fenced block; options as a lettered table | [File](#file-zed-and-terminals) |
| `herdr`, `none` | `open-file.sh --host` prints the value. | a markdown file in the editor, or its path | ASCII in a fenced block; options as a lettered table | [File](#file-zed-and-terminals) |

A short answer in chat stays in chat in every environment. This skill applies when the content leaves the chat. A medium named in the request does not change the row: tell the operator which environment shows that medium.

## Steps

1. **Read the environment.** If the harness shows the Environment expression as text, run it in the shell. Give the caller the medium and the figure forms from the row. Done when the environment has one value.
2. **Check the channel before the first call.**
   - `mized`: find the `mcp__mized__*` tools, with `ToolSearch` if they are deferred. If none exist, run `~/.claude/scripts/mized-mcp.sh list`. If both fail, report the failure. For live comments, stop. For other items, use the `none` row.
   - `desktop`: load the `artifact-design` skill. Load `artifact-capabilities` when the page collects answers.
   Done when one channel answered.
3. **Hand over each item through the row of its kind** in the channel table. Done when Properties 2 and 3 pass.
4. **Read the answer back** as the row says, then continue the task. Done when Property 4 passes.

## MCP (mized)

| Kind | Tool | Answer |
|---|---|---|
| Draft or decision file the operator edits | `open_draft` with `title`, `text`, `focus_chat_on_close: true` | The tool returns the edited text when the tab closes. No file and no watch. |
| Notes on lines of code or of a diff | Use [Live comments](#live-comments). | Read the same store when the operator says the replies are ready. |
| Code the operator must read | `open_multibuffer` with a `title` and the excerpts (absolute path, inclusive line range) | Set `wait_for_close: true` when the next step needs the read. |
| A file that exists, such as a report | `open_file` with an absolute `path` | Set `wait_for_close: true` when the next step needs the edit, then read the file. |

- Pass `workspace_id` only when the active workspace is not the one of the task. `list_workspaces` gives the ids.
- `open_draft` and every call with `wait_for_close: true` block this turn until the tab closes. Do independent work before the call.
- Without MCP tools in the session, call the same tool through the CLI: `~/.claude/scripts/mized-mcp.sh call <tool> '<json>'`. Pass `-` and the JSON on stdin for long text.

### Live comments

Use the store named by the operator, then the known task store, then `default`, in that order. Keep the workspace and store fixed for the entire operation.

| Operation | Tool and scope |
|---|---|
| Add | `add_comment` with absolute `path`, one-based `line`, inclusive `end_line`, and `text`. |
| Read | `list_comments` for the store. Pass an absolute `path` to list one file. Use `read_comment` with an absolute `path` and starting `line` to read one comment. |
| Mark done | `edit_comment` with absolute `path`, starting `line`, and `done: true`. |
| Delete | `clear_comments` with an absolute `path` to delete all comments on one file. Omit `path` to delete all comments in the store. |

## Artifact (Claude Desktop)

The desktop app shows a published artifact in the panel on the right of the chat. One page carries one handover. Write it to the scratchpad as `<task>.html` and publish it with the `Artifact` tool. Publish the same path again for each update, so the panel keeps one URL.

| Kind | Hand over | Answer |
|---|---|---|
| Draft or decision file the operator edits | One page with the caller's sections. Each `[decide]` item gets its options as radio buttons and an answer text field. Each `[review]` item gets a comment field. A draft gets an editable text area. Keep the answers in the `db` capability, in a collection named `answers`, one document per item number. | When the operator says done, read the answers with `ArtifactData` `list` on the `answers` collection. Then act as `check-answers` says. |
| Notes on lines of code or of a diff | One card per note: `path:line`, the quoted lines, the note, and a reply field in `db`. | Same as the row above. |
| Code the operator must read | One card per excerpt: `path:line` as the heading, the lines in a code block. | None, or the comment field of the card. |
| A file that exists, such as a report | Publish an HTML file as it is. Build a page from any other file, with the file path on top. | The operator answers in chat. |

- The panel opens on the first publish. To show the page again later, call `Artifact` with `action: "open"` and the URL.
- Tell the operator in chat what the page asks and how many items need an answer. The page does not post to the chat.
- A comment that the operator writes on the page reaches this session through the artifact watch. Answer it with `ArtifactComments`.

## File (Zed and terminals)

| Kind | Hand over | Answer |
|---|---|---|
| Draft or decision file the operator edits | Write the markdown file. Open it as [Open a file](#open-a-file) says. | `zed`: the close of the tab starts your next turn; run `check-answers` then. Other environments: a `watch-answers.sh` Monitor, then `check-answers`. |
| Notes on lines of code or of a diff | Put each note in the file as a block with `path:line` and a `**Reply:**` slot. | Same as the row above. |
| Code the operator must read | Quote the lines in the file under their `path:line`. | None, or the `**Comment:**` slot. |
| A file that exists, such as a report | `~/.claude/scripts/open-file.sh <file>` | `--wait` blocks only in a herdr pane. In Zed, ask the operator to confirm the edit before you read the file. |

### Open a file

- **`zed`:** run `~/.claude/scripts/zed-edit-return.sh <file>` with Bash `run_in_background: true` and `dangerouslyDisableSandbox: true`. When the operator closes the tab, focus goes back to the chat, and the task exit starts your next turn.
- **`herdr`, `none`:** run `~/.claude/scripts/open-file.sh <file>`. In the same turn, arm `Monitor` with `command: ~/.claude/scripts/watch-answers.sh <file>`, `persistent: true`, and a description that names the file. A file with no slot to fill gets no watch. When the next step cannot start until the operator finishes, use `open-file.sh --wait` instead.

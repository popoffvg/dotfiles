# OpenCode session pins

This native OpenCode plugin adds pins, side chat, and a rewind dialog. The server stores panel state by session. The terminal UI reads it through plugin RPC. [Server](src/pin-server.ts), [pins](src/pin-ledger.ts), [side chat](src/side-chat.ts).

## Install

1. Run `mise run harness:opencode:deps` from the dotfiles checkout.
2. Run `mise run harness:sync`.
3. Run `opencode auth login openai` if OpenAI is not connected.
4. Start `opencode` in the project.

The managed configuration selects GPT-6.1 Sol with medium reasoning effort and enables snapshots. [Configuration](../../opencode/opencode.json).

## Pins

Run `/pins` to open the panel. Click a card to open its file or URL. Focus the panel to use `1` through `9`, `r` to refresh, or `Esc` to close it. The host uses fullscreen presentation in a narrow terminal. [Panel](src/pin-sidebar.tsx), [OpenCode session panels](https://opencode.ai/docs/build/plugins/cli/#session-panels).

The pin tool asks the model to add relevant links and rank the full list. Automatic pin selection depends on the model. PR cards show the PR state, CI results, reviews, conflicts, and the last check time. The panel refreshes PR status every two minutes while open. It uses the signed-in `gh` command. [Server](src/pin-server.ts), [PR status](src/pin-pr-status.ts), [refresh interval](src/pin-sidebar.tsx).

File actions use `~/.claude/scripts/open-file.sh`. URL actions use the operating system's URL opener. [Open actions](src/pin-server.ts).

## Rewind

Run `/rewind`, select a prompt, and choose an action. [Dialog](src/session-rewind.ts).

| Action | Result |
|---|---|
| Summarize above | Replace the earlier turns in model context with a summary. |
| Summarize below | Replace the selected prompt and later turns in model context with a summary. |
| Undo conversation only | Confirm a restore to before the selected prompt. Keep files unchanged. |
| Undo conversation and files | Confirm a restore to before the selected prompt. |

Summaries preserve the full transcript and leave files unchanged. They apply to subsequent model requests and native compaction. A summary cannot restore turns that a later rewind removes. [Summary boundaries](src/context-summary.ts), [request hooks](src/session-chat-server.ts).

Run `/redo` before the next prompt to cancel an undo. [OpenCode rollback](https://opencode.ai/docs/snapshots/).

Current edits to affected files can be overwritten. Snapshots cover eligible files inside the session's active directory in a Git worktree. They do not reverse Git operations, services, or other external effects. [Snapshot scope and restore](https://opencode.ai/docs/snapshots/#scope).

## Side chat

Run `/side` to open the panel. Run `/side <question>` to open it and ask a question. Type in the panel and press Enter for each follow-up. Shift+Enter inserts a new line. [Panel](src/side-chat-panel.tsx), [command](src/pin-sidebar.tsx).

The side chat uses the main session's selected model and current conversation context. It has no tools and adds no main-chat turns. Side turns remain separate and survive panel closure and plugin reload. [Side-chat state](src/side-chat.ts), [transient generation](src/session-chat-server.ts).

Click **Use in prompt** to insert the last answer into the main composer without submission. Click **New** to clear the side thread after its response finishes. Click **Close**, or press Esc, to close the panel. [Panel controls](src/side-chat-panel.tsx).

## Verify

Run `mise run harness:opencode:check` and `mise run harness:opencode:test`. The tests cover pins, side-chat isolation, summary boundaries, and rewind choices. [Pin tests](src/session-pins.test.ts), [side-chat tests](src/side-chat.test.ts), [summary tests](src/context-summary.test.ts), [dialog test](src/session-rewind.test.ts).

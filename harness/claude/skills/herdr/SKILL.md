---
name: herdr
description: Drive the herdr terminal workspace from a Claude Code session — open a program in a pane beside the user (helix, lumen, lazygit, yazi, a dev server), read its screen back, type into it, and close it. Use when the user says "open X", "show me X", "run X in a pane", "launch the TUI", "what does that pane show", or when a command needs a real terminal and fails with "Resource temporarily unavailable (os error 35)". Also covers herdr panes, tabs, sessions, and the socket API.
---

# herdr

Full command list: `references/cheatsheet.md`. The user reads it with `/herdr-help`.

## Why a pane

A Claude Code Bash call has no controlling terminal — `tty` prints `not a tty`.
Any full-screen program fails there:

```
$ hx /tmp/x.txt < /dev/null
Error: unable to start Helix
Caused by:
    Resource temporarily unavailable (os error 35)
```

A herdr pane allocates a real pty, so the same program starts. Never retry a
TUI in Bash after `os error 35` — open a pane instead.

## Open a program

Use `HERDR_PANE_ID` from the environment to find the current session's pane, then:

```bash
herdr agent start <name> --cwd "$PWD" --tab "$HERDR_TAB_ID" --split down --no-focus -- <argv...>
```

- `<name>` is an address (`editor`, `lumen`, `logs`). Reuse it in every later command.
- Name the target space. Without `--tab` or `--workspace` the pane goes to the focused
  workspace, which can be a different project than `--cwd`. For work outside the current
  session, make a workspace first: `herdr workspace create --cwd PATH --label TEXT`, then
  `herdr agent start <name> --workspace <id> ...` and close the empty root pane it returns.
- `--split down` puts the pane under this session; `right` puts it beside.
- `--no-focus` keeps the user's cursor where it is; `--focus` moves it into the new pane.
- The JSON reply carries `result.agent.pane_id` — keep it for `pane close`.

## Confirm it started

Read the screen back and quote the real lines in the reply. A pane that
launched is not proof the program came up.

```bash
herdr agent read <name> --source visible --lines 40
```

Wait first when a program is slow to paint:

```bash
herdr wait output <pane_id> --match "<expected text>" --timeout 15000
```

## Clean up

Close panes opened only to prove something works. Leave panes the user asked
for; report the pane id and what it shows.

```bash
herdr pane close <pane_id>
```

## Rules

- One pane per purpose. Reuse an existing agent name before starting a second copy — check `herdr agent list`.
- Never close or send keys to a pane running another agent session. `herdr pane list` marks those with `agent_session`.
- Report the pane id in the reply, so the user can find what was opened.

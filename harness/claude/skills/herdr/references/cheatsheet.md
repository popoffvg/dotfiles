# herdr cheatsheet

Terminal workspace manager for AI coding agents. Home: https://herdr.dev
Config: `~/.config/herdr/config.toml` · Socket: `~/.config/herdr/herdr.sock`

## Where am I

Every herdr pane exports these; they are the handles everything else needs.

| Variable | Example | Meaning |
|---|---|---|
| `HERDR_PANE_ID` | `w1:p3` | the pane this shell runs in |
| `HERDR_TAB_ID` | `w1:t3` | its tab |
| `HERDR_WORKSPACE_ID` | `w1` | its workspace |
| `HERDR_SOCKET_PATH` | `~/.config/herdr/herdr.sock` | server socket |

## Open a program in a new pane

```bash
herdr agent start <name> --cwd PATH [--workspace ID] [--tab ID] --split down|right [--focus|--no-focus] -- <argv...>
```

Without `--workspace` and `--tab` the pane goes to the focused workspace, which
has nothing to do with `--cwd`. Always name the target.

Returns JSON holding `result.agent.pane_id`. The name is an address — later
commands accept it instead of a pane id.

```bash
herdr agent start editor --cwd ~/git/dotfiles --split down -- hx README.md
herdr agent start lumen  --cwd ~/git/dotfiles --split right -- lumen list
```

## Look at a pane, type into it, close it

```bash
herdr agent read <name|pane_id> --source visible --lines 40
herdr agent send <name> "text"          # literal text, no Enter
herdr pane send-keys <pane_id> Enter
herdr pane run <pane_id> '<command>'    # command text plus Enter
herdr pane close <pane_id>
```

## Wait for something

```bash
herdr wait output <pane_id> --match "done" --timeout 30000 [--regex]
herdr wait agent-status <pane_id> --status idle --timeout 60000
herdr agent wait <name> --status idle
```

## Inventory

```bash
herdr agent list        # JSON: every agent pane, its label and status
herdr pane list         # JSON: pane_id, tab_id, cwd, agent_session
herdr tab list          # JSON: tab_id, label, pane_count, focused
```

## Workspaces

A workspace is the top level: it holds tabs, which hold panes. Give each
project directory its own workspace.

```bash
herdr workspace list                       # JSON: workspace_id, label, focused, tab_count
herdr workspace create --cwd PATH --label TEXT [--focus|--no-focus]
herdr workspace get|focus|close <workspace_id>
herdr workspace rename <workspace_id> <label>
```

`workspace create` returns `result.workspace.workspace_id` and an empty
`result.root_pane.pane_id`. An agent started with `--workspace <id>` splits off
that root pane, so close the root pane to leave the agent alone in the space.

## Layout

```bash
herdr pane split <pane_id> --direction down|right --ratio 0.4 --cwd PATH
herdr pane focus --direction left|right|up|down
herdr pane zoom <pane_id> --toggle
herdr pane move <pane_id> --new-tab
herdr tab create --cwd PATH --label TEXT --focus
```

## Sessions and server

```bash
herdr                          # launch or attach the default session
herdr --session <name>         # named persistent session
herdr session list | attach <name> | stop <name>
herdr status server
herdr server stop
herdr server reload-config
```

`herdr status server` exits 0 whether or not a server runs. Test the output,
not the exit code: `herdr status server | grep -q '^status: running$'`.

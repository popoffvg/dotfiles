---
name: bg-cli
description: Drive the `bg` CLI (the `background` binary) — launch a detached task that outlives the shell and the session, then list it, read its log, follow it, kill it, or purge old logs. Use when a command must survive the session ending, when the user wants to watch it in their own TUI, when firing off a nested `claude -p` agent, or when the user says "bg it", "run it detached", "put it in bg", "show me the bg tasks", or names a bg task id.
---

# The `bg` task runner

`bg` is a daemonless detached task runner: `bg -- <cmd>` re-execs itself as a `setsid` supervisor, streams combined stdout+stderr to `out.log`, and returns a task id immediately. The task survives the shell, the terminal, and this session.

`bg` is the alias; the binary on PATH is `background` (`~/go/bin/background`). Source: `~/git/background`.

## bg or the Bash tool

| Situation | Use |
| --- | --- |
| Build, test, lint, dev server for this session | `Bash` with `run_in_background: true` — see `bg-build-and-test` |
| Must outlive the session or the shell | `bg -- <cmd>` |
| User wants it in their own task list / TUI | `bg -- <cmd>` |
| Nested agent run (`claude -p`, `opencode run`) | `bg -- <cmd>` — adapters pretty-render the stream |
| User names a task id, or asks about existing tasks | `bg ls` / `bg logs <id>` |

## Steps

1. **Launch.** `bg -- <cmd> [args…]`. Everything after `--` runs verbatim. It prints the task id (`20260623-135757-ufvr`) and returns at once — no `&`, no `nohup`.
2. **Tell the user the id.** One line: the command and its id. The user opens the TUI themselves to watch it.
3. **Check it later.** `bg ls` for the table (`ID | STATUS | STARTED | AGE | COMMAND`), `bg logs <id>` for the output. Status is `running`, `exited(N)`, `killed`, or `unknown` (pid gone, no status — a crash).
4. **Report what the log says.** Read the log before stating pass or fail.
5. **Clean up when asked.** `bg kill <id>` terminates the process group; `bg rm <id>` deletes a finished task dir (`--force` for a running one).

## Never open the TUI from a tool call

Bare `bg` and `bg list` launch a Bubble Tea TUI. A Bash tool call has no tty, so it dies with `EAGAIN (os error 35)`. From a session use the non-interactive commands only: `ls`, `logs`, `kill`, `rm`, `gc`. To put the TUI in front of the user, open it in a real pane with `herdr pane open`.

`bg logs <id> -f` follows the log and never exits — run it with `run_in_background: true` or not at all.

## AI-tool adapters

For a matched AI CLI, `bg` injects the flags that make it emit a structured stream and pretty-renders it into the log, reasoning dimmed and prefixed `💭`. `bg ls` still shows the command you typed.

| name | bin | matches when args contain | injected |
| --- | --- | --- | --- |
| claude | `claude` | `-p`, `--print` | `--output-format stream-json --verbose` |
| opencode | `opencode` | `run` | `--format json --thinking` |

So `bg -- claude -p "refactor the parser"` gives a readable transcript, not raw JSON. Add tools in `$BG_HOME/adapters.yaml` (else `~/.config/bg/adapters.yaml`); renderers are `claude-stream-json`, `opencode-json`, `raw`.

## Where state lives

`os.UserCacheDir()/bg/tasks/<id>/`, overridden by `$BG_HOME`. Each dir holds `meta.json` (command, args, cwd, pid, start, alias, `sourceId`), `out.log`, and `status.json` (written only on completion).

Read a log by path when you need to grep it rather than print it whole — `bg logs` has no filter.

## Log retention

Each log is capped at 50 MB live (`BG_MAX_LOG_BYTES`), then one `— log truncated at 50MB —` marker. Every launch runs a best-effort GC pass with the defaults.

`bg gc` purges finished tasks only, in order: age purge (`--max-age`, `14d`) drops `out.log`; size budget (`--max-size`, `500MB`) drops the oldest logs; hard delete (`--hard-age`, `30d`) removes whole dirs; `--max-tasks N` removes the oldest beyond N. Preview with `--dry-run`. Flags also come from `BG_GC_MAX_AGE`, `BG_GC_MAX_SIZE`, `BG_GC_HARD_AGE`, `BG_GC_MAX_TASKS`.

A task whose log was purged reads grey/unknown and `bg logs <id>` prints `— output was removed —`. That is a removed log, not a failed run.

## What the TUI gives the user

Named here so you can tell the user what to press, not so you can drive it. Two panes, `Tab` / `h` / `l` to focus, `q` to quit. In the log pane: `j`/`k` move a line cursor, `←`/`→` scroll horizontally (lines never wrap), `/` searches, `n`/`N` jump matches, `G` re-engages follow, `y` copies the line or visual selection, `Y` copies the log path. `a` or `Enter` opens the actions menu: Repeat (`r`) relaunches the same command in the same cwd as a new task, Transform (`t`/`x`) opens `$EDITOR` to write a shell command run as a new task with `$FILE` set to the source log path, Rename (`n`) sets an alias that replaces the command in the list, plus Kill and Delete.

Finish notifications fire only while the TUI is open, in Ghostty (OSC-777). `BG_NOTIFY=0` off, `BG_NOTIFY=1` forces it in other terminals.

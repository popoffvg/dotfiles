---
name: bg-build-and-test
description: Run every test, build, lint, install, or dev-server command in the background instead of the foreground, so the user can watch it live and the session keeps working. Use before any `cargo test`, `go test`, `pytest`, `npm test`, `mise run`, `make`, `cargo build`, `npm run build`, `docker build`, or any command that can run longer than a few seconds.
---

# Run builds and tests in the background

A foreground command hides its output until it exits. The user sees nothing while it runs,
and the session is blocked. A background command streams into a task the user can open,
so the run is visible while it happens. That visibility is the point.

## Steps

1. **Start it in the background.** Call `Bash` with `run_in_background: true`. Do not add `&`
   — the tool detaches the process itself.
2. **Say what you started.** One line to the user: the command and that it runs in the
   background. The user can open it and watch.
3. **Do other work.** Read files, plan the next edit, prepare the follow-up commit.
   Never call `sleep` to wait.
4. **Wait for the exit.** The harness re-invokes you when the process exits. Use `Monitor`
   with a condition only when you must block on a specific line of output. Poll with
   `TaskOutput` only when you need partial output before the exit.
5. **Report the real result.** Read the output, and state pass or fail with the failing
   lines. Never report a run you did not read.

## What goes in the background

Anything slow or anything the user wants to watch: test suites, builds, `mise run` tasks,
linters over the whole repo, package installs, migrations, docker builds, dev servers,
and long scripts.

A dev server or a watcher never exits — start it in the background and keep it running;
stop it with `TaskStop` when the work is done.

## What stays in the foreground

Short commands whose value is the answer, not the run: `git status`, `git diff`, `ls`,
`cat`, one-file `grep`, `--version`. Also a command you must chain on immediately, where
the next call needs its output and nothing else can proceed.

## One run, one task

Start each command as its own background task. Independent tasks — a build and a lint —
start together in one message and run at the same time. Do not chain them with `&&` into
one task: a chain hides which step failed.

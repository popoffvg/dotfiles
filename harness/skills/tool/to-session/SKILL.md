---
name: to-session
description: Hand a task off to a new, independent agent session in a Herdr tab, so the operator works with it directly and this session does not wait for it. Use for "/to-session", "run it in another session", "start another claude for this", "give this to a new session", "hand this off to a new tab", or when the user names an hc terminal (`t7`, a name) to send work to.
argument-hint: [the task for the other session]
---

# Hand a task off to another session

`hc` is the herdr-core CLI. It runs programs in terminals that stay alive. `herdr-app` is the Herdr desktop app that shows those terminals in spaces and tabs. This session's own terminal is `$HC_TERMINAL_ID`. miZed lists a terminal as a session only when it has the label `herdr.space`, so start the new session as a Herdr tab. `hc --skill` and `herdr-app commands` print the full manuals.

The new session is independent: it has no hc parent, it outlives this session, and it does not report back. The operator talks to it directly. Use the Agent tool when this session needs the result.

## Steps

1. **Check the host.** Run `test -n "${HC_TERMINAL_ID:-}"`. If it fails, tell the operator that this session does not run in a herdr-core terminal, and stop. Done when `$HC_TERMINAL_ID` has a value.

2. **Run every `hc` and `herdr-app` command outside the sandbox** (in Claude Code: `dangerouslyDisableSandbox: true` on each call). The sandbox denies the core lock and the socket, and `hc` fails with `Operation not permitted`. Read this session's space: `hc get "$HC_TERMINAL_ID"`, field `labels."herdr.space"`. Done when you have the space id, or know that the label is absent.

3. **Write the task.** The new session starts cold, with none of this conversation. Put in one prompt the goal, the exact scope, the paths and facts this session found, and what not to touch. Done when a cold agent can do the task from the prompt alone.

4. **Pick the effort.** Select `{light}`, `{medium}`, or `{heavy}`. Resolve the model and the reasoning from `~/.claude/harness/effort-ledger.json`, `runtimes.<agent>.profiles`, and put that runtime's `cli` flags in the argv. Honor a model or an agent kind that the operator names; else use `claude` at `{medium}`. Codex also needs `--no-daemon`, or its commands run outside hc. Done when the argv has the flags.

5. **Launch.** Build the JSON with a script (`python3 -c 'import json; …'`), not by hand: the task holds quotes.

   ```sh
   herdr-app do tab.new '{"space":"<space id>","folder":"<cwd>","name":"<short name>","focus":false,"argv":["claude","--model","<model>","--effort","<reasoning>"],"task":"<task>"}'
   ```

   - Without a `herdr.space` label, run `hc run --bg --no-parent --name <name> --cwd "$PWD" -- <argv> "<task>"`. miZed does not list that terminal.
   - When the operator names a live terminal, do not launch. Run `hc send <terminal> "<task>"`.

   Done when `hc get <terminal>` shows `"state":"live"`.

6. **Tell the operator, and stop.** One line: the tab name and the terminal address. Do not wait for the session, read its screen, or close it. Never run `hc server stop` or `hc server restart`: they act on every terminal of the operator.

---
name: no-literal-home-path-in-stowed-files
description: Use when writing a file path into anything this dotfiles repo stows onto a machine — a settings.json permission entry or allowedCommands line, a hook `command`, a mise task, a skill or command markdown file, or a script under harness/claude/scripts/. Triggers on a path starting with /Users/ or /home/, on adding a permission for a script you just wrote, and on "it's laptop related things".
metadata:
  origin: self-improvement
---

**Write `~/` or `$HOME`, never the literal home path, in any file the repo stows.** A file under
`harness/` lands on another machine by symlink. A literal home path names one machine's user, so it
matches nothing on the next one: the permission never fires and the hook never runs.

## Where each form goes

- **Permission and `allowedCommands` entries** — the bare script name plus the `~/` form. Two
  entries, not three. The literal form adds no coverage the `~/` form does not already give.
- **Hook `command`, mise tasks, script bodies** — `$HOME` or `~`.
- **A path outside the home dir** that names a sibling repo still writes as `~/git/<repo>`.

## The check

Before you finish an edit that added a path, grep the changed file for `/Users/` and `/home/`. An
unintended hit is the bug.

## Exception

An example inside a `CASE.md` or a quoted transcript keeps the literal path. It records what
happened on one machine, so the machine's own spelling is the fact.

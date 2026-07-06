# Notes history — jj, not worklog.md

The notes dir (`<notes-dir>`, e.g. `.notes/`) is its **own standalone jj repo**, git-ignored in the parent project. Spec/TODO/thought history lives in jj — there is no `worklog.md`.

## Setup — automatic (SessionStart hook)

`bin/notes-jj-init.sh` runs on session start: if `<notes-dir>` exists without `.jj`, it runs `jj git init <notes-dir>` (standalone, not colocated) and adds `.notes/` to the parent's `.gitignore.local` (wiring `core.excludesFile` if unset). No manual init in any phase.

## Recording — automatic (per-skill Stop hook)

The `code` SKILL.md frontmatter declares a **Stop** hook (`${CLAUDE_PLUGIN_ROOT}/bin/notes-jj-commit.sh`), scoped to this skill's lifecycle. On session stop it runs `jj commit` in `<notes-dir>`, snapshotting every spec/todos/thoughts/GLOSSARY edit made during the session. No phase appends a log line by hand; the working copy is captured on stop (skipped when nothing changed).

To checkpoint mid-session, run `jj commit -m "<note>"` in `<notes-dir>` explicitly — otherwise the Stop hook does it.

## History — `jj log`

View the spec history with your notes:

```
jj -R <notes-dir> log
```

Each entry is a change with its description and timestamp — the browsable trail the old worklog approximated, now with the diff attached.

## Requires jj

jj is required (installed via the dotfiles Ansible playbook). If `jj` is absent the hooks no-op silently — history is simply not captured until jj is installed.

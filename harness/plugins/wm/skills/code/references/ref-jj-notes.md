# Notes history — jj, not worklog.md

The notes dir (`<notes-dir>`, e.g. `.notes/`) is its **own standalone jj repo**, git-ignored in the parent project. Spec/TODO/thought history lives in jj — there is no `worklog.md`.

## Where the notes live — the home-dir store

**The real notes sit in `~/.notes/<store name>/`; the project holds only a symlink named `.notes`.** The store is the standalone jj repo, so the notes survive a repo delete, a re-clone, or a worktree teardown, and every store sits in one place to back up or push. `bin/notes-store.sh` is the library that owns this layout; every hook and command below sources it.

**The store name comes from the target path, so no registry file has to be kept in step.** The path under `$HOME` becomes the name with `/` turned into `-`. A branch store appends `@` and the branch name verbatim, which needs no escaping because a nested path is a valid directory.

```
~/git/workspace-foo                  ->  ~/.notes/git-workspace-foo
~/Documents/git/dotfiles             ->  ~/.notes/Documents-git-dotfiles
  ... on branch feat/parser          ->  ~/.notes/Documents-git-dotfiles@feat/parser
```

**A worktree shares the stores of the repo it came from.** The symlink sits at the worktree root, where the work happens, but the store name comes from the main repo — so a worktree on `feat/parser` reads the same notes as the main checkout on `feat/parser`.

## Declaring a note — `bin/note-declare.sh`

```
note-declare.sh [<path>]            folder or repo notes (default: cwd)
note-declare.sh --branch [<path>]   notes for the branch checked out there
note-declare.sh --list              every store under the store root
```

**A path inside a git work tree declares repo notes; any other path declares folder notes.** Folder notes are the case of one note over several repos side by side: the symlink sits in the parent folder, above the repos, and each repo finds it by walking up. Repo notes get the `.notes` ignore line as well.

**A branch has its own notes only when the human declares them, and the store's existence is that declaration.** There is no flag and no state file: an undeclared branch keeps using the repo store, so a throwaway branch leaves nothing behind. Branch notes are **isolated** — a separate jj repo with its own history, not a fork of the repo notes.

**Declaring over an existing real `.notes/` directory moves it into the store, history and all.** The move runs before `jj git init`, so a `.notes` that was already a jj repo carries its `.jj` along.

## Following the branch — automatic (UserPromptSubmit hook)

`bin/notes-locate.sh` reconciles the symlink on every prompt, before it reports where the notes are: it points `.notes` at the branch store when one was declared, and at the repo store otherwise. Running on every prompt means switching branch in the middle of a session lands on the right notes. It rewrites **only** a symlink that points into the store root — a real `.notes` directory is the human's and is never touched.

## Setup — automatic (SessionStart hook)

`bin/notes-jj-init.sh` runs on session start: if `<notes-dir>` exists without `.jj`, it runs `jj git init <notes-dir>` (standalone, not colocated) and adds `.notes` to the parent's `.gitignore.local` (wiring `core.excludesFile` if unset). No manual init in any phase. This is the safety net for a `.notes` made by hand; `note-declare.sh` is the way in.

**The ignore line carries no trailing slash.** Git treats a symlink as a file, and a trailing slash matches directories only, so `.notes/` leaves the symlink untracked and dirty in `git status`.

## Recording — automatic (per-skill Stop hook)

The `code` SKILL.md frontmatter declares a **Stop** hook (`${CLAUDE_PLUGIN_ROOT}/bin/notes-jj-commit.sh`), scoped to this skill's lifecycle. On session stop it runs `jj commit` in `<notes-dir>`, snapshotting every spec/todos/thoughts/GLOSSARY edit made during the session. No phase appends a log line by hand; the working copy is captured on stop (skipped when nothing changed).

To checkpoint mid-session, run `jj commit -m "<msg>"` in `<notes-dir>` explicitly — otherwise the Stop hook does it.

## Message convention — say *why*, not what

The message states the **phase + the main ideas of the change** — the reasoning, not a file list. jj already records which files changed; the message adds the intent.

```
<phase>: <main ideas>
```

- `writing spec: single-flight token refresh, drop concurrent-queue option`
- `review: fold status field into notes, decline worklog fallback`
- `revise TODO-3: split handler, error-wrap at boundary`

Each phase reference gives its own message shape (`arch:sub-new.md`, `arch:sub-revise.md`, `impl:sub-fix.md`, …) — all follow this: lead with the phase, then the ideas.

The Stop hook is the **fallback** for uncommitted leftovers only — it can't know intent, so it falls back to the changed basenames. Commit at each phase boundary with a why-message so the hook rarely fires.

## History — `jj log`

View the spec history with your notes:

```
jj -R <notes-dir> log
```

Each entry is a change with its description and timestamp — the browsable trail the old worklog approximated, now with the diff attached.

## Requires jj

jj is required (installed via the dotfiles Ansible playbook). If `jj` is absent the hooks no-op silently — history is simply not captured until jj is installed.

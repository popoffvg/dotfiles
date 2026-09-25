---
name: prx
description: This skill should be used when the user runs "/prx", "/prx <pr-url>", or "/prx post" — to turn spoken review remarks into notes on the exact lines of a live hunk review session, so the user submits them as one GitHub PR review with `S`. Trigger on "collect my PR comments", "start collecting comments", "note that on line N", "put my comments in the review".
---

# prx — turn spoken remarks into notes on a live review

The user talks; prx writes each remark onto the line it is about, inside the hunk
session they are looking at. They press `S` and hunk-gh-review posts every note as
one GitHub review.

**prx never calls the GitHub API.** Posting belongs to the `S` key. That keeps one
comment store (the live session) and one posting path, so a note cannot exist in a
file the user cannot see, and nothing reaches GitHub without them.

Quitting without `S` loses nothing: the `review-focus` extension mirrors every
saved note to a store keyed by the pull request, and the next `prx <same-pr>` puts
them back. `S` clears what it submits, so a restored note is never a duplicate.

## Before anything: a session must be live

```bash
hunk session list --json
```

No session → the user has nothing open. Tell them to run `prx <pr-url|number>`
in their terminal — the shell function builds the throwaway PR worktree and opens
hunk in it — then stop. Do not open the TUI yourself.

One session → it auto-resolves. Several → pick by `--repo <worktree-path>`.

## Subcommands

| Argument | Action |
|---|---|
| *(empty)* | **start** — check the session and read its structure |
| a PR URL or number | **start** — same, and say which PR the session targets |
| `post` | **flush** — apply any pending remarks, then hand over to `S` |

### start

1. Run the session check above.
2. Read the structure: `hunk session review --repo <path> --json`. Add
   `--include-patch` only for files you must read as raw diff text.
3. Tell the user: give remarks as `file:line — what is wrong`. You will place each
   one; they press `S` when done.

### collect

Hold the remarks of one turn, then land them in **one** batch:

```bash
printf '%s' "$json" | hunk session comment apply --repo <path> --stdin
```

Each item needs `filePath`, `summary`, and exactly one target — `newLine` for a
line in the new file, `oldLine` for a removed line. hunk-gh-review maps `newLine`
to `RIGHT` and `oldLine` to `LEFT` when it submits.

The full `comment apply` payload, `navigate`, and the error messages are in the
bundled skill — read it before the first call:

```bash
cat "$(hunk skill path)"
```

Confirm each placed note in one line: `<file>:<line> — <summary>`. Nothing more.

A remark with no line is not a note. Hold it for the review body and say so.

### post

prx does not post. On `/prx post`:

1. Apply anything still pending.
2. List what is in the session: `hunk session comment list --repo <path> --json`.
3. Print the count and tell the user to press `S`, pick Comment / Approve /
   Request changes, and add the body — including any line-less remarks you held.

## Rules

- A note only survives if its line is in the PR's head diff. GitHub rejects the whole
  review if any position is stale, so re-read the structure after a force-push.
- `comment list --type user` is the user's own notes; without `--type` you get the
  agent view. Use `--type all` to see both before reporting a count.
- Earlier reviewers' threads are the user's to read with `T`, and `R` replies to the
  active one. Do not restate a thread as a new note — that posts a second comment
  on a line that already has one.

## Where it fits

- `prx` (shell function, `zsh/dot-zshrc_aliases`) — builds the worktree and opens
  the session this skill writes into. The "Start here" pane and the file order come from a haiku ranking of the changed files.
- `~/.claude/scripts/prx-comments.sh` — carries notes between runs: restores the
  saved ones into a new session and drops the ones already on the PR. It never
  posts. Called by the shell function, not by this skill.
- `/pr-review` — opens the same session, but needs a readable `origin`. A prx
  worktree has none, so do not use it here.
- `hunk-review` skill — the same `comment apply` batch for findings a review gate
  produced instead of the user.

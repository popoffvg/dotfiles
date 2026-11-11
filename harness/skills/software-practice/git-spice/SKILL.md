---
name: git-spice
description: Drive stacked git branches with git-spice (the `gs` binary) — create a branch on top of another, restack after a change below, push the whole stack as one PR per branch with the correct base, and clean up after a squash-merge. Use when the user says "stack", "stacked branch", "stacked PR", "branch on top of", "restack", "rebase the stack", "submit the stack", or when a change must split into PRs that depend on each other.
---

# Stacked branches with git-spice

git-spice keeps a stack: a chain of branches where each branch has one base branch below it. It stores the chain in a git ref, so the repo stays a plain git repo. Teammates see normal branches and normal PRs.

The binary is `gs`. If `gs --version` prints Ghostscript, call `git-spice` instead.

## Step 1: Initialize the repo once

```bash
gs repo init          # asks for the trunk branch (main) and the remote
gs auth login         # once per machine, for GitHub
```

Done when `gs log short` prints the trunk.

## Step 2: Build the stack

| Goal | Command | Alias |
|---|---|---|
| Create a branch on top of the current one and commit the staged changes | `gs branch create <name> -m "<msg>"` | `gs bc` |
| Add a commit to the current branch and restack the branches above | `gs commit create -m "<msg>"` | `gs cc` |
| Amend the last commit and restack the branches above | `gs commit amend --no-edit` | `gs ca` |
| Start tracking a branch that `git checkout -b` made | `gs branch track --base <base>` | `gs btr` |
| Move the current branch onto a different base | `gs branch onto <base>` | `gs bon` |
| Show the stack | `gs log short` | `gs ls` |
| Move up, down, to the top, or to the bottom | `gs up`, `gs down`, `gs top`, `gs bottom` | `gs u`, `gs d`, `gs U`, `gs D` |

Use `gs commit create` and `gs commit amend`, not `git commit`. A plain `git commit` does not restack the branches above.

Done when `gs log short` shows each branch on the base you want.

## Step 3: Restack after a change below

```bash
gs upstack restack    # the current branch and every branch above it
gs stack restack      # every branch of the current stack
```

On a conflict, fix the files, `git add` them, then run `gs rebase continue`. Run `gs rebase abort` to stop.

Done when `gs log short` marks no branch as "needs restack".

## Step 4: Push and open the PRs

```bash
gs stack submit --fill      # push every branch, open or update one PR per branch
gs branch submit --fill     # only the current branch
```

`--fill` takes the PR title and body from the commits, so the command does not prompt. Each PR gets the branch below it as its base.

Before a push, run the repo linter and the tests of the changed packages, as the global CLAUDE.md requires.

Done when each branch shows a PR link in `gs log short`.

## Step 5: Sync after a merge

```bash
gs repo sync          # pull trunk, delete merged branches, move the next branch onto trunk
gs stack restack
gs stack submit --fill
```

Run this after a squash-merge of the bottom PR. It moves the rest of the stack onto the new trunk.

## Non-interactive use

The Bash tool has no tty. A command that prompts fails or hangs. Pass `--no-prompt` to `gs`, and give every value that a prompt asks for (`-m`, `--fill`, `--base`). Check the flags of the installed version with `gs <command> --help`.

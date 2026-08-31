---
allowed-tools: Bash(~/.claude/scripts/pr-review.sh:*)
description: Open a GitHub PR in its own worktree and review it in hunk
---

`$ARGUMENTS` names the PR — a number, a PR URL, or nothing for the PR of the
current branch. An extra `-C <dir>` picks the folder to find the repo in.

First resolve everything without touching git:

```bash
~/.claude/scripts/pr-review.sh -n $ARGUMENTS
```

It prints the repo, the `owner/repo` slug, the PR number, and the base branch.
Report those four in one line. If it fails, print the error and stop — the fix
is in the message (no PR on this branch, several repos in the folder, missing
`gh` auth).

Then hand the launch to the user, because hunk is a full-screen TUI and a Bash
call has no terminal to draw in:

```
! ~/.claude/scripts/pr-review.sh $ARGUMENTS
```

Print that line and stop. The script creates the worktree with `wt switch
pr:<N>`, then replaces itself with hunk in it.

In hunk: `T` opens the PR threads pane, `c` leaves a note on a line, `R` replies
to the selected thread, `S` submits every note as one GitHub review (Comment,
Approve, or Request changes).

To add your own findings to that review while it is open, use the `hunk-review`
skill — one `hunk session comment apply --stdin` batch against the worktree.
The user still presses `S`; nothing posts to GitHub without them.

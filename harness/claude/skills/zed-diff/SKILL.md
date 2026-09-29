---
name: zed-diff
description: Open a git diff in Zed's multi-diff view, so the operator can read it and comment on it in place. Use for "open the diff in zed", "show the change in zed", "let me review/comment on this commit in zed", or `/zed-diff` with a commit, a range, a TODO's commits, or nothing (the uncommitted change).
---

# Open a git diff in Zed

`~/.claude/scripts/zed-diff.sh` does the work. It opens the whole diff as one Zed tab. The right side is **live** when the diff ends at the working tree: it is hard links to the real files, so a comment the operator saves lands in the repo. For any other end commit the right side is a **snapshot**, and a saved edit is lost.

## Steps

1. **Resolve the two sides** from the request. Done when you hold the script's arguments and the repo path for `-C`.

   | The operator asks for | Arguments |
   | --- | --- |
   | the uncommitted change | none |
   | everything since a commit, including local edits | `BASE` |
   | one commit | `COMMIT^!` |
   | a run of commits, such as a TODO's commits | `FIRST^..LAST` — the parent of the first commit, so the first one is inside |
   | one file or folder of it | add `-- PATH...` |

   Leave out a commit that is not part of the work, such as a lint cleanup before it: start the range after it. When a TODO's commits are not consecutive, say so and ask which range to open.

2. **Open it.** Run the script with the sandbox off: inside the sandbox Zed fails with `Unknown Mach error: 44c`.

   ```bash
   ~/.claude/scripts/zed-diff.sh -C <repo> <arguments>
   ```

   Done when it prints `zed-diff: N files, right side live|snapshot`. When N is not the file count you expected, compare it with `git diff --stat <same range>` before you report. Exit 1 with `no change between the two sides` means the range is empty: check the revisions.

3. **Tell the operator** the file count and the side. For **live**, their saved edits change the repo. For **snapshot**, say that a saved edit is lost, and offer the live form: check out the end commit, or open `BASE` alone. Done when they know which side takes comments, and that you read their comments from the files when they say they are done.

## When the operator has commented

Read the comments with `git diff` in the repo: a live edit is an uncommitted change there. Act on each one. A fix to a commit on the branch lands as `git commit --fixup=<sha>`.

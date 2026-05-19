---
allowed-tools: Bash(git add *), Bash(git commit *), Bash(git log *), Bash(git diff *), Bash(git status *), Bash(git branch *), Bash(git rebase *), Bash(GIT_SEQUENCE_EDITOR=true git*), Edit, Read, Glob, Grep
description: Edit code as described, then fixup into the best local commit or create a new one
---

## Context

- Current git status: !`git status`
- Current git diff (staged and unstaged changes): !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Local commits (not on remote): !`git log --oneline '@{upstream}..HEAD' 2>/dev/null || echo "NO_UPSTREAM"`
- Recent commits on branch: !`git log --oneline -15`

## Your task

You are a code-fixing assistant. Follow these steps exactly:

### Step 1: Apply the code changes

Edit the code exactly as the user described. Use Read, Grep, Glob to find relevant files, and Edit to make changes.

### Step 2: Stage the changes

Run `git add` for all modified files (only the files you changed).

### Step 3: Determine the best commit to fixup

Look at the "Local commits (not on remote)" context above.

- If it shows commit hashes and messages: these are unpushed local commits. Find the one whose message best matches your changes. Use that commit hash for a `git commit --fixup=<hash>`.
- If it shows `NO_UPSTREAM`: ALL commits on the branch are local — pick the most relevant one for fixup.
- If it's empty (no output): ALL commits are already pushed to remote. Create a regular new commit with an appropriate message instead. Do NOT fixup pushed commits.

### Step 4: Create the fixup commit

**If fixup target found (unpushed commit exists):**

```bash
git commit --fixup=<target-hash>
```

Then immediately autosquash:

```bash
GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <target-hash>~1
```

This uses `GIT_SEQUENCE_EDITOR=true` to accept the auto-arranged rebase plan without opening an editor, which squashes the fixup into the target commit automatically.

**If no suitable unpushed commit (all pushed):**

```bash
git commit -m "<appropriate message>"
```

### Step 5: Verify

Run `git log --oneline -5` to confirm the result looks correct.

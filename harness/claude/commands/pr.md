---
allowed-tools: Bash(git log:*), Bash(git diff:*), Bash(git branch:*), Bash(git push:*), Bash(git add:*), Bash(git commit:*), Bash(gh pr create:*), Bash(gh pr list:*), Bash(ls:*), Bash(pnpm changeset:*)
description: Create a GitHub PR with purpose-focused description and test cases summary
model: sonnet
---

## Context

- Current branch: !`git branch --show-current`
- Commits vs main: !`git log main..HEAD --oneline 2>/dev/null || git log origin/main..HEAD --oneline`
- Files changed: !`git diff main...HEAD --stat 2>/dev/null || git diff origin/main...HEAD --stat`
- Full diff: !`git diff main...HEAD 2>/dev/null || git diff origin/main...HEAD`
- Open PRs: !`gh pr list --state open --limit 5`

## Your task

### Step 1: Understand the changes

Read the diff and commits carefully. Identify:
- **Purpose**: what problem is solved or feature added (focus on *why*, not *what*)
- **Key changes**: 2–4 bullet points of the most important changes
- **Tests**: specific test scenarios added or modified — name the cases, not just "added tests", keep list short

### Step 2: Check for changeset

Check if the repo uses changesets:
```bash
ls .changeset 2>/dev/null && echo "YES" || echo "NO"
```

If `.changeset/` exists:
- Check whether a changeset for this branch already exists: look for any new `.md` files in `.changeset/` in the diff.
- If **no changeset file was added**, run:
  ```bash
  pnpm changeset
  ```
  Choose the bump type (`patch` / `minor` / `major`) based on the changes:
  - `patch` — bug fix, internal refactor, dependency update
  - `minor` — new feature, backwards-compatible
  - `major` — breaking change

  Then commit the generated file:
  ```bash
  git add .changeset/<generated-file>.md
  git commit -m "chore: add changeset"
  ```

If no `.changeset/` directory — skip this step entirely.

### Step 3: Push if needed

If the branch has no upstream, push it:
```bash
git push -u origin <branch>
```

### Step 4: Create the PR

```bash
gh pr create --title "<title>" --body "<body>"
```

**Title**: imperative mood, ≤72 chars, describes the primary change.

**Body format**:
```
## Purpose

<1–3 sentences: what this achieves and why it matters>

## Changes

- <key change 1>
- <key change 2>
- <key change 3 if needed>

## Tests added

- <test scenario 1: what it verifies>
- <test scenario 2: what it verifies>
```

If no tests were added, include:
```
## Tests

No new tests — <reason: e.g., pure refactor, config-only change, covered by existing tests>.
```

### Rules
- No "Co-Authored-By" AI lines
- No "Generated with Claude Code" footers
- Purpose section: focus on *why*, not *what* (the diff already shows what)
- Test section: name the actual scenarios, not just "unit tests added"

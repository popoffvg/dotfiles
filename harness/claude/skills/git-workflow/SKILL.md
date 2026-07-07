---
name: git-workflow
description: This skill should be used when asked about branching, committing, PRs, or the end-to-end Git development flow. Covers available commands (/smart-commit, /pr, /code fix), branch naming conventions, and when to use each tool.
---

# Git Workflow

## Available Commands

| Command                  | When to use                                                                                               |
| --------------------------| -----------------------------------------------------------------------------------------------------------|
| `/smart-commit`          | You have changes ready to commit — analyzes diff, proposes logical split, asks for approval, then commits |
| `/pr`                    | Branch is ready to merge — creates a GitHub PR with purpose + changes + tests description                 |
| `/code fix`              | Correct a bug/missing part/adjustment — fixes the thought then the code, fixup into the best local commit  |
| `commit-commands:commit` | Quick single commit, no split needed                                                                      |

## End-to-End Flow

```
1. Create branch
   git checkout -b <type>/<short-description>

2. Make changes
   ... code, tests ...

3. Commit
   /smart-commit          ← propose split, approve, commit

4. More changes? Repeat step 3.

5. Open PR
   /pr                    ← push + create PR with structured description
```

## Branch Naming

```
feat/<short-description>     new feature
fix/<short-description>      bug fix
refactor/<description>       refactoring
chore/<description>          maintenance, deps, config
```

Examples: `feat/k8s-health-check`, `fix/auth-token-expiry`, `chore/update-deps`

## Conventional Commit Types

| Type | Use for |
|------|---------|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `test` | Adding or updating tests |
| `doc` | Documentation (README, comments) |
| `refactor` | Code restructuring without behavior change |
| `chore` | Dependencies, config, build, CI |
| `perf` | Performance improvements |
| `style` | Formatting, linting (no logic change) |

## Rules

- **Never** `git add .` or `git add -A` — always add specific files
- **Never** skip hooks (`--no-verify`)
- **Never** amend already-pushed commits — create a new commit instead
- No "Co-Authored-By" AI lines in commits
- No "Generated with Claude Code" footers anywhere
- Ignore local/personal/tool-generated artifacts (scrape caches, scratch dirs, editor cruft) via `.git/info/exclude` — untracked and per-repo. Reserve the tracked `.gitignore` for ignores the whole team needs. A tool's docs may say "add to `.gitignore`"; prefer the local exclude unless the artifact is shared.

## When Things Go Wrong

**Hook fails on commit** → fix the issue, re-stage, create a NEW commit (not amend). Max 2 retries, then abort and report.

**PR already exists** → `gh pr list` to check, then `gh pr edit` to update instead of creating a new one.

**Branch is stale** → `git fetch && git status` to check, then rebase: `git rebase origin/main`.

## Autoresearch rules

**Eval checklist:**
1. Was the correct command recommended for the situation (/smart-commit vs /pr vs /code fix)?
2. Did branch naming follow the convention (<type>/<short-description>)?
3. Were zero git operations performed without the user understanding what would happen?
4. Was the end-to-end flow followed in order (branch → changes → commit → PR)?

**Test inputs:**
- "I have staged changes ready to commit"
- "My branch is ready for review, create a PR"
- "I need to fixup a typo into a previous commit"

**Can change:** command descriptions, flow documentation, branch naming examples, when-to-use guidance
**Cannot change:** command names (/smart-commit, /pr, /code fix), branch naming convention
**Min sessions before eval:** 5
**Runs per experiment:** 3

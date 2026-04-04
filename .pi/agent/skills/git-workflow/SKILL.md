---
name: git-workflow
description: This skill should be used when asked about branching, committing, PRs, or the end-to-end Git development flow. Covers available commands (/smart-commit, /pr, /fix), branch naming conventions, and when to use each tool.
---

# Git Workflow

## Available Commands

| Command                  | When to use                                                                                               |
| --------------------------| -----------------------------------------------------------------------------------------------------------|
| `/smart-commit`          | You have changes ready to commit — analyzes diff, proposes logical split, asks for approval, then commits |
| `/pr`                    | Branch is ready to merge — creates a GitHub PR with purpose + changes + tests description                 |
| `/fix`                   | You made a code change and want to fixup into the best existing local commit                              |
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

## When Things Go Wrong

**Hook fails on commit** → fix the issue, re-stage, create a NEW commit (not amend). Max 2 retries, then abort and report.

**PR already exists** → `gh pr list` to check, then `gh pr edit` to update instead of creating a new one.

**Branch is stale** → `git fetch && git status` to check, then rebase: `git rebase origin/main`.

---
name: work-commit
description: >
  Git commit message conventions. Used during implement phase when
  committing after each completed TODO.
---

# Commit Message Rules

## Format

```
<prefix>: <why this change exists>
```

## Prefixes

| Prefix | When |
|--------|------|
| `feat` | New functionality, new behavior |
| `fix` | Bug fix — describe the bug, not the fix |
| `doc` | Documentation changes only |
| `test` | Adding or updating tests only |
| `build` | Build system, CI, dependencies |
| `refactor` | Code restructuring without behavior change |

## Message Content

The message describes **why**, not **what**.

- ❌ `feat: add handleRefresh function` — describes what was added
- ✅ `feat: support token refresh on expired sessions` — describes why

- ❌ `fix: check for nil pointer in handler` — describes the fix
- ✅ `fix: crash when auth token is missing from request` — describes the bug

- ❌ `refactor: move code to utils` — describes what
- ✅ `refactor: isolate auth logic for reuse across endpoints` — describes the goal

## Rules

- One prefix per commit
- Message ≤ 72 characters
- Imperative mood: "support", not "supports" or "supported"
- No period at the end
- No ticket/issue numbers unless they add clarity
- If a commit touches tests AND code, use the prefix for the code change (e.g. `feat`), not `test`

## Granularity

Each TODO = one commit. **Exception:** if the user explicitly says "join", "merge", or "squash" multiple TODOs, combine them into one commit with a unified message covering all of them.

When squashing N commits on request:
```bash
git reset --soft HEAD~N
git commit -m "<prefix>: <unified why covering all N changes>"
```

The unified message must cover the full scope — do not just repeat the first TODO's message.

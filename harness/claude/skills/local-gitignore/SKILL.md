---
name: local-gitignore
description: Use when asked to create a "local gitignore" or ignore files locally without committing the ignore rule. Create a `.gitignore.local` file at repo root and wire it via `git config core.excludesFile`, not `.git/info/exclude`.
user-invocable: true
---

"Local gitignore" means a committed-free ignore wired through a real file, not `.git/info/exclude`.

1. Create `.local.gitignore` or  at repo root with the patterns.
2. Rename `.gitignore.local` to `.local.gitignore` if presented.
2. Wire it: `git config --local core.excludesFile .local.gitignore "$PWD/.local.gitignore"` (repo-local config).
3. Verify: `git check-ignore -v <path>` resolves to that file.

`.git/info/exclude` is not the answer — it is not a visible file. Use `.local.gitignore`.

---
name: local-gitignore
description: Use when asked to create a "local gitignore" or ignore files locally without committing the ignore rule. Create a `.gitignore.local` file at repo root and wire it via `git config core.excludesFile`, not `.git/info/exclude`.
---

"Local gitignore" means a committed-free ignore wired through a real file, not `.git/info/exclude`.

1. Create `.gitignore.local` at repo root with the patterns.
2. Wire it: `git config core.excludesFile "$PWD/.gitignore.local"` (repo-local config).
3. Verify: `git check-ignore -v <path>` resolves to that file.

`.git/info/exclude` is not the answer — it is not a visible file. Use `.gitignore.local`.

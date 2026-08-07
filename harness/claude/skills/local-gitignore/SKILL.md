---
name: local-gitignore
description: Use when asked to create a "local gitignore" or ignore files locally without committing the ignore rule. Create a `.local.gitignore` file at repo root and wire it via `git config core.excludesFile`, not `.git/info/exclude`.
user-invocable: true
---

"Local gitignore" means a commit-free ignore wired through a real file, not `.git/info/exclude`.

1. Create `.local.gitignore` at repo root with the patterns.
2. Rename `.gitignore.local` to `.local.gitignore` if one is already present.
3. Wire it (repo-local config): `git config --local core.excludesFile "$PWD/.local.gitignore"`
4. Verify: `git check-ignore -v <path>` resolves to that file.

Add `.local.gitignore` to itself — otherwise the file you just created shows up as untracked.

## Carry the global excludesFile over — it is replaced, not merged

`core.excludesFile` holds **one** path. A repo-local value **replaces** the global one for this repo; git does not read both. Every pattern that lived only in the global file silently stops being ignored, and the newly exposed files start appearing in `git status` — easy to stage by accident. Nothing warns you.

Before wiring, look at what you are about to displace:

```bash
git config --global core.excludesFile          # usually ~/.gitignore
git status --porcelain --ignored | grep '^!!'  # what is ignored here today
```

Then copy the global file's patterns into `.local.gitignore` next to the new ones, with a comment saying why, so the duplication is not later mistaken for cruft:

```gitignore
# Carried over from ~/.gitignore: a repo-local core.excludesFile REPLACES the
# global one, so these would stop being ignored here without the copies.
**/.claude/settings.local.json
```

Confirm each carried pattern still resolves after wiring — pass a path the global file used to cover:

```bash
git check-ignore -v .claude/.cc-writes/
```

The repo's own committed `.gitignore` is unaffected; only the global excludes file is displaced.

## Writing `.git/config` may need the sandbox off

`git config --local` writes `.git/config`, which the command sandbox blocks:

```
error: could not lock config file .git/config: Operation not permitted
```

Re-run that one command with the sandbox disabled. Beware a `&&` chain here — the failed `git config` skips the verification steps, and a trailing `|| echo "clean"` then prints a false pass. Verify as a separate command.

`.git/info/exclude` is not the answer — it is not a visible file. Use `.local.gitignore`.

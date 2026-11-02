# mil-hooks

The git hooks of every repo under `~/git/mil/`. `~/.gitconfig` turns them on with `includeIf "gitdir:~/git/mil/"`, which includes `gitconfig` from this dir and sets `core.hooksPath` here.

## What runs

- `pre-commit`: `client-check staged`. It greps the added lines and paths for the names, aliases, email domains, and contacts in `customer-ssot/picture/accounts`. At the same time, Haiku reads them with `prompt.md`. Each 60 KB chunk is one parallel `claude -p` call (about 2 s).
- `commit-msg`: `client-check message`. The term grep only.
- Every hook: `dispatch` runs the repo's own hook too, from `mil.chainHooksPath` or `.git/hooks`.

The verdict is cached in `~/.cache/mil-client-check/verdicts/` by the hash of the diff, the terms, and the prompt. A second commit of the same diff takes no Haiku call.

## Controls

- `MIL_CLIENT_CHECK=0 git commit ...` skips the check.
- `MIL_CLIENT_CHECK=grep git commit ...` skips Haiku and keeps the term grep.
- `git config mil.clientCheck false` skips one repo. `customer-ssot` has it.
- `common-words` lists the customer-list terms that are common words. The grep ignores them.
- When Haiku cannot run (no network, no login), the commit fails. Use `MIL_CLIENT_CHECK=grep`.

## Repos with their own hooksPath

Husky sets `core.hooksPath` in the repo, and that hides this dir. Run `install-local` to move the repo value to `mil.chainHooksPath`. Run it again after `pnpm install`, because husky sets the value again.

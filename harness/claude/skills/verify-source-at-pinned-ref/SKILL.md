---
name: verify-source-at-pinned-ref
description: Debugging or fixing behavior that lives in a dependency, reusable CI action, submodule, or checked-out sibling repo that the build/CI resolves at a pinned ref (@main, a tag, @v4, a commit SHA, a lockfile version) — verify against that exact ref before concluding, not against a local working copy that may sit on a different branch.
---

When a fix's correctness depends on code the target resolves at a pinned ref, read and verify against **that ref** — not whatever the local checkout happens to be on. Local sibling repos drift to feature branches, ahead of or behind the ref CI uses; a symbol/flag/wiring present locally may be absent at the ref, so the fix silently no-ops.

## Steps

1. Find the ref the target resolves:
   - workflow `uses: org/repo/path@REF` or `ref:` on a checkout step
   - submodule pinned SHA (`git submodule status`)
   - lockfile / manifest version
2. Read the file **at that ref**, not the working tree:
   - `git -C <repo> fetch origin <ref>` then `git -C <repo> grep <pat> <ref> -- <path>` or `git -C <repo> show <ref>:<path>`
3. Check the local checkout's branch first — `git -C <repo> rev-parse --abbrev-ref HEAD`. If it isn't the CI ref, treat its contents as unverified.
4. Confirm the symbol/config/env-passthrough/wiring the fix relies on exists at the ref before claiming the fix works or shipping it.

## Trap

Concluding a fix is sound from a local checkout, then shipping it. The local repo was on a feature branch; the CI ref lacked the wiring the fix depended on, so it ran unchanged. Read the ref, not the branch you happen to have.

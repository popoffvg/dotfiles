---
name: baseline-build-from-clean-ref
description: Use when measuring or reproducing a "before" baseline — a perf profile, a before/after benchmark, a regression repro, "does this change actually help" — in a repo whose working tree has uncommitted changes. The dirty tree may itself be the candidate fix, so building from it silently measures the fix as the baseline.
metadata:
  origin: self-improvement
---

A baseline built from the working tree is only a baseline if the tree is clean. Uncommitted changes are usually the candidate fix, so measuring them *as* the baseline erases the very difference the measurement exists to detect — and the numbers look plausible either way, so nothing catches it.

Check first: `git status --short`. If anything is modified, build the baseline from an explicit ref.

## Steps

1. **Pick the ref deliberately.** `HEAD` excludes uncommitted work but still includes committed work on the branch. If the "before" you want is a released version or a pre-regression point, name that tag/SHA instead — and say which ref you used when reporting numbers.
2. **Build in a separate worktree**, never in place:
   ```
   git worktree add --detach <path> <ref>
   ```
3. **Symlink untracked build dependencies into it.** A worktree contains only tracked files, so downloaded toolchains, vendored native libs, and generated assets are missing — the build fails or, worse, silently picks up different versions. Symlink each one from the main tree rather than re-downloading; if the target directory is itself tracked, symlink its *contents*, not the directory (or the link nests inside it).
4. **Verify the binary is the ref you asked for** — a version string, `git log -1`, or an embedded build stamp. Don't assume the build used the worktree.
5. **Compare against the working tree separately**, built the same way, so the only difference between runs is the change under test.

## Never do this

Do not `git stash`, `git restore`, or `git checkout --` the user's tree to make it clean. That destroys uncommitted work with no reflog to recover it, and a worktree gets the same result with none of the risk. (See [[revert-only-your-own-edits]].)

## If the baseline needs a patch to run at all

Sometimes the old ref can't run the scenario without a fix (a startup bug, a missing flag). Patch the *worktree copy* only, keep the patch minimal and confined to the blocker, and state it explicitly as a deviation when reporting — a reader must know the "baseline" wasn't pristine. If the patch touches the same subsystem the measurement is about, the comparison is void; find another route.

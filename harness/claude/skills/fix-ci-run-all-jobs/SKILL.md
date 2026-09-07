---
name: fix-ci-run-all-jobs
description: Use when asked to fix the errors/failures from a CI run (GitHub Actions, GitLab CI, etc.). Ensures every failing job is reproduced and turned green locally, not just the errors inferable from one job's log.
---

Fixing "the errors" from a CI run means turning **every failing job** green — not fixing the log lines spotted in one job.

## Steps

1. List all failing jobs (e.g. `gh run view <id>`). Note each distinct check: typecheck, lint, build, test, vet.
2. For each failing job, find and run its **actual command locally** — read the workflow file if unsure what it runs. Different jobs run different checks even when their logs share a root error.
3. A build/typecheck fix does **not** clear the lint job. Lint runs its own rules (duplication, complexity, style) on top of compilation. Run the linter itself.
4. Re-run each job's check locally until it exits 0. Only then report done.

## Trap

Two jobs failing with the same log line (e.g. `undefined: sub` in both lint and build) tempts a single fix declared complete. But the lint job also runs the full linter — once the code compiles, lint surfaces its *own* separate findings that never appeared while compilation was broken. Fixing the shared error unblocks, it doesn't finish. Run the linter to see what's left.

---
name: reuse-audit
description: Reuse audit — find the code in one Go directory that does again a job the module, its go.mod deps, or the stdlib already do, report it, then fix the chosen groups in parallel writers.
argument-hint: <target-dir in a Go module> [fix]
disable-model-invocation: true
---

# reuse-audit

Audit one Go directory for reinvented code, then fix what the operator picks. Route every agent by the `minions` skill. The per-diff check is the `wm:reuse-critic` agent; this skill covers a whole directory.

1. **Pick the checkout.** An audit MUST read a clean checkout. When other sessions commit to it, a fix run MUST work in a new worktree and branch from its HEAD. Done when `git status --short` is empty in the checkout the run uses.
2. **Build the package map.** Run `~/.claude/scripts/go-package-map.sh <module-root> <target> <helper-dirs...>` into the scratchpad. Done when the map lists at least one import you know the target uses. That import is the positive control, so an empty section means "absent", not "query broken".
3. **Audit.** Cut the target into areas of at most ~6k non-test lines. Start, in one message, one sonnet auditor per area and one sonnet mechanical-scan unit, with the prompts in `references/prompts.md`. Each agent writes one report file. Done when every unit returned a report path.
4. **Verify.** For each report, open both sides of at least one claim: the hand-written code and the replacement. A report with a contradicted claim re-runs on the next tier. Done when every report has one checked claim.
5. **Report.** Put each finding in one group:
   - **A, local reuse**: an existing symbol replaces the code. Fix it.
   - **B, twins inside the target**: two copies, and no existing symbol. A shared helper is new design.
   - **C, architecture**: the target avoids a dep on purpose (read the package doc, e.g. "CLI in place of the SDK"). The operator decides.

   A finding that only proposes new shared code with nothing to reuse goes in B, never A. Done when the operator has the groups with file:line and has chosen what to fix.
6. **Fix.** Start one sonnet writer per unit, in one message. Each unit has a disjoint file set. Use the writer prompt in `references/prompts.md`. A writer MUST NOT run git. Done when every writer reported build, vet and tests of its packages.
7. **Integrate.** Check that each writer touched only its own files, and move any stray hunk to the unit that owns it. Run build, vet and tests over the whole target, then the repo lint once on the final tree, in the background. Fix the lint findings. Then commit each unit alone: `git add <unit files>`, `git commit --no-verify`. The pre-commit lint reads the whole working tree, so a hooked per-unit commit blocks on a finding in another unit's files. Done when `git status --short` is empty and the reply lists each commit with its behavior changes.

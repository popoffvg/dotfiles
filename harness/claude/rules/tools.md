# Tools

## Effort selection

- Skills, agents, and workflows MUST select `{light}`, `{medium}`, or `{heavy}` effort.
- Resolve both the model and reasoning setting through the active harness's `harness/effort-ledger.json`.
- Keep concrete model names in the effort ledger, not in shared instructions.
- Preserve each task's effort requirement, agent role, permissions, and checks.
- Escalate deficient reasoning from `{light}` to `{medium}`, then to `{heavy}`. Escalate only the failed unit.
- Authentication, quota, and transport failures are blockers, not reasons to select another effort tier.
- Honor an explicit user override. Report unsupported settings or unavailable models instead of silently using defaults.

## File edits

- Use the Edit tool for a change in one file. Use the Write tool to replace a whole file.
- Use perl only for the same one-line change in many files, for example a rename: `perl -pi -e 's/old/new/g' <files>`.
- Do not use `perl -0` or another multi-line pattern. A multi-line match fails without an error, or inserts the text at the wrong place.
- Do not edit files with `sed -i`, `echo >`, or a heredoc. BSD and GNU `sed` take different flags.
- After a perl edit, run `git diff` on the changed files before the next step.

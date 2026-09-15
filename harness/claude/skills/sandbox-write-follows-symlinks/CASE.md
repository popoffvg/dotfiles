# Cases

## 2026-09-10 — Reviewer subagents could not write into `.notes`, a symlink out of the repo

- **Repo:** /Users/vitaliipopov/git/dotfiles
- **Source:** correction — the user pointed at the reviewer agents' error and then at the wrong first fix
- **Task:** running reviewer subagents that write their reports to `<repo>/.notes/review/TODO-2/reviewer.md`
- **What I did:** treated the path as inside the project, so the denial looked like a sandbox bug rather than a symlink leaving the repo
- **User's words:** > /opt/nanobrew/prefix/bin/bash: line 1: .../pl-stack/.notes/review/TODO-2/reviewer.md: Operation not permitted … check reviewer agents. They got the error
  > why did you add global notes? reviewer should always write to the local notes
- **Evidence:** `.notes` was a symlink to `/Users/vitaliipopov/.notes/git-mil-pl@MILAB-6670/gcp-multiprovider-terraform`; the sandbox resolved that target, which was not in `sandbox.filesystem.allowWrite`
- **Ambiguous?** no
- **Fix:** one Edit adding `~/.notes` to `sandbox.filesystem.allowWrite` in `harness/claude/settings.json`
- **Transcript:** ~/.claude/self-improvement/lessons/harvested/2026-09-10-debug-reviewer-agents-permission-error-35c9216c-a53e-4ca3-8033-6527c362a7be.jsonl
- **Session topic:** debugging reviewer agent permission errors

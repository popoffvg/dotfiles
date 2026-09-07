# Cases

## 2026-09-02 — Lint gate ran `go test` 15 times against its own prompt's ban

- **Repo:** /Users/vitaliipopov/git/dotfiles
- **Source:** post-mortem — the user pushed on why gates re-ran the toolchain
- **Task:** Investigate failed rules for implementation
- **What went wrong:** the `/code review` lint gate's own prompt already said not to run `go test`; the gate fired it 15 times in one round anyway
- **Correction context:** post-mortem session where the user pushed on why gates re-ran the toolchain despite the written ban
- **Evidence:** the gate's transcript shows 15 `go test` invocations in a single round
- **Ambiguous?** no
- **Scope chosen:** global — a prompt-level ban an agent has already broken recurs across any gate or agent prompt, not just this one
- **Rule written:** when the file already states the ban and it was broken once, add deterministic enforcement (a `PreToolUse` deny or equivalent) whose reason is that sentence, instead of rewording the prose again
- **Transcript:** ~/.claude/self-improvement/lessons/harvested/2026-09-02-investigate-failed-rules-for-implementation-c50d13d8-ce7c-46e7-abb7-eb06b84de094.jsonl
- **Session topic:** investigate failed rules for implementation
